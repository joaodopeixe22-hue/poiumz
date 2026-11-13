-- lovable-cron-fallback-reviewed: o usuario exige avanco da radio a cada 10 s sem ouvintes; e um evento puramente temporal (fim de faixa) sem gatilho de linha.
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS loudness_lufs numeric,
  ADD COLUMN IF NOT EXISTS pico_db numeric,
  ADD COLUMN IF NOT EXISTS inicio_segundos numeric,
  ADD COLUMN IF NOT EXISTS fim_segundos numeric,
  ADD COLUMN IF NOT EXISTS analisado_em timestamptz;

ALTER TABLE public.institutional_contents
  ADD COLUMN IF NOT EXISTS loudness_lufs numeric,
  ADD COLUMN IF NOT EXISTS pico_db numeric,
  ADD COLUMN IF NOT EXISTS inicio_segundos numeric,
  ADD COLUMN IF NOT EXISTS fim_segundos numeric,
  ADD COLUMN IF NOT EXISTS analisado_em timestamptz;

CREATE OR REPLACE FUNCTION public._advance_core(
  expected_song uuid DEFAULT NULL,
  expected_institutional uuid DEFAULT NULL,
  expected_started_at timestamptz DEFAULT NULL
)
RETURNS public.playback_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  st public.playback_state;
  picked_institutional uuid;
  picked_song uuid;
  queue_item_id uuid;
  next_idx integer;
  total_songs integer;
  freq_threshold integer;
  was_institutional boolean;
  resumed_position numeric := 0;
