-- 1. Extensão do estado de playback
ALTER TABLE public.playback_state
  ADD COLUMN IF NOT EXISTS active_playlist_id uuid,
  ADD COLUMN IF NOT EXISTS current_institutional_id uuid,
  ADD COLUMN IF NOT EXISTS loop_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS songs_since_institutional integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS shuffle boolean NOT NULL DEFAULT false;

ALTER TABLE public.institutional_contents
  ADD COLUMN IF NOT EXISTS last_played_at timestamptz;

-- 2. Função que escolhe e aplica o próximo item da rádio
CREATE OR REPLACE FUNCTION public.advance_playback(expected_song uuid DEFAULT NULL, expected_institutional uuid DEFAULT NULL)
RETURNS public.playback_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st public.playback_state;
  picked_institutional uuid;
  picked_song uuid;
  next_idx integer;
  total_songs integer;
  freq_threshold integer;
BEGIN
  IF NOT public.is_approved_member() THEN
    RAISE EXCEPTION 'Apenas membros aprovados podem controlar a rádio.';
  END IF;

  SELECT * INTO st FROM public.playback_state WHERE id = true FOR UPDATE;

  -- Idempotência: se o cliente está pedindo "avance porque a música X terminou",
  -- e a música atual não é mais X, ignora silenciosamente.
  IF expected_song IS NOT NULL AND st.current_song_id IS DISTINCT FROM expected_song THEN
    RETURN st;
  END IF;
  IF expected_institutional IS NOT NULL AND st.current_institutional_id IS DISTINCT FROM expected_institutional THEN
    RETURN st;
  END IF;

  IF st.active_playlist_id IS NULL THEN
    UPDATE public.playback_state SET
      is_playing = false,
      current_song_id = NULL,
      current_institutional_id = NULL,
      position_seconds = 0,
      started_at = NULL
    WHERE id = true;
    SELECT * INTO st FROM public.playback_state WHERE id = true;
    RETURN st;
  END IF;

  picked_institutional := NULL;

  -- Se estávamos tocando uma vinheta/aviso, ao terminar não emendamos outra:
  -- volta direto para a próxima música.
  IF st.current_institutional_id IS NULL AND st.institutional_enabled THEN
    -- (a) horário fixo: vinheta com horario na hora/minuto atuais e não tocada nos últimos 5 min
    SELECT id INTO picked_institutional FROM public.institutional_contents
      WHERE ativo = true
        AND horario IS NOT NULL
        AND to_char(now() AT TIME ZONE current_setting('TimeZone'), 'HH24:MI')
            = to_char(horario, 'HH24:MI')
        AND (last_played_at IS NULL OR last_played_at < now() - interval '5 minutes')
      ORDER BY last_played_at NULLS FIRST, random()
      LIMIT 1;

    -- (b) por frequência: vinheta com freq cujo contador alcançou o limite
    IF picked_institutional IS NULL THEN
      SELECT id, frequencia_musicas INTO picked_institutional, freq_threshold
        FROM public.institutional_contents
        WHERE ativo = true
          AND frequencia_musicas IS NOT NULL
          AND st.songs_since_institutional >= frequencia_musicas
        ORDER BY last_played_at NULLS FIRST, random()
        LIMIT 1;
    END IF;
  END IF;

  IF picked_institutional IS NOT NULL THEN
    UPDATE public.institutional_contents
      SET last_played_at = now()
      WHERE id = picked_institutional;

    UPDATE public.playback_state SET
      current_song_id = NULL,
      current_institutional_id = picked_institutional,
      position_seconds = 0,
      started_at = now(),
      is_playing = true,
      songs_since_institutional = 0
    WHERE id = true;
    SELECT * INTO st FROM public.playback_state WHERE id = true;
    RETURN st;
  END IF;

  -- Caso contrário: próxima música da playlist em loop
  SELECT count(*) INTO total_songs FROM public.playlist_songs WHERE playlist_id = st.active_playlist_id;

  IF total_songs = 0 THEN
    UPDATE public.playback_state SET
      is_playing = false,
      current_song_id = NULL,
      current_institutional_id = NULL,
      position_seconds = 0,
      started_at = NULL
    WHERE id = true;
    SELECT * INTO st FROM public.playback_state WHERE id = true;
    RETURN st;
  END IF;

  -- Se acabamos de sair de uma institucional, repete a posição (não avança); senão avança.
  IF st.current_institutional_id IS NOT NULL THEN
    next_idx := st.loop_index % total_songs;
  ELSIF st.current_song_id IS NULL THEN
    next_idx := st.loop_index % total_songs;
  ELSE
    next_idx := (st.loop_index + 1) % total_songs;
  END IF;

  IF st.shuffle THEN
    SELECT song_id INTO picked_song FROM public.playlist_songs
      WHERE playlist_id = st.active_playlist_id
      ORDER BY random()
      LIMIT 1;
  ELSE
    SELECT song_id INTO picked_song FROM public.playlist_songs
      WHERE playlist_id = st.active_playlist_id
      ORDER BY posicao ASC
      OFFSET next_idx LIMIT 1;
  END IF;

  UPDATE public.playback_state SET
    current_song_id = picked_song,
    current_institutional_id = NULL,
    position_seconds = 0,
    started_at = now(),
    is_playing = true,
    loop_index = next_idx,
    songs_since_institutional = CASE
      WHEN st.current_institutional_id IS NOT NULL THEN 0
      ELSE st.songs_since_institutional + 1
    END
  WHERE id = true;

  SELECT * INTO st FROM public.playback_state WHERE id = true;
  RETURN st;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_playback(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.advance_playback(uuid, uuid) TO authenticated;

-- 3. Iniciar transmissão com uma playlist específica
CREATE OR REPLACE FUNCTION public.start_playback(p_playlist_id uuid)
RETURNS public.playback_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st public.playback_state;
BEGIN
  IF NOT public.is_approved_member() THEN
    RAISE EXCEPTION 'Apenas membros aprovados podem controlar a rádio.';
  END IF;

  UPDATE public.playback_state SET
    active_playlist_id = p_playlist_id,
    current_song_id = NULL,
    current_institutional_id = NULL,
    loop_index = 0,
    songs_since_institutional = 0,
    position_seconds = 0,
    started_at = NULL,
    is_playing = false
  WHERE id = true;

  -- avance_playback escolhe o primeiro item e marca is_playing=true
  RETURN public.advance_playback();
END;
$$;

REVOKE ALL ON FUNCTION public.start_playback(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_playback(uuid) TO authenticated;

-- 4. Pausar (salva posição calculada)
CREATE OR REPLACE FUNCTION public.pause_playback()
RETURNS public.playback_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st public.playback_state;
  elapsed numeric;
BEGIN
  IF NOT public.is_approved_member() THEN
    RAISE EXCEPTION 'Apenas membros aprovados podem controlar a rádio.';
  END IF;

  SELECT * INTO st FROM public.playback_state WHERE id = true FOR UPDATE;
  IF st.started_at IS NOT NULL AND st.is_playing THEN
    elapsed := st.position_seconds + EXTRACT(EPOCH FROM (now() - st.started_at));
  ELSE
    elapsed := st.position_seconds;
  END IF;

  UPDATE public.playback_state SET
    is_playing = false,
    position_seconds = COALESCE(elapsed, 0),
    started_at = NULL
  WHERE id = true;

  SELECT * INTO st FROM public.playback_state WHERE id = true;
  RETURN st;
END;
$$;

REVOKE ALL ON FUNCTION public.pause_playback() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pause_playback() TO authenticated;

-- 5. Retomar do ponto pausado
CREATE OR REPLACE FUNCTION public.resume_playback()
RETURNS public.playback_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st public.playback_state;
BEGIN
  IF NOT public.is_approved_member() THEN
    RAISE EXCEPTION 'Apenas membros aprovados podem controlar a rádio.';
  END IF;

  SELECT * INTO st FROM public.playback_state WHERE id = true FOR UPDATE;
  IF st.current_song_id IS NULL AND st.current_institutional_id IS NULL THEN
    -- nada para retomar; tenta tocar a partir da playlist ativa
    RETURN public.advance_playback();
  END IF;

  UPDATE public.playback_state SET
    is_playing = true,
    started_at = now()
  WHERE id = true;

  SELECT * INTO st FROM public.playback_state WHERE id = true;
  RETURN st;
END;
$$;

REVOKE ALL ON FUNCTION public.resume_playback() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.resume_playback() TO authenticated;