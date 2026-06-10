import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlaybackState = {
  id: boolean;
  is_playing: boolean;
  is_locked: boolean;
  current_song_id: string | null;
  current_institutional_id: string | null;
  current_playlist_id: string | null;
  active_playlist_id: string | null;
  loop_index: number;
  loop_playlist: boolean;
  resume_song_after_institutional: boolean;
  interrupted_song_id: string | null;
  interrupted_song_position: number;
  songs_since_institutional: number;
  position_seconds: number;
  started_at: string | null;
  shuffle: boolean;
  volume: number;
  controlled_by: string | null;
  institutional_enabled: boolean;
  updated_at: string;
};

export function usePlayback() {
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("playback_state")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (data) setPlayback(data as PlaybackState);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("playback-state-hook")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "playback_state" },
        (payload) => setPlayback(payload.new as PlaybackState),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  const setInstitutionalEnabled = async (next: boolean) => {
    const { error } = await supabase
      .from("playback_state")
      .update({ institutional_enabled: next })
      .eq("id", true);
    return { error: error?.message ?? null };
  };

  const setShuffle = async (next: boolean) => {
    const { error } = await supabase
      .from("playback_state")
      .update({ shuffle: next })
      .eq("id", true);
    return { error: error?.message ?? null };
  };

  const setLocked = async (next: boolean) => {
    const { error } = await supabase
      .from("playback_state")
      .update({ is_locked: next })
      .eq("id", true);
    return { error: error?.message ?? null };
  };

  const setLoopPlaylist = async (next: boolean) => {
    const { error } = await supabase
      .from("playback_state")
      .update({ loop_playlist: next } as never)
      .eq("id", true);
    return { error: error?.message ?? null };
  };

  const setResumeAfterInstitutional = async (next: boolean) => {
    const { error } = await supabase
      .from("playback_state")
      .update({ resume_song_after_institutional: next } as never)
      .eq("id", true);
    return { error: error?.message ?? null };
  };

  const startPlaylist = async (playlistId: string) => {
    const { data, error } = await supabase.rpc("start_playback", {
      p_playlist_id: playlistId,
    });
    if (data) setPlayback(data as unknown as PlaybackState);
    return { error: error?.message ?? null };
  };

  const pause = async () => {
    const { data, error } = await supabase.rpc("pause_playback");
    if (data) setPlayback(data as unknown as PlaybackState);
    return { error: error?.message ?? null };
  };

  const resume = async () => {
    const { data, error } = await supabase.rpc("resume_playback");
    if (data) setPlayback(data as unknown as PlaybackState);
    return { error: error?.message ?? null };
  };

  const next = async (opts?: { expectedSong?: string; expectedInstitutional?: string }) => {
    const { data, error } = await supabase.rpc("advance_playback", {
      expected_song: opts?.expectedSong,
      expected_institutional: opts?.expectedInstitutional,
    });
    if (data) setPlayback(data as unknown as PlaybackState);
    return { error: error?.message ?? null };
  };

  return {
    playback,
    loading,
    refresh,
    setInstitutionalEnabled,
    setShuffle,
    setLocked,
    setLoopPlaylist,
    setResumeAfterInstitutional,
    startPlaylist,
    pause,
    resume,
    next,
  };
}

/** Calcula a posição real (em segundos) considerando o relógio do servidor */
export function computeLivePosition(pb: PlaybackState | null): number {
  if (!pb) return 0;
  if (!pb.is_playing || !pb.started_at) return pb.position_seconds || 0;
  const startedMs = new Date(pb.started_at).getTime();
  const elapsed = (Date.now() - startedMs) / 1000;
  return (pb.position_seconds || 0) + Math.max(0, elapsed);
}