BEGIN
  SELECT * INTO st FROM public.playback_state WHERE id = true FOR UPDATE;

  IF expected_song IS NOT NULL AND st.current_song_id IS DISTINCT FROM expected_song THEN
    RETURN st;
  END IF;
  IF expected_institutional IS NOT NULL AND st.current_institutional_id IS DISTINCT FROM expected_institutional THEN
    RETURN st;
  END IF;
  IF expected_started_at IS NOT NULL AND st.started_at IS DISTINCT FROM expected_started_at THEN
    RETURN st;
  END IF;

  was_institutional := st.current_institutional_id IS NOT NULL;
  picked_institutional := NULL;

  IF NOT was_institutional AND st.institutional_enabled THEN
    SELECT id INTO picked_institutional FROM public.institutional_contents
      WHERE ativo = true AND horario IS NOT NULL
        AND to_char(now() AT TIME ZONE current_setting('TimeZone'), 'HH24:MI') = to_char(horario, 'HH24:MI')
        AND (last_played_at IS NULL OR last_played_at < now() - interval '5 minutes')
      ORDER BY last_played_at NULLS FIRST, random() LIMIT 1;

    IF picked_institutional IS NULL THEN
      SELECT id, frequencia_musicas INTO picked_institutional, freq_threshold
        FROM public.institutional_contents
        WHERE ativo = true AND frequencia_musicas IS NOT NULL
          AND st.songs_since_institutional >= frequencia_musicas
        ORDER BY last_played_at NULLS FIRST, random() LIMIT 1;
    END IF;
  END IF;

  IF picked_institutional IS NOT NULL THEN
    UPDATE public.institutional_contents SET last_played_at = now() WHERE id = picked_institutional;
    UPDATE public.playback_state SET
      current_song_id = NULL,
      current_institutional_id = picked_institutional,
      interrupted_song_id = CASE WHEN st.resume_song_after_institutional AND st.current_song_id IS NOT NULL THEN st.current_song_id ELSE NULL END,
      interrupted_song_position = CASE WHEN st.resume_song_after_institutional AND st.current_song_id IS NOT NULL AND st.started_at IS NOT NULL
        THEN st.position_seconds + EXTRACT(EPOCH FROM (now() - st.started_at)) ELSE 0 END,
      position_seconds = COALESCE((SELECT GREATEST(i.inicio_segundos, 0) FROM public.institutional_contents i WHERE i.id = picked_institutional), 0),
      started_at = now(), is_playing = true,
      songs_since_institutional = 0
    WHERE id = true;
    SELECT * INTO st FROM public.playback_state WHERE id = true;
    RETURN st;
  END IF;

  IF was_institutional AND st.interrupted_song_id IS NOT NULL THEN
    picked_song := st.interrupted_song_id;
    resumed_position := COALESCE(st.interrupted_song_position, 0);
    UPDATE public.playback_state SET
      current_song_id = picked_song,
      current_institutional_id = NULL,
      interrupted_song_id = NULL,
      interrupted_song_position = 0,
      position_seconds = resumed_position,
      started_at = now(), is_playing = true,
      songs_since_institutional = st.songs_since_institutional + 1
    WHERE id = true;
    SELECT * INTO st FROM public.playback_state WHERE id = true;
    RETURN st;
  END IF;

  SELECT q.id, q.song_id INTO queue_item_id, picked_song
    FROM public.queue q ORDER BY q.posicao ASC, q.created_at ASC LIMIT 1;

  IF picked_song IS NOT NULL THEN
    DELETE FROM public.queue WHERE id = queue_item_id;
    UPDATE public.playback_state SET
      current_song_id = picked_song,
      current_institutional_id = NULL,
      interrupted_song_id = NULL,
      interrupted_song_position = 0,
      position_seconds = COALESCE((SELECT GREATEST(s.inicio_segundos, 0) FROM public.songs s WHERE s.id = picked_song), 0),
      started_at = now(), is_playing = true,
      songs_since_institutional = st.songs_since_institutional + 1
    WHERE id = true;
    SELECT * INTO st FROM public.playback_state WHERE id = true;
    RETURN st;
  END IF;

  IF st.active_playlist_id IS NULL THEN
    UPDATE public.playback_state SET
      is_playing = false, current_song_id = NULL, current_institutional_id = NULL,
      interrupted_song_id = NULL, interrupted_song_position = 0,
      position_seconds = 0, started_at = NULL
    WHERE id = true;
    SELECT * INTO st FROM public.playback_state WHERE id = true;
    RETURN st;
  END IF;

  SELECT count(*) INTO total_songs FROM public.playlist_songs WHERE playlist_id = st.active_playlist_id;

  IF total_songs = 0 THEN
    UPDATE public.playback_state SET
      is_playing = false, current_song_id = NULL, current_institutional_id = NULL,
      position_seconds = 0, started_at = NULL
    WHERE id = true;
    SELECT * INTO st FROM public.playback_state WHERE id = true;
    RETURN st;
  END IF;

  IF was_institutional OR st.current_song_id IS NULL THEN
    next_idx := st.loop_index % total_songs;
  ELSE
    next_idx := st.loop_index + 1;
    IF NOT st.loop_playlist AND next_idx >= total_songs THEN
      UPDATE public.playback_state SET
        is_playing = false, current_song_id = NULL, current_institutional_id = NULL,
        position_seconds = 0, started_at = NULL, loop_index = 0
      WHERE id = true;
      SELECT * INTO st FROM public.playback_state WHERE id = true;
      RETURN st;
    END IF;
    next_idx := next_idx % total_songs;
  END IF;

  IF st.shuffle THEN
    SELECT song_id INTO picked_song FROM public.playlist_songs
      WHERE playlist_id = st.active_playlist_id ORDER BY random() LIMIT 1;
  ELSE
    SELECT song_id INTO picked_song FROM public.playlist_songs
      WHERE playlist_id = st.active_playlist_id ORDER BY posicao ASC
      OFFSET next_idx LIMIT 1;
  END IF;

  UPDATE public.playback_state SET
    current_song_id = picked_song,
    current_institutional_id = NULL,
    interrupted_song_id = NULL,
    interrupted_song_position = 0,
    position_seconds = COALESCE((SELECT GREATEST(s.inicio_segundos, 0) FROM public.songs s WHERE s.id = picked_song), 0),
    started_at = now(), is_playing = true,
    loop_index = next_idx,
    songs_since_institutional = CASE WHEN was_institutional THEN 0 ELSE st.songs_since_institutional + 1 END
  WHERE id = true;

  SELECT * INTO st FROM public.playback_state WHERE id = true;
  RETURN st;
