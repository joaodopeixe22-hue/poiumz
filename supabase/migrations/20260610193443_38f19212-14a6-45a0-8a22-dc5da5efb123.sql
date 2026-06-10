
ALTER TABLE public.playback_state
  ADD COLUMN IF NOT EXISTS loop_playlist boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS resume_song_after_institutional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interrupted_song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS interrupted_song_position numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.next_queue_position()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(max(posicao), 0) + 1 FROM public.queue;
$$;

CREATE OR REPLACE FUNCTION public.reorder_queue(p_item_id uuid, p_new_position integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_pos integer;
BEGIN
  IF NOT public.is_approved_member() THEN
    RAISE EXCEPTION 'Apenas membros aprovados podem reordenar a fila.';
  END IF;
  SELECT posicao INTO old_pos FROM public.queue WHERE id = p_item_id;
  IF old_pos IS NULL OR old_pos = p_new_position THEN RETURN; END IF;
  IF p_new_position < old_pos THEN
    UPDATE public.queue SET posicao = posicao + 1 WHERE posicao >= p_new_position AND posicao < old_pos;
  ELSE
    UPDATE public.queue SET posicao = posicao - 1 WHERE posicao <= p_new_position AND posicao > old_pos;
  END IF;
  UPDATE public.queue SET posicao = p_new_position WHERE id = p_item_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_queue(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_queue_position() TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_playback(expected_song uuid DEFAULT NULL::uuid, expected_institutional uuid DEFAULT NULL::uuid)
 RETURNS playback_state LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  IF NOT public.is_approved_member() THEN
    RAISE EXCEPTION 'Apenas membros aprovados podem controlar a rádio.';
  END IF;

  SELECT * INTO st FROM public.playback_state WHERE id = true FOR UPDATE;

  IF expected_song IS NOT NULL AND st.current_song_id IS DISTINCT FROM expected_song THEN
    RETURN st;
  END IF;
  IF expected_institutional IS NOT NULL AND st.current_institutional_id IS DISTINCT FROM expected_institutional THEN
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
      position_seconds = 0, started_at = now(), is_playing = true,
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
      position_seconds = 0, started_at = now(), is_playing = true,
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
    position_seconds = 0, started_at = now(), is_playing = true,
    loop_index = next_idx,
    songs_since_institutional = CASE WHEN was_institutional THEN 0 ELSE st.songs_since_institutional + 1 END
  WHERE id = true;

  SELECT * INTO st FROM public.playback_state WHERE id = true;
  RETURN st;
END;
$function$;
