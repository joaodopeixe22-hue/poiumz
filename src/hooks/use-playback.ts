import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { effectiveEnd, hasPlaybackFinished, playbackInstance } from "@/lib/playback-continuity";

/** Folga do temporizador: dá tempo de o fim natural do áudio avisar primeiro. */
const TIMER_GRACE_SECONDS = 1.5;

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

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("playback_state")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (data) setPlayback((previous) => previous && Date.parse(previous.updated_at) > Date.parse(data.updated_at) ? previous : data as PlaybackState);
    setLoading(false);
  }, []);


  // Avanço automático: este cliente só AVISA o servidor ("acho que acabou").
  // Quem decide é a função radio_tick, que confere o relógio do banco. Por isso
  // qualquer ouvinte pode chamar, com ou sem login, sem ganhar controle da rádio.
  useEffect(() => {
    if (!options?.autoAdvance) return;
    let cancelled = false;
    let retryAt = 0;
    let endedInstance: string | null = null;
    const ends = new Map<string, number>();
    const notify = async (endedNow: boolean) => {
      const observed = latestRef.current;
      if (cancelled || advancingRef.current || !observed?.is_playing) return;
      const instance = playbackInstance(observed);
      const heardEnd = endedNow || endedInstance === instance;
      if (!heardEnd && Date.now() < retryAt) return;
      advancingRef.current = true;
      try {
        if (!heardEnd) {
          const contentId = observed.current_institutional_id ?? observed.current_song_id;
          if (!contentId) return;
          if (!ends.has(contentId)) {
            const item = observed.current_institutional_id
              ? await supabase.from("institutional_contents").select("duracao_segundos, fim_segundos").eq("id", contentId).maybeSingle()
              : await supabase.from("songs").select("duracao_segundos, fim_segundos").eq("id", contentId).maybeSingle();
            if (item.error) { retryAt = Date.now() + 5000; return; }
            ends.set(contentId, effectiveEnd(item.data));
          }
          const end = ends.get(contentId) ?? 0;
          // Sem fim conhecido, só o evento real de fim do áudio dispara o aviso.
          if (end <= 0 || !hasPlaybackFinished(observed, end + TIMER_GRACE_SECONDS)) return;
        }
        if (cancelled) return;
        const { data: advanced, error } = await supabase.rpc("radio_tick", { p_ended: heardEnd });
        if (error) {
          retryAt = Date.now() + 5000;
          console.warn("[radio] Falha no avanço automático", error.message);
          return;
        }
        if (advanced) {
          endedInstance = null;
          retryAt = 0;
          if (!cancelled) await refresh();
        } else {
          // O servidor ainda não considera a faixa encerrada: tenta de novo em breve.
          retryAt = Date.now() + (heardEnd ? 2000 : 5000);
        }
      } finally { advancingRef.current = false; }
    };
    const run = (endedNow: boolean) => {
      // Evita abas duplicadas do mesmo navegador avisando ao mesmo tempo.
      if (navigator.locks) void navigator.locks.request("radio-auto-advance", { ifAvailable: true }, (lock) => lock ? notify(endedNow) : undefined);
      else void notify(endedNow);
    };
    let lastEndedCall = 0;
    const tick = () => {
      const observed = latestRef.current;
      const pendingEnd = !!observed && endedInstance === playbackInstance(observed);
      if (pendingEnd && Date.now() - lastEndedCall < 2000) return;
      if (pendingEnd) lastEndedCall = Date.now();
      run(false);
    };
    const onEnded = () => {
      const observed = latestRef.current;
      endedInstance = observed ? playbackInstance(observed) : null;
      lastEndedCall = Date.now();
      run(true);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    window.addEventListener("radio:ended", onEnded);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("radio:ended", onEnded); };
  }, [options?.autoAdvance, refresh]);


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
