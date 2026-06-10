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
import { toast } from "sonner";

export type AudioTrack = {
  id: string;
  titulo: string;
  artista: string | null;
  duracao_segundos: number | null;
  storage_path?: string;
  url?: string;
};

type AudioPlayerContextValue = {
  currentTrack: AudioTrack | null;
  queue: AudioTrack[];
  index: number;
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

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<AudioTrack[]>([]);
  const indexRef = useRef(0);

  const [queue, setQueue] = useState<AudioTrack[]>([]);
  const [index, setIndex] = useState(0);
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

  // Cria o único elemento de áudio e registra listeners uma única vez
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
      const q = queueRef.current;
      const nextIdx = indexRef.current + 1;
      if (nextIdx >= q.length) {
        setIsPlaying(false);
        return;
      }
      setIndex(nextIdx);
      void loadAndPlay(q[nextIdx]);
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

  const playQueue = useCallback(
    async (tracks: AudioTrack[], startIndex = 0) => {
      if (tracks.length === 0) return;
      const i = Math.min(Math.max(0, startIndex), tracks.length - 1);
      setQueue(tracks);
      setIndex(i);
      queueRef.current = tracks;
      indexRef.current = i;
      await loadAndPlay(tracks[i]);
    },
    [loadAndPlay],
  );

  const playTrack = useCallback(
    async (track: AudioTrack) => {
      await playQueue([track], 0);
    },
    [playQueue],
  );

  const next = useCallback(async () => {
    const q = queueRef.current;
    const nextIdx = indexRef.current + 1;
    if (nextIdx >= q.length) return;
    setIndex(nextIdx);
    indexRef.current = nextIdx;
    await loadAndPlay(q[nextIdx]);
  }, [loadAndPlay]);

  const prev = useCallback(async () => {
    const q = queueRef.current;
    const prevIdx = indexRef.current - 1;
    if (prevIdx < 0) {
      const a = audioRef.current;
      if (a) {
        a.currentTime = 0;
        setPosition(0);
      }
      return;
    }
    setIndex(prevIdx);
    indexRef.current = prevIdx;
    await loadAndPlay(q[prevIdx]);
  }, [loadAndPlay]);

  const toggle = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      try {
        await a.play();
      } catch {
        /* ignore */
      }
    } else {
      a.pause();
    }
  }, []);

  const seek = useCallback((sec: number) => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.currentTime = Math.max(0, sec);
      setPosition(a.currentTime);
    } catch {
      /* ignore */
    }
  }, []);

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
  }, []);

  const currentTrack = queue[index] ?? null;

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      currentTrack,
      queue,
      index,
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
      stop,
    }),
    [
      currentTrack,
      queue,
      index,
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
      stop,
    ],
  );

  return (
    <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>
  );
}
