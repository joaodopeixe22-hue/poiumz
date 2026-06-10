import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";

export type AudioTrack = {
  id: string;
  titulo: string;
  artista: string | null;
  duracao_segundos: number | null;
  storage_path?: string;
  url?: string;
};

export type PlayerMode = "playlist" | "shuffle" | "radio";
export type RepeatMode = "off" | "all" | "one";

type AudioPlayerContextValue = {
  currentTrack: AudioTrack | null;
  queue: AudioTrack[];
  index: number;
  mode: PlayerMode;
  repeat: RepeatMode;
  isPlaying: boolean;
  duration: number;
  position: number;
  volume: number;
  playTrack: (track: AudioTrack) => Promise<void>;
  playQueue: (tracks: AudioTrack[], startIndex?: number) => Promise<void>;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  setMode: (m: PlayerMode) => void;
  setRepeat: (r: RepeatMode) => void;
  cycleRepeat: () => void;
  stop: () => void;
};

export const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

const urlCache = new Map<string, { url: string; expiresAt: number }>();

async function resolveTrackUrl(track: AudioTrack): Promise<string> {
  if (track.url) return track.url;
  if (!track.storage_path) throw new Error("Faixa sem storage_path nem url");
  const now = Date.now();
  const cached = urlCache.get(track.storage_path);
  if (cached && cached.expiresAt > now + 30_000) return cached.url;
  const { data, error } = await supabase.storage
    .from("songs")
    .createSignedUrl(track.storage_path, 3600);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Não foi possível obter a URL do áudio");
  }
  urlCache.set(track.storage_path, {
    url: data.signedUrl,
    expiresAt: now + 3500_000,
  });
  return data.signedUrl;
}