END;
$function$;

REVOKE ALL ON FUNCTION public._advance_core(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.advance_playback(
  expected_song uuid DEFAULT NULL::uuid,
  expected_institutional uuid DEFAULT NULL::uuid
)
RETURNS public.playback_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_approved_member() THEN
    RAISE EXCEPTION 'Apenas membros aprovados podem controlar a rádio.';
  END IF;
  RETURN public._advance_core(expected_song, expected_institutional, NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.advance_playback(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_playback(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_playback_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  internal_tick boolean := COALESCE(current_setting('radio.internal_tick', true), '') = '1';
BEGIN
  IF (NEW.is_locked IS DISTINCT FROM OLD.is_locked) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas o admin pode ativar/desativar o modo deus (trava).';
  END IF;
  IF OLD.is_locked = true AND NOT internal_tick AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'A rádio está travada pelo admin (modo deus).';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.radio_tick(p_ended boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  st public.playback_state;
  st_after public.playback_state;
  v_dur numeric;
  v_fim numeric;
  v_found boolean := false;
  v_end numeric;
  v_elapsed numeric;
BEGIN
  SELECT * INTO st FROM public.playback_state WHERE id = true;
  IF NOT FOUND OR NOT st.is_playing OR st.started_at IS NULL THEN
    RETURN false;
  END IF;

  IF st.current_institutional_id IS NOT NULL THEN
    SELECT duracao_segundos, fim_segundos INTO v_dur, v_fim
      FROM public.institutional_contents WHERE id = st.current_institutional_id;
    v_found := FOUND;
  ELSIF st.current_song_id IS NOT NULL THEN
    SELECT duracao_segundos, fim_segundos INTO v_dur, v_fim
      FROM public.songs WHERE id = st.current_song_id;
    v_found := FOUND;
  END IF;

  v_elapsed := st.position_seconds + EXTRACT(EPOCH FROM (now() - st.started_at));

  IF v_found THEN
    v_end := COALESCE(v_fim, v_dur);
    IF v_end IS NULL OR v_end <= 0 THEN
      IF NOT ((COALESCE(p_ended, false) AND public.is_approved_member()) OR v_elapsed >= 900) THEN
        RETURN false;
      END IF;
    ELSIF COALESCE(p_ended, false) THEN
      IF v_elapsed < v_end - 2 THEN RETURN false; END IF;
    ELSE
      IF v_elapsed < v_end + 1 THEN RETURN false; END IF;
    END IF;
  END IF;

  PERFORM set_config('radio.internal_tick', '1', true);
  st_after := public._advance_core(st.current_song_id, st.current_institutional_id, st.started_at);
  PERFORM set_config('radio.internal_tick', '', true);

  RETURN st_after.started_at IS DISTINCT FROM st.started_at
      OR st_after.is_playing IS DISTINCT FROM st.is_playing
      OR st_after.current_song_id IS DISTINCT FROM st.current_song_id
      OR st_after.current_institutional_id IS DISTINCT FROM st.current_institutional_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.radio_tick(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.radio_tick(boolean) TO anon, authenticated;

GRANT SELECT ON public.institutional_contents TO anon;
DROP POLICY IF EXISTS "institucional: leitura aprovados" ON public.institutional_contents;
DROP POLICY IF EXISTS "institucional: leitura ouvintes" ON public.institutional_contents;
CREATE POLICY "institucional: leitura ouvintes" ON public.institutional_contents
  FOR SELECT USING (public.can_read_radio());

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
      PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('radio-tick', 'radio-tick-limpeza');
      PERFORM cron.schedule('radio-tick', '10 seconds', 'SELECT public.radio_tick()');
      PERFORM cron.schedule(
        'radio-tick-limpeza', '17 6 * * *',
        'DELETE FROM cron.job_run_details WHERE end_time < now() - interval ''1 day'''
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'pg_cron nao configurado: %', SQLERRM;
    END;
  ELSE
    RAISE WARNING 'pg_cron indisponivel neste banco; radio_tick dependera dos ouvintes.';
  END IF;
END
$do$;