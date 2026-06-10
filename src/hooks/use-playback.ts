import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlaybackState = {
  id: boolean;
  is_playing: boolean;
  is_locked: boolean;
  current_song_id: string | null;
  current_playlist_id: string | null;
  position_seconds: number;
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

  return { playback, loading, refresh, setInstitutionalEnabled };
}
