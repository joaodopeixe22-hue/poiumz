import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Playlist = {
  id: string;
  nome: string;
  created_by: string | null;
  created_at: string;
  song_count?: number;
  total_duration_seconds?: number;
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

type StatsRow = {
  playlist_id: string;
  songs_count: number | null;
  total_duration_seconds: number | null;
};

async function fetchStatsMap(playlistIds: string[]) {
  const map = new Map<string, { songs_count: number; total_duration_seconds: number }>();
  if (playlistIds.length === 0) return map;
  const { data, error } = await supabase
    .from("playlist_stats" as never)
    .select("playlist_id, songs_count, total_duration_seconds")
    .in("playlist_id", playlistIds);
  if (!error && data) {
    for (const r of data as unknown as StatsRow[]) {
      map.set(r.playlist_id, {
        songs_count: Number(r.songs_count ?? 0),
        total_duration_seconds: Number(r.total_duration_seconds ?? 0),
      });
    }
  }
  return map;
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("playlists")
      .select("id, nome, created_by, created_at")
      .order("created_at", { ascending: false });
    if (!error && data) {
      const ids = (data as Playlist[]).map((p) => p.id);
      const stats = await fetchStatsMap(ids);
      setPlaylists(
        (data as Playlist[]).map((p) => {
          const s = stats.get(p.id);
          return {
            ...p,
            song_count: s?.songs_count ?? 0,
            total_duration_seconds: s?.total_duration_seconds ?? 0,
          };
        }),
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
    const [{ data: pl }, { data: ps }, { data: st }] = await Promise.all([
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
      supabase
        .from("playlist_stats" as never)
        .select("songs_count, total_duration_seconds")
        .eq("playlist_id", playlistId)
        .maybeSingle(),
    ]);
    if (pl) {
      const stats = st as unknown as {
        songs_count: number | null;
        total_duration_seconds: number | null;
      } | null;
      setPlaylist({
        ...(pl as Playlist),
        song_count: Number(stats?.songs_count ?? 0),
        total_duration_seconds: Number(stats?.total_duration_seconds ?? 0),
      });
    }
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
