import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Playlist = {
  id: string;
  nome: string;
  created_by: string | null;
  created_at: string;
  song_count?: number;
};

export type PlaylistSong = {
  id: string;
  playlist_id: string;
  song_id: string;
  posicao: number;
  song: {
    id: string;
    titulo: string;
    artista: string | null;
    duracao_segundos: number | null;
    storage_path: string;
  } | null;
};

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("playlists")
      .select("id, nome, created_by, created_at, playlist_songs(count)")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setPlaylists(
        (data as unknown as (Playlist & { playlist_songs: { count: number }[] })[]).map((p) => ({
          id: p.id,
          nome: p.nome,
          created_by: p.created_by,
          created_at: p.created_at,
          song_count: p.playlist_songs?.[0]?.count ?? 0,
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("playlists-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "playlists" },
        () => refresh(),
      )
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

  return { playlists, loading, refresh };
}

export function usePlaylist(playlistId: string | undefined) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [items, setItems] = useState<PlaylistSong[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!playlistId) return;
    const [{ data: pl }, { data: ps }] = await Promise.all([
      supabase
        .from("playlists")
        .select("id, nome, created_by, created_at")
        .eq("id", playlistId)
        .maybeSingle(),
      supabase
        .from("playlist_songs")
        .select(
          "id, playlist_id, song_id, posicao, song:songs(id, titulo, artista, duracao_segundos, storage_path)",
        )
        .eq("playlist_id", playlistId)
        .order("posicao", { ascending: true }),
    ]);
    if (pl) setPlaylist(pl as Playlist);
    if (ps) setItems(ps as unknown as PlaylistSong[]);
    setLoading(false);
  }, [playlistId]);

  useEffect(() => {
    refresh();
    if (!playlistId) return;
    const ch = supabase
      .channel(`playlist-${playlistId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "playlist_songs",
          filter: `playlist_id=eq.${playlistId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [playlistId, refresh]);

  return { playlist, items, loading, refresh };
}
