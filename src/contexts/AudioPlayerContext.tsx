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
import {
  insertAfterCurrent,
  insertAsNext,
  insertMultipleAfterCurrent,
  appendToQueue,
  clearManual,
} from "@/lib/playback-queue";

export type AudioTrack = {
  id: string;
  titulo: string;
  artista: string | null;
  duracao_segundos: number | null;
  storage_path?: string;
  url?: string;
  sourcePlaylistId?: string | null;
  manuallyQueued?: boolean;
};

export type PlayerMode = "playlist" | "shuffle" | "radio";
export type RepeatMode = "off" | "all" | "one";
export type PreloadCount = 2 | 3 | 4 | 5;
export type HistoryItem = AudioTrack & { playedAt: number };

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
  history: HistoryItem[];
  preloadedIds: Set<string>;
  preloadCount: PreloadCount;
  setPreloadCount: (n: PreloadCount) => void;
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
  jumpToTrack: (index: number) => Promise<void>;
  removeFromQueue: (index: number) => void;
  removeFromQueueById: (id: string) => void;
  reorderQueue: (from: number, to: number) => void;
  moveQueueItem: (from: number, to: number) => void;
  addToQueue: (track: AudioTrack) => void;
  addNext: (track: AudioTrack) => void;
  addMultipleToQueue: (tracks: AudioTrack[]) => void;
  clearManualQueue: () => void;
  clearHistory: () => void;
  getUpcomingTracks: (limit?: number) => AudioTrack[];
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
  | { type: "set_repeat"; repeat: RepeatMode }
  | { type: "stop" }
  | { type: "jump"; index: number };

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<AudioTrack[]>([]);
  const indexRef = useRef(0);
  const modeRef = useRef<PlayerMode>("playlist");
  const repeatRef = useRef<RepeatMode>("all");
  const shuffleHistRef = useRef<number[]>([]);

  // Sync: broadcast channel + echo guard
  const channelRef = useRef<RealtimeChannel | null>(null);
  const echoRef = useRef(false);

  const [queue, setQueue] = useState<AudioTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [mode, setModeState] = useState<PlayerMode>("playlist");
  const [repeat, setRepeatState] = useState<RepeatMode>(() => {
    if (typeof window === "undefined") return "all";
    const r = localStorage.getItem("global-player-repeat") as RepeatMode | null;
    return r === "off" || r === "all" || r === "one" ? r : "all";
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolumeState] = useState(() => {
    if (typeof window === "undefined") return 0.8;
    const v = Number(localStorage.getItem("global-player-volume"));
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.8;
  });

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [preloadCount, setPreloadCountState] = useState<PreloadCount>(() => {
    if (typeof window === "undefined") return 3;
    const n = Number(localStorage.getItem("global-player-preload-count"));
    return n === 2 || n === 3 || n === 4 || n === 5 ? (n as PreloadCount) : 3;
  });
  const [preloadedIds, setPreloadedIds] = useState<Set<string>>(new Set());
  const preloadedAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const preloadCountRef = useRef<PreloadCount>(preloadCount);

  useEffect(() => {
    preloadCountRef.current = preloadCount;
  }, [preloadCount]);

  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

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

  const pushHistory = useCallback((track: AudioTrack) => {
    setHistory((prev) => {
      const item: HistoryItem = { ...track, playedAt: Date.now() };
      const filtered = prev.filter((h) => h.id !== track.id);
      return [item, ...filtered].slice(0, 10);
    });
  }, []);

  const preloadTrack = useCallback(async (track: AudioTrack) => {
    if (!track) return;
    const map = preloadedAudioRef.current;
    if (map.has(track.id)) return;
    try {
      const url = await resolveTrackUrl(track);
      const el = new Audio();
      el.preload = "auto";
      el.src = url;
      // Trigger network fetch / browser cache
      try {
        el.load();
      } catch {
        /* ignore */
      }
      map.set(track.id, el);
      setPreloadedIds((prev) => {
        if (prev.has(track.id)) return prev;
        const n = new Set(prev);
        n.add(track.id);
        return n;
      });
    } catch (e) {
      console.warn("[global-player] preload failed", track.id, e);
    }
  }, []);

  const pruneAndPreload = useCallback(async () => {
    if (modeRef.current === "radio") return;
    const q = queueRef.current;
    const cur = indexRef.current;
    const count = preloadCountRef.current;
    // Build keep set: current + next (count-1) tracks (wrap around when repeat=all)
    const keepIds = new Set<string>();
    if (q[cur]) keepIds.add(q[cur].id);
    const targets: AudioTrack[] = [];
    for (let i = 1; i < count && i < q.length; i++) {
      let j = cur + i;
      if (j >= q.length) {
        if (repeatRef.current !== "all") break;
        j = j % q.length;
      }
      const t = q[j];
      if (t && !keepIds.has(t.id)) {
        keepIds.add(t.id);
        targets.push(t);
      }
    }
    // Prune unused
    const map = preloadedAudioRef.current;
    for (const [id, el] of map) {
      if (!keepIds.has(id)) {
        try {
          el.pause();
          el.src = "";
        } catch {
          /* ignore */
        }
        map.delete(id);
      }
    }
    setPreloadedIds((prev) => {
      const n = new Set<string>();
      for (const id of prev) if (keepIds.has(id)) n.add(id);
      for (const id of map.keys()) n.add(id);
      return n;
    });
    // Preload targets sequentially to respect priority
    for (const t of targets) {
      await preloadTrack(t);
    }
  }, [preloadTrack]);

  const loadAndPlay = useCallback(
    async (track: AudioTrack) => {
      const a = audioRef.current;
      if (!a) return;
      try {
        const url = await resolveTrackUrl(track);
        a.src = url;
        a.currentTime = 0;
        setPosition(0);
        await a.play();
        pushHistory(track);
        // Fire-and-forget preload of upcoming tracks
        void pruneAndPreload();
      } catch (e: unknown) {
        setIsPlaying(false);
        toast.error(e instanceof Error ? e.message : "Não foi possível reproduzir");
      }
    },
    [pushHistory, pruneAndPreload],
  );


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
    if (ni >= q.length) {
      // Fila acabou — em playlist com repeat=all, recomeça do início (fila contínua)
      if (repeatRef.current === "all" && q.length > 0) {
        await goToIndex(0);
      }
      return;
    }
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
      // Em repeat=all, volta para o final da fila
      if (repeatRef.current === "all" && queueRef.current.length > 0) {
        await goToIndex(queueRef.current.length - 1);
        return;
      }
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
    // repeat=one: reinicia a faixa atual
    if (repeatRef.current === "one") {
      const a = audioRef.current;
      if (a) {
        a.currentTime = 0;
        setPosition(0);
        try {
          await a.play();
        } catch {
          /* ignore */
        }
      }
      return;
    }
    if (m === "shuffle") {
      await advanceNext();
      return;
    }
    const q = queueRef.current;
    if (indexRef.current + 1 >= q.length) {
      // Fim da fila: loop contínuo se repeat=all
      if (repeatRef.current === "all" && q.length > 0) {
        await goToIndex(0);
        return;
      }
      setIsPlaying(false);
      return;
    }
    await advanceNext();
  }, [advanceNext, goToIndex]);

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

  const setRepeat = useCallback(
    (r: RepeatMode) => {
      repeatRef.current = r;
      setRepeatState(r);
      if (typeof window !== "undefined") {
        localStorage.setItem("global-player-repeat", r);
      }
      broadcast({ type: "set_repeat", repeat: r });
    },
    [broadcast],
  );

  const cycleRepeat = useCallback(() => {
    const order: RepeatMode[] = ["off", "all", "one"];
    const i = order.indexOf(repeatRef.current);
    setRepeat(order[(i + 1) % order.length]);
  }, [setRepeat]);

  const setPreloadCount = useCallback((n: PreloadCount) => {
    preloadCountRef.current = n;
    setPreloadCountState(n);
    if (typeof window !== "undefined") {
      localStorage.setItem("global-player-preload-count", String(n));
    }
    void pruneAndPreload();
  }, [pruneAndPreload]);

  const jumpToTrack = useCallback(
    async (i: number) => {
      await goToIndex(i);
    },
    [goToIndex],
  );

  const removeFromQueue = useCallback(
    (i: number) => {
      const q = queueRef.current;
      if (i < 0 || i >= q.length) return;
      if (i === indexRef.current) return; // não remove a faixa atual
      const next = q.slice(0, i).concat(q.slice(i + 1));
      let newIndex = indexRef.current;
      if (i < indexRef.current) newIndex = indexRef.current - 1;
      setQueue(next);
      setIndex(newIndex);
      queueRef.current = next;
      indexRef.current = newIndex;
      void pruneAndPreload();
    },
    [pruneAndPreload],
  );

  const reorderQueue = useCallback(
    (from: number, to: number) => {
      const q = queueRef.current;
      if (from === to) return;
      if (from < 0 || from >= q.length) return;
      if (to < 0 || to >= q.length) return;
      const cur = indexRef.current;
      // Don't move the currently-playing track
      if (from === cur || to === cur) return;
      const next = q.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      // Recompute index of the currently-playing track
      let newIndex = cur;
      if (from < cur && to >= cur) newIndex = cur - 1;
      else if (from > cur && to <= cur) newIndex = cur + 1;
      setQueue(next);
      setIndex(newIndex);
      queueRef.current = next;
      indexRef.current = newIndex;
      void pruneAndPreload();
    },
    [pruneAndPreload],
  );

  const applyQueueState = useCallback(
    (state: { queue: AudioTrack[]; index: number }) => {
      setQueue(state.queue);
      setIndex(state.index);
      queueRef.current = state.queue;
      indexRef.current = state.index;
      void pruneAndPreload();
    },
    [pruneAndPreload],
  );

  const addNext = useCallback(
    (track: AudioTrack) => {
      const next = insertAsNext(
        { queue: queueRef.current, index: indexRef.current },
        track,
      );
      applyQueueState(next);
    },
    [applyQueueState],
  );

  const addToQueue = useCallback(
    (track: AudioTrack) => {
      const next = appendToQueue(
        { queue: queueRef.current, index: indexRef.current },
        track,
      );
      applyQueueState(next);
    },
    [applyQueueState],
  );

  const addMultipleToQueue = useCallback(
    (tracks: AudioTrack[]) => {
      const next = insertMultipleAfterCurrent(
        { queue: queueRef.current, index: indexRef.current },
        tracks,
      );
      applyQueueState(next);
    },
    [applyQueueState],
  );

  const removeFromQueueById = useCallback(
    (id: string) => {
      const q = queueRef.current;
      const at = q.findIndex((t) => t.id === id);
      if (at === -1 || at === indexRef.current) return;
      const next = q.slice(0, at).concat(q.slice(at + 1));
      const newIndex = at < indexRef.current ? indexRef.current - 1 : indexRef.current;
      applyQueueState({ queue: next, index: newIndex });
    },
    [applyQueueState],
  );

  const clearManualQueue = useCallback(() => {
    const next = clearManual({
      queue: queueRef.current,
      index: indexRef.current,
    });
    applyQueueState(next);
  }, [applyQueueState]);

  const moveQueueItem = useCallback(
    (from: number, to: number) => {
      // delegated to reorderQueue logic (reorderQueue lives above)
      // but defined here so the public API matches the spec.
      reorderQueue(from, to);
    },
    // reorderQueue declared above
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);


  const getUpcomingTracks = useCallback(
    (limit = 20): AudioTrack[] => {
      const q = queueRef.current;
      const cur = indexRef.current;
      const out: AudioTrack[] = [];
      for (let i = 1; i <= limit; i++) {
        let j = cur + i;
        if (j >= q.length) {
          if (repeatRef.current !== "all" || q.length === 0) break;
          j = j % q.length;
          if (j === cur) break;
        }
        out.push(q[j]);
      }
      return out;
    },
    [],
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
              case "set_repeat":
                repeatRef.current = evt.repeat;
                setRepeatState(evt.repeat);
                if (typeof window !== "undefined") {
                  localStorage.setItem("global-player-repeat", evt.repeat);
                }
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
      repeat,
      isPlaying,
      duration,
      position,
      volume,
      history,
      preloadedIds,
      preloadCount,
      setPreloadCount,
      playTrack,
      playQueue,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      setMode,
      setRepeat,
      cycleRepeat,
      stop,
      jumpToTrack,
      removeFromQueue,
      removeFromQueueById,
      reorderQueue,
      moveQueueItem,
      addToQueue,
      addNext,
      addMultipleToQueue,
      clearManualQueue,
      clearHistory,
      getUpcomingTracks,
    }),
    [
      currentTrack,
      queue,
      index,
      mode,
      repeat,
      isPlaying,
      duration,
      position,
      volume,
      history,
      preloadedIds,
      preloadCount,
      setPreloadCount,
      playTrack,
      playQueue,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      setMode,
      setRepeat,
      cycleRepeat,
      stop,
      jumpToTrack,
      removeFromQueue,
      reorderQueue,
      clearHistory,
      getUpcomingTracks,
    ],
  );


  return (
    <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>
  );
}
