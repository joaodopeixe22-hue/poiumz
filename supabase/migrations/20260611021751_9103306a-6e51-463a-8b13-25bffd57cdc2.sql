CREATE OR REPLACE VIEW public.playlist_stats
WITH (security_invoker = true) AS
SELECT
  p.id AS playlist_id,
  COUNT(DISTINCT ps.song_id) AS songs_count,
  COALESCE(SUM(s.duracao_segundos), 0)::bigint AS total_duration_seconds
FROM public.playlists p
LEFT JOIN public.playlist_songs ps ON ps.playlist_id = p.id
LEFT JOIN public.songs s ON s.id = ps.song_id
GROUP BY p.id;

GRANT SELECT ON public.playlist_stats TO authenticated;
GRANT SELECT ON public.playlist_stats TO anon;
GRANT ALL ON public.playlist_stats TO service_role;