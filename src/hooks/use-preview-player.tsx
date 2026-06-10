import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PreviewTrack = {
  id: string;
  titulo: string;
  artista: string | null;
  duracao_segundos: number | null;
  storage_path: string;
};

type Ctx = {
  current: PreviewTrack | null;
  queue: PreviewTrack[];
  index: number;
  isPlaying: boolean;
  duration: number;
  position: number;
  volume: number;
  playTrack: (track: PreviewTrack) => Promise<void>;
  playQueue: (tracks: PreviewTrack[], startIndex?: number) => Promise<void>;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  stop: () => void;
};

const PreviewPlayerContext = createContext<Ctx | null>(null);

/** Cache simples de signed URLs para evitar pedidos duplicados */
const urlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getSongSignedUrl(storagePath: string): Promise<string> {
  const now = Date.now();
  const cached = urlCache.get(storagePath);
  if (cached && cached.expiresAt > now + 30_000) return cached.url;
  const { data, error } = await supabase.storage
    .from("songs")
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Não foi possível obter a URL do áudio");
  }
  urlCache.set(storagePath, { url: data.signedUrl, expiresAt: now + 3500_000 });
  // Log útil para diagnóstico
  // eslint-disable-next-line no-console
  console.log("[preview-player] signed URL:", storagePath, "→", data.signedUrl);
  return data.signedUrl;
}

export function PreviewPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<PreviewTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolumeState] = useState(() => {
    if (typeof window === "undefined") return 0.8;
    const v = Number(localStorage.getItem("preview-volume"));
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.8;
  });

  // Cria o único elemento de áudio (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (audioRef.current) return;
    const a = new Audio();
    a.preload = "auto";
    a.volume = volume;
    audioRef.current = a;

    const onTime = () => setPosition(a.currentTime);
    const onDur = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onEnded = () => {
      // avança automaticamente
      goNext();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setIsPlaying(false);
      const code = a.error?.code;
      console.error("[preview-player] audio error", code, a.src);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAndPlay = useCallback(async (track: PreviewTrack) => {
    const a = audioRef.current;
    if (!a) return;
    try {
      const url = await getSongSignedUrl(track.storage_path);
      a.src = url;
      a.currentTime = 0;
      setPosition(0);
      await a.play();
    } catch (e: unknown) {
      setIsPlaying(false);
      toast.error(e instanceof Error ? e.message : "Não foi possível reproduzir");
    }
  }, []);

  const playQueue = useCallback(
    async (tracks: PreviewTrack[], startIndex = 0) => {
      if (tracks.length === 0) return;
      const i = Math.min(Math.max(0, startIndex), tracks.length - 1);
      setQueue(tracks);
      setIndex(i);
      await loadAndPlay(tracks[i]);
    },
    [loadAndPlay],
  );

  const playTrack = useCallback(
    async (track: PreviewTrack) => {
      await playQueue([track], 0);
    },
    [playQueue],
  );

  const goNext = useCallback(async () => {
    setIndex((i) => {
      const next = i + 1;
      if (next >= queue.length) {
        audioRef.current?.pause();
        setIsPlaying(false);
        return i;
      }
      loadAndPlay(queue[next]);
      return next;
    });
  }, [queue, loadAndPlay]);

  const goPrev = useCallback(async () => {
    setIndex((i) => {
      const prev = i - 1;
      if (prev < 0) {
        const a = audioRef.current;
        if (a) {
          a.currentTime = 0;
          setPosition(0);
        }
        return i;
      }
      loadAndPlay(queue[prev]);
      return prev;
    });
  }, [queue, loadAndPlay]);

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
      localStorage.setItem("preview-volume", String(clamped));
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
  }, []);

  const current = queue[index] ?? null;

  const value = useMemo<Ctx>(
    () => ({
      current,
      queue,
      index,
      isPlaying,
      duration,
      position,
      volume,
      playTrack,
      playQueue,
      toggle,
      next: goNext,
      prev: goPrev,
      seek,
      setVolume,
      stop,
    }),
    [
      current,
      queue,
      index,
      isPlaying,
      duration,
      position,
      volume,
      playTrack,
      playQueue,
      toggle,
      goNext,
      goPrev,
      seek,
      setVolume,
      stop,
    ],
  );

  return (
    <PreviewPlayerContext.Provider value={value}>{children}</PreviewPlayerContext.Provider>
  );
}

export function usePreviewPlayer() {
  const ctx = useContext(PreviewPlayerContext);
  if (!ctx) throw new Error("usePreviewPlayer deve estar dentro de PreviewPlayerProvider");
  return ctx;
}
