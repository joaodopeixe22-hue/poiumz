DROP POLICY IF EXISTS "songs: admin remove" ON public.songs;
CREATE POLICY "songs: remove quem pode upload" ON public.songs
  FOR DELETE TO authenticated
  USING (public.can_user_upload());