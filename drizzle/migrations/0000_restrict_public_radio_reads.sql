CREATE OR REPLACE FUNCTION public.can_read_radio()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_approved_member()
      OR COALESCE((SELECT permitir_ouvinte_publico FROM public.radio_settings LIMIT 1), true)
$$;
GRANT EXECUTE ON FUNCTION public.can_read_radio() TO anon, authenticated;

DROP POLICY IF EXISTS "playback: leitura publica" ON public.playback_state;
CREATE POLICY "playback: leitura ouvintes" ON public.playback_state FOR SELECT USING (public.can_read_radio());
DROP POLICY IF EXISTS "playlist_songs: leitura publica" ON public.playlist_songs;
CREATE POLICY "playlist_songs: leitura ouvintes" ON public.playlist_songs FOR SELECT USING (public.can_read_radio());
DROP POLICY IF EXISTS "queue: leitura publica" ON public.queue;
CREATE POLICY "queue: leitura ouvintes" ON public.queue FOR SELECT USING (public.can_read_radio());
DROP POLICY IF EXISTS "playlists: leitura publica" ON public.playlists;
CREATE POLICY "playlists: leitura ouvintes" ON public.playlists FOR SELECT USING (public.can_read_radio());