
REVOKE EXECUTE ON FUNCTION public.recompute_playlist_aggregates(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.playlist_tracks_after_change() FROM PUBLIC, anon, authenticated;
