
-- Storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tracks', 'tracks', false, 62914560,
  ARRAY['audio/mpeg','audio/mp3','audio/flac','audio/x-flac','audio/wav','audio/wave','audio/x-wav','audio/mp4','audio/m4a','audio/x-m4a','audio/aac']
)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'covers', 'covers', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: tracks (private, per-user)
CREATE POLICY "tracks_own_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tracks' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tracks_own_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tracks' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tracks_own_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tracks' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tracks_own_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tracks' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies: covers (public read, per-user write)
CREATE POLICY "covers_public_select" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'covers');
CREATE POLICY "covers_own_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "covers_own_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "covers_own_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Tracks table
CREATE TABLE public.tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  artist TEXT,
  album TEXT,
  genre TEXT,
  year INTEGER,
  duration NUMERIC,
  bitrate INTEGER,
  track_number INTEGER,
  cover_url TEXT,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  play_count INTEGER NOT NULL DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracks_select_own" ON public.tracks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tracks_insert_own" ON public.tracks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tracks_update_own" ON public.tracks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tracks_delete_own" ON public.tracks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_tracks_user_created ON public.tracks (user_id, created_at DESC);
CREATE INDEX idx_tracks_user_artist ON public.tracks (user_id, artist);
CREATE INDEX idx_tracks_user_album ON public.tracks (user_id, album);
CREATE INDEX idx_tracks_user_favorite ON public.tracks (user_id, is_favorite) WHERE is_favorite = true;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_tracks_search ON public.tracks USING GIN ((title || ' ' || COALESCE(artist,'') || ' ' || COALESCE(album,'')) gin_trgm_ops);

CREATE TRIGGER tracks_set_updated_at BEFORE UPDATE ON public.tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Folders
CREATE TABLE public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folders_select_own" ON public.folders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "folders_insert_own" ON public.folders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "folders_update_own" ON public.folders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "folders_delete_own" ON public.folders FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_folders_user ON public.folders (user_id, created_at DESC);
CREATE TRIGGER folders_set_updated_at BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- track_folders junction
CREATE TABLE public.track_folders (
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, folder_id)
);
ALTER TABLE public.track_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tf_select_own" ON public.track_folders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tf_insert_own" ON public.track_folders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tf_delete_own" ON public.track_folders FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_tf_folder ON public.track_folders (folder_id);
CREATE INDEX idx_tf_user ON public.track_folders (user_id);

-- track_tags
CREATE TABLE public.track_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (track_id, tag)
);
ALTER TABLE public.track_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tt_select_own" ON public.track_tags FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tt_insert_own" ON public.track_tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tt_delete_own" ON public.track_tags FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_tt_user_tag ON public.track_tags (user_id, tag);
CREATE INDEX idx_tt_track ON public.track_tags (track_id);
