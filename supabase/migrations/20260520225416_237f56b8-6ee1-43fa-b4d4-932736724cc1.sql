
-- content_hash for duplicate detection
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS content_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS tracks_user_hash_unique
  ON public.tracks (user_id, content_hash) WHERE content_hash IS NOT NULL;

-- playlists
CREATE TABLE IF NOT EXISTS public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  cover_url text,
  is_public boolean NOT NULL DEFAULT false,
  tracks_count integer NOT NULL DEFAULT 0,
  duration_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY playlists_select_own ON public.playlists FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY playlists_insert_own ON public.playlists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY playlists_update_own ON public.playlists FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY playlists_delete_own ON public.playlists FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER playlists_set_updated_at BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- playlist_tracks
CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  playlist_id uuid NOT NULL,
  track_id uuid NOT NULL,
  user_id uuid NOT NULL,
  position integer NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, track_id)
);
CREATE INDEX IF NOT EXISTS playlist_tracks_order ON public.playlist_tracks (playlist_id, position);
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY pt_select_own ON public.playlist_tracks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY pt_insert_own ON public.playlist_tracks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY pt_update_own ON public.playlist_tracks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY pt_delete_own ON public.playlist_tracks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- recompute playlist aggregates
CREATE OR REPLACE FUNCTION public.recompute_playlist_aggregates(_playlist_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.playlists p SET
    tracks_count = COALESCE((SELECT count(*) FROM public.playlist_tracks WHERE playlist_id = _playlist_id), 0),
    duration_total = COALESCE((
      SELECT sum(t.duration) FROM public.playlist_tracks pt
      JOIN public.tracks t ON t.id = pt.track_id
      WHERE pt.playlist_id = _playlist_id
    ), 0),
    updated_at = now()
  WHERE p.id = _playlist_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.playlist_tracks_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_playlist_aggregates(OLD.playlist_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_playlist_aggregates(NEW.playlist_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER playlist_tracks_after_ins AFTER INSERT ON public.playlist_tracks
  FOR EACH ROW EXECUTE FUNCTION public.playlist_tracks_after_change();
CREATE TRIGGER playlist_tracks_after_del AFTER DELETE ON public.playlist_tracks
  FOR EACH ROW EXECUTE FUNCTION public.playlist_tracks_after_change();

-- upload sessions
CREATE TABLE IF NOT EXISTS public.upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  total_files integer NOT NULL DEFAULT 0,
  completed_files integer NOT NULL DEFAULT 0,
  failed_files integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY us_select_own ON public.upload_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY us_insert_own ON public.upload_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY us_update_own ON public.upload_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY us_delete_own ON public.upload_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER upload_sessions_set_updated_at BEFORE UPDATE ON public.upload_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- track uploads (per-file)
CREATE TABLE IF NOT EXISTS public.track_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  track_id uuid,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS track_uploads_session_idx ON public.track_uploads (session_id);
ALTER TABLE public.track_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tu_select_own ON public.track_uploads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY tu_insert_own ON public.track_uploads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY tu_update_own ON public.track_uploads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY tu_delete_own ON public.track_uploads FOR DELETE TO authenticated USING (auth.uid() = user_id);
