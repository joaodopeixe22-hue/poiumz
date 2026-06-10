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

export async function getSongSignedUrl(path: string, expires = 60) {
  const { data, error } = await supabase.storage.from("songs").createSignedUrl(path, expires);
  if (error) throw error;
  return data.signedUrl;
}
