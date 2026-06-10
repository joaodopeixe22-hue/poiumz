import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Song = {
  id: string;
  titulo: string;
  artista: string | null;
  duracao_segundos: number | null;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
};

export function useSongs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("songs")
      .select("id, titulo, artista, duracao_segundos, storage_path, uploaded_by, created_at")
      .order("created_at", { ascending: false });
    if (!error && data) setSongs(data as Song[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("songs-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "songs" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { songs, loading, refresh };
}

export function useSongsInPlaylists() {
  const [ids, setIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from("playlist_songs").select("song_id");
    if (!error && data) {
      setIds(new Set((data as { song_id: string }[]).map((r) => r.song_id)));
    }
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("playlist-songs-usage")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "playlist_songs" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  return { songsInPlaylists: ids, refresh };
}

export function getSongPublicUrl(path: string) {
  const { data } = supabase.storage.from("songs").getPublicUrl(path);
  return data.publicUrl;
}