type RemoteEvent =
  | { type: "play_queue"; tracks: AudioTrack[]; index: number; mode: PlayerMode }
  | { type: "toggle"; play: boolean }
  | { type: "seek"; position: number }
  | { type: "set_mode"; mode: PlayerMode }
  | { type: "stop" }
  | { type: "jump"; index: number };

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<AudioTrack[]>([]);
  const indexRef = useRef(0);
  const modeRef = useRef<PlayerMode>("playlist");
  const shuffleHistRef = useRef<number[]>([]);

  // Sync: broadcast channel + echo guard
  const channelRef = useRef<RealtimeChannel | null>(null);
  const echoRef = useRef(false);

  const [queue, setQueue] = useState<AudioTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [mode, setModeState] = useState<PlayerMode>("playlist");
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolumeState] = useState(() => {
    if (typeof window === "undefined") return 0.8;
    const v = Number(localStorage.getItem("global-player-volume"));
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.8;
  });

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const broadcast = useCallback((evt: RemoteEvent) => {
    if (echoRef.current) return;
    channelRef.current?.send({ type: "broadcast", event: "sync", payload: evt });
  }, []);

  const loadAndPlay = useCallback(async (track: AudioTrack) => {
    const a = audioRef.current;
    if (!a) return;
    try {
      const url = await resolveTrackUrl(track);
      a.src = url;
      a.currentTime = 0;
      setPosition(0);
      await a.play();
    } catch (e: unknown) {
      setIsPlaying(false);
      toast.error(e instanceof Error ? e.message : "Não foi possível reproduzir");
    }
  }, []);

  // Único <audio>; listeners únicos
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (audioRef.current) return;
    const a = new Audio();
    a.preload = "auto";
    a.volume = volume;
    audioRef.current = a;

    const onTime = () => setPosition(a.currentTime);
    const onDur = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      // Delega para o handler de "next" respeitando o modo
      void handleEnded();
    };
    const onError = () => {
      setIsPlaying(false);
      console.error("[global-player] audio error", a.error?.code, a.src);
      toast.error("Falha ao carregar o áudio.");
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("loadedmetadata", onDur);
    a.addEventListener("ended", onEnded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("error", onError);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("loadedmetadata", onDur);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("error", onError);
      a.pause();
      a.src = "";
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helpers internos para navegação por modo
  const pickShuffleIndex = useCallback(() => {
    const q = queueRef.current;
    if (q.length <= 1) return indexRef.current;
    let r = indexRef.current;
    let guard = 0;
    while (r === indexRef.current && guard++ < 8) {
      r = Math.floor(Math.random() * q.length);
    }
    return r;
  }, []);

  const goToIndex = useCallback(
    async (i: number) => {
      const q = queueRef.current;
      if (i < 0 || i >= q.length) return;
      setIndex(i);
      indexRef.current = i;
      await loadAndPlay(q[i]);
      broadcast({ type: "jump", index: i });
    },
    [loadAndPlay, broadcast],
  );

  // next / prev / ended respeitando o modo
  const advanceNext = useCallback(async () => {
    const m = modeRef.current;
    if (m === "radio") {
      const { error } = await supabase.rpc("advance_playback", {});
      if (error) toast.error(error.message);
      return;
    }
    if (m === "shuffle") {
      const cur = indexRef.current;
      const ni = pickShuffleIndex();
      shuffleHistRef.current.push(cur);
      await goToIndex(ni);
      return;
    }
    const q = queueRef.current;
    const ni = indexRef.current + 1;
    if (ni >= q.length) return;
    await goToIndex(ni);
  }, [goToIndex, pickShuffleIndex]);

  const advancePrev = useCallback(async () => {
    const m = modeRef.current;
    if (m === "radio") {
      const a = audioRef.current;
      if (a) {
        a.currentTime = 0;
        setPosition(0);
      }
      return;
    }
    if (m === "shuffle") {
      const hist = shuffleHistRef.current;
      if (hist.length > 0) {
        const pi = hist.pop()!;
        await goToIndex(pi);
        return;
      }
      const a = audioRef.current;
      if (a) {
        a.currentTime = 0;
        setPosition(0);
      }
      return;
    }
    const pi = indexRef.current - 1;
    if (pi < 0) {
      const a = audioRef.current;
      if (a) {
        a.currentTime = 0;
        setPosition(0);
      }
      return;
    }
    await goToIndex(pi);
  }, [goToIndex]);

  const handleEnded = useCallback(async () => {
    const m = modeRef.current;
    if (m === "radio") return; // rádio avança via realtime do playback_state
    if (m === "shuffle") {
      await advanceNext();
      return;
    }
    const q = queueRef.current;
    if (indexRef.current + 1 >= q.length) {
      setIsPlaying(false);
      return;
    }
    await advanceNext();
  }, [advanceNext]);

  const playQueue = useCallback(
    async (tracks: AudioTrack[], startIndex = 0) => {
      if (tracks.length === 0) return;
      const i = Math.min(Math.max(0, startIndex), tracks.length - 1);
      setQueue(tracks);
      setIndex(i);
      queueRef.current = tracks;
      indexRef.current = i;
      shuffleHistRef.current = [];
      await loadAndPlay(tracks[i]);
      broadcast({ type: "play_queue", tracks, index: i, mode: modeRef.current });
    },
    [loadAndPlay, broadcast],
  );

  const playTrack = useCallback(
    async (track: AudioTrack) => {
      // tocar uma faixa avulsa força o modo playlist
      if (modeRef.current === "radio") {
        modeRef.current = "playlist";
        setModeState("playlist");
        broadcast({ type: "set_mode", mode: "playlist" });
      }
      await playQueue([track], 0);
    },
    [playQueue, broadcast],
  );

  const next = useCallback(async () => {
    await advanceNext();
  }, [advanceNext]);

  const prev = useCallback(async () => {
    await advancePrev();
  }, [advancePrev]);

  const toggle = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      try {
        await a.play();
        broadcast({ type: "toggle", play: true });
      } catch {
        /* ignore */
      }
    } else {
      a.pause();
      broadcast({ type: "toggle", play: false });
    }
  }, [broadcast]);

  const seek = useCallback(
    (sec: number) => {
      const a = audioRef.current;
      if (!a) return;
      try {
        a.currentTime = Math.max(0, sec);
        setPosition(a.currentTime);
        broadcast({ type: "seek", position: a.currentTime });
      } catch {
        /* ignore */
      }
    },
    [broadcast],
  );

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
    if (typeof window !== "undefined") {
      localStorage.setItem("global-player-volume", String(clamped));
    }
  }, []);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.src = "";
    }
    setIsPlaying(false);
    setQueue([]);
    setIndex(0);
    setPosition(0);
    setDuration(0);
    queueRef.current = [];
    indexRef.current = 0;
    shuffleHistRef.current = [];
    broadcast({ type: "stop" });
  }, [broadcast]);

  const setMode = useCallback(
    (m: PlayerMode) => {
      modeRef.current = m;
      setModeState(m);
      shuffleHistRef.current = [];
      broadcast({ type: "set_mode", mode: m });
    },
    [broadcast],
  );

  // Modo rádio: liga ao playback_state global e segue a programação
  useEffect(() => {
    if (mode !== "radio") return;
    let cancelled = false;

    const syncFromPlayback = async () => {
      const { data: pb } = await supabase
        .from("playback_state")
        .select("current_song_id")
        .eq("id", true)
        .maybeSingle();
      if (cancelled || !pb?.current_song_id) return;
      const { data: song } = await supabase
        .from("songs")
        .select("id, titulo, artista, duracao_segundos, storage_path")
        .eq("id", pb.current_song_id)
        .maybeSingle();
      if (cancelled || !song) return;
      const track: AudioTrack = {
        id: song.id,
        titulo: song.titulo,
        artista: song.artista,
        duracao_segundos: song.duracao_segundos,
        storage_path: song.storage_path,
      };
      // só recarrega se mudou a faixa
      if (queueRef.current[0]?.id === track.id) return;
      setQueue([track]);
      setIndex(0);
      queueRef.current = [track];
      indexRef.current = 0;
      await loadAndPlay(track);
    };

    void syncFromPlayback();
    const ch = supabase
      .channel(`global-player-radio-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "playback_state" },
        () => void syncFromPlayback(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [mode, loadAndPlay]);

  // Sincronia entre dispositivos do mesmo usuário (broadcast)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      const ch = supabase.channel(`global-player:${data.user.id}`, {
        config: { broadcast: { self: false } },
      });
      ch.on("broadcast", { event: "sync" }, ({ payload }) => {
        const evt = payload as RemoteEvent;
        echoRef.current = true;
        void (async () => {
          try {
            switch (evt.type) {
              case "set_mode":
                modeRef.current = evt.mode;
                setModeState(evt.mode);
                shuffleHistRef.current = [];
                break;
              case "play_queue": {
                modeRef.current = evt.mode;
                setModeState(evt.mode);
                setQueue(evt.tracks);
                setIndex(evt.index);
                queueRef.current = evt.tracks;
                indexRef.current = evt.index;
                shuffleHistRef.current = [];
                await loadAndPlay(evt.tracks[evt.index]);
                break;
              }
              case "jump": {
                const q = queueRef.current;
                if (evt.index >= 0 && evt.index < q.length) {
                  setIndex(evt.index);
                  indexRef.current = evt.index;
                  await loadAndPlay(q[evt.index]);
                }
                break;
              }
              case "toggle": {
                const a = audioRef.current;
                if (!a) break;
                if (evt.play && a.paused) await a.play().catch(() => {});
                else if (!evt.play && !a.paused) a.pause();
                break;
              }
              case "seek": {
                const a = audioRef.current;
                if (!a) break;
                a.currentTime = Math.max(0, evt.position);
                setPosition(a.currentTime);
                break;
              }
              case "stop": {
                const a = audioRef.current;
                if (a) {
                  a.pause();
                  a.src = "";
                }
                setIsPlaying(false);
                setQueue([]);
                setIndex(0);
                setPosition(0);
                setDuration(0);
                queueRef.current = [];
                indexRef.current = 0;
                shuffleHistRef.current = [];
                break;
              }
            }
          } finally {
            setTimeout(() => {
              echoRef.current = false;
            }, 80);
          }
        })();
      });
      ch.subscribe();
      channelRef.current = ch;
    })();
    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [loadAndPlay]);

  const currentTrack = queue[index] ?? null;

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      currentTrack,
      queue,
      index,
      mode,
      isPlaying,
      duration,
      position,
      volume,
      playTrack,
      playQueue,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      setMode,
      stop,
    }),
    [
      currentTrack,
      queue,
      index,
      mode,
      isPlaying,
      duration,
      position,
      volume,
      playTrack,
      playQueue,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      setMode,
      stop,
    ],
  );

  return (
    <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>
  );
}
