import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasPlaybackFinished, playbackInstance } from "@/lib/playback-continuity";

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

export function usePlayback(options?: { autoAdvance?: boolean }) {
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [loading, setLoading] = useState(true);
  const latestRef = useRef(playback);
  latestRef.current = playback;
  const advancingRef = useRef(false);

  useEffect(() => {
    if (!options?.autoAdvance) return;
    let cancelled = false;
    let retryAt = 0;
    const durations = new Map<string, number>();
    const advance = async () => {
      const observed = latestRef.current;
      if (cancelled || advancingRef.current || !observed?.is_playing || Date.now() < retryAt) return;
      advancingRef.current = true;
      try {
        const contentId = observed.current_institutional_id ?? observed.current_song_id;
        if (!contentId) return;
        if (!durations.has(contentId)) {
          const item = observed.current_institutional_id
            ? await supabase.from("institutional_contents").select("duracao_segundos").eq("id", contentId).maybeSingle()
            : await supabase.from("songs").select("duracao_segundos").eq("id", contentId).maybeSingle();
          if (item.error) { retryAt = Date.now() + 5000; return; }
          durations.set(contentId, item.data?.duracao_segundos ?? 0);
        }
        const duration = durations.get(contentId) ?? 0;
        if (!hasPlaybackFinished(observed, duration)) return;
        const { data: fresh, error: readError } = await supabase.from("playback_state").select("*").eq("id", true).maybeSingle();
        if (readError || !fresh || playbackInstance(fresh) !== playbackInstance(observed) || !fresh.is_playing || cancelled) return;
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) return;
        const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", session.session.user.id).maybeSingle();
        if (profile?.status !== "aprovado" || !["admin", "operador"].includes(profile.role) || (fresh.is_locked && profile.role !== "admin")) return;
        if (!hasPlaybackFinished(fresh, duration) || cancelled) return;
        const { data, error } = await supabase.rpc("advance_playback", {
          expected_song: fresh.current_song_id ?? undefined,
          expected_institutional: fresh.current_institutional_id ?? undefined,
        });
        if (error) { retryAt = Date.now() + 5000; console.warn("[radio] Falha no avanço automático", error.message); }
        if (data && !cancelled) setPlayback(data as unknown as PlaybackState);
      } finally { advancingRef.current = false; }
    };
    const tick = () => {
      // Prevent duplicate controller tabs in the same browser.
      if (navigator.locks) void navigator.locks.request("radio-auto-advance", { ifAvailable: true }, (lock) => lock ? advance() : undefined);
      else void advance();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    window.addEventListener("radio:ended", tick);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("radio:ended", tick); };
  }, [options?.autoAdvance]);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("playback_state")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (data) setPlayback((previous) => previous && Date.parse(previous.updated_at) > Date.parse(data.updated_at) ? previous : data as PlaybackState);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase.channel(
      `playback-state-hook-${Math.random().toString(36).slice(2)}`,
    );
    ch.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "playback_state" },
      (payload) => setPlayback(payload.new as PlaybackState),
    ).subscribe((status) => { if (status === "SUBSCRIBED") void refresh(); });
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
