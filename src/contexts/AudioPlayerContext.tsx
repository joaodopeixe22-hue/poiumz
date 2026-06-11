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
  insertAsNext,
  insertMultipleAfterCurrent,
  appendToQueue,
  clearManual,
} from "@/lib/playback-queue";
import {
  type SmartMixSettings,
  type TrackKind,
  DEFAULT_SMART_MIX,
  equalPowerGains,
  loadSmartMixSettings,
  saveSmartMixSettings,
  shouldCrossfade,
  normalizeSettings,
} from "@/lib/smart-mix";

export type AudioTrack = {
  id: string;
  titulo: string;
  artista: string | null;
  duracao_segundos: number | null;
  storage_path?: string;
  url?: string;
  sourcePlaylistId?: string | null;
  manuallyQueued?: boolean;
  /** Smart Mix classification — defaults to 'music' when omitted. */
  kind?: TrackKind;
};

export type PlayerMode = "playlist" | "shuffle" | "radio";
export type RepeatMode = "off" | "all" | "one";
export type PreloadCount = 2 | 3 | 4 | 5;
export type HistoryItem = AudioTrack & { playedAt: number };
/**
 * Origem da reprodução ativa.
 * - `radio`: o player espelha playback_state e NÃO decide reprodução localmente.
 *   Consumidores devem checar `playbackSource === 'radio'` antes de operar.
 * - `playlist` | `library`: comportamento padrão controlado pelo contexto.
 */
export type PlaybackSource = "radio" | "playlist" | "library";

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
  playbackSource: PlaybackSource;
  setPlaybackSource: (s: PlaybackSource) => void;
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
  /** Shuffle profissional (estilo Spotify): fila pré-embaralhada via
   *  Fisher-Yates, faixa atual preservada, ordem original restaurável. */
  isShuffle: boolean;
  toggleShuffle: () => void;
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
  smartMix: SmartMixSettings;
  setSmartMix: (s: Partial<SmartMixSettings>) => void;
  isCrossfading: boolean;
  /** 0..1 progress of the active crossfade; 0 when idle. */
  crossfadeProgress: number;
  /** Read the override (if any) for a playlist's Smart Mix settings. */
  getPlaylistSmartMix: (
    playlistId: string | null | undefined,
  ) => Partial<SmartMixSettings> | null;
  /** Save or clear (`null`) the per-playlist Smart Mix override. */
  setPlaylistSmartMix: (
    playlistId: string,
    partial: Partial<SmartMixSettings> | null,
  ) => void;
  /** Effective settings = global merged with override. */
  resolveEffectiveSmartMix: (
    playlistId: string | null | undefined,
  ) => SmartMixSettings;
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

// Fisher-Yates (Durstenfeld) — embaralhamento uniforme, sem viés.
// NÃO usar `sort(() => Math.random() - 0.5)`: distribuição enviesada.
function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Constrói a fila embaralhada mantendo a faixa atual no topo, de modo
// que a música em reprodução seja preservada e o restante seja
// embaralhado uniformemente.
function buildShuffleQueue(
  full: AudioTrack[],
  currentId: string | null,
): AudioTrack[] {
  if (full.length <= 1) return full.slice();
  if (!currentId) return fisherYatesShuffle(full);
  const idx = full.findIndex((t) => t.id === currentId);
  if (idx === -1) return fisherYatesShuffle(full);
  const current = full[idx];
  const rest = full.slice(0, idx).concat(full.slice(idx + 1));
  return [current, ...fisherYatesShuffle(rest)];
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
  // Dual audio elements for Smart Mix crossfading.
  // `audioRef` is a facade always pointing at the currently-active element.
  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);
  const activeKeyRef = useRef<"A" | "B">("A");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<AudioTrack[]>([]);
  const indexRef = useRef(0);
  const modeRef = useRef<PlayerMode>("playlist");
  const repeatRef = useRef<RepeatMode>("all");
  const shuffleHistRef = useRef<number[]>([]);

  // Smart Mix crossfade engine state
  const inCrossfadeRef = useRef(false);
  const crossfadeTimerRef = useRef<number | null>(null);
  const smartMixRef = useRef<SmartMixSettings>(DEFAULT_SMART_MIX);
  const [smartMix, setSmartMixState] = useState<SmartMixSettings>(DEFAULT_SMART_MIX);
  const [isCrossfading, setIsCrossfading] = useState(false);
  // Live crossfade progress in [0..1]; 0 when no crossfade is active.
  const [crossfadeProgress, setCrossfadeProgress] = useState(0);
  // Per-playlist Smart Mix overrides; loaded lazily as playlists touch them.
  const playlistOverridesRef = useRef<Map<string, Partial<SmartMixSettings>>>(
    new Map(),
  );

  // Sync: broadcast channel + echo guard
  const channelRef = useRef<RealtimeChannel | null>(null);
  const echoRef = useRef(false);

  // Restore persisted queue/index/mode/history from localStorage
  const persisted = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("global-player-state");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        queue?: AudioTrack[];
        index?: number;
        mode?: PlayerMode;
        history?: HistoryItem[];
        isShuffle?: boolean;
        originalQueue?: AudioTrack[];
      };
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const [queue, setQueue] = useState<AudioTrack[]>(
    () => (Array.isArray(persisted?.queue) ? (persisted!.queue as AudioTrack[]) : []),
  );
  const [index, setIndex] = useState(
    () => (typeof persisted?.index === "number" ? persisted!.index : 0),
  );
  const [mode, setModeState] = useState<PlayerMode>(
    // Migração: o modo legado "shuffle" foi substituído pelo isShuffle
    // independente; coerce para "playlist" e mantém isShuffle on abaixo.
    () => (persisted?.mode === "radio" ? "radio" : "playlist"),
  );
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

  const [history, setHistory] = useState<HistoryItem[]>(
    () => (Array.isArray(persisted?.history) ? (persisted!.history as HistoryItem[]) : []),
  );
  const [preloadCount, setPreloadCountState] = useState<PreloadCount>(() => {
    if (typeof window === "undefined") return 3;
    const n = Number(localStorage.getItem("global-player-preload-count"));
    return n === 2 || n === 3 || n === 4 || n === 5 ? (n as PreloadCount) : 3;
  });
  const [preloadedIds, setPreloadedIds] = useState<Set<string>>(new Set());
  const preloadedAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [playbackSource, setPlaybackSource] = useState<PlaybackSource>("library");
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

  // === Shuffle profissional (estilo Spotify) =================================
  // Fila pré-embaralhada (Fisher-Yates) + snapshot da ordem original para
  // restauração. Sem ciclo prematuro: a fila ativa cobre todas as faixas
  // exatamente uma vez antes de qualquer repetição.
  const [isShuffle, setIsShuffleState] = useState<boolean>(
    () => persisted?.isShuffle === true || persisted?.mode === "shuffle",
  );
  const isShuffleRef = useRef(isShuffle);
  const originalQueueRef = useRef<AudioTrack[]>(
    Array.isArray(persisted?.originalQueue)
      ? (persisted!.originalQueue as AudioTrack[])
      : [],
  );
  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);

  // Load persisted Smart Mix settings on mount
  useEffect(() => {
    const s = loadSmartMixSettings();
    smartMixRef.current = s;
    setSmartMixState(s);
  }, []);

  const setSmartMix = useCallback((partial: Partial<SmartMixSettings>) => {
    const next = normalizeSettings({ ...smartMixRef.current, ...partial });
    smartMixRef.current = next;
    setSmartMixState(next);
    saveSmartMixSettings(next);
  }, []);

  // --- Per-playlist Smart Mix overrides (localStorage-backed) ---------------
  const playlistKey = (id: string) => `global-player-smartmix-playlist:${id}`;

  const getPlaylistSmartMix = useCallback(
    (playlistId: string | null | undefined): Partial<SmartMixSettings> | null => {
      if (!playlistId) return null;
      const cached = playlistOverridesRef.current.get(playlistId);
      if (cached) return { ...cached };
      if (typeof window === "undefined") return null;
      try {
        const raw = window.localStorage.getItem(playlistKey(playlistId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<SmartMixSettings>;
        playlistOverridesRef.current.set(playlistId, parsed);
        return { ...parsed };
      } catch {
        return null;
      }
    },
    [],
  );

  const setPlaylistSmartMix = useCallback(
    (
      playlistId: string,
      partial: Partial<SmartMixSettings> | null,
    ) => {
      if (!playlistId) return;
      if (partial === null) {
        playlistOverridesRef.current.delete(playlistId);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.removeItem(playlistKey(playlistId));
          } catch {
            /* ignore */
          }
        }
        return;
      }
      const prev = playlistOverridesRef.current.get(playlistId) ?? {};
      const merged: Partial<SmartMixSettings> = { ...prev, ...partial };
      // Normalize numeric field if provided
      if (typeof merged.durationSec === "number") {
        merged.durationSec = Math.max(1, Math.min(12, Math.round(merged.durationSec)));
      }
      playlistOverridesRef.current.set(playlistId, merged);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(playlistKey(playlistId), JSON.stringify(merged));
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  /** Merge global Smart Mix settings with any per-playlist override. */
  const resolveEffectiveSmartMix = useCallback(
    (playlistId: string | null | undefined): SmartMixSettings => {
      const base = smartMixRef.current;
      const override = getPlaylistSmartMix(playlistId);
      if (!override) return base;
      return normalizeSettings({ ...base, ...override });
    },
    [getPlaylistSmartMix],
  );



  // Persist queue/index/mode/history/shuffle (debounced via microtask grouping)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mode === "radio") return; // radio is driven by server playback_state
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(
          "global-player-state",
          JSON.stringify({
            queue,
            index,
            mode,
            history,
            isShuffle,
            // Persist a snapshot da ordem original para restaurar pós-reload
            // sem gerar novo shuffle.
            originalQueue: isShuffle ? originalQueueRef.current : [],
          }),
        );
      } catch {
        /* quota or serialization issue — ignore */
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [queue, index, mode, history, isShuffle]);




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

  const getActiveAudio = useCallback(
    () => (activeKeyRef.current === "A" ? audioARef.current : audioBRef.current),
    [],
  );
  const getInactiveAudio = useCallback(
    () => (activeKeyRef.current === "A" ? audioBRef.current : audioARef.current),
    [],
  );

  const abortCrossfade = useCallback(() => {
    if (crossfadeTimerRef.current !== null) {
      window.clearInterval(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
    if (!inCrossfadeRef.current) return;
    inCrossfadeRef.current = false;
    setIsCrossfading(false);
    setCrossfadeProgress(0);
    const inactive = getInactiveAudio();
    if (inactive) {
      try {
        inactive.pause();
        inactive.src = "";
      } catch {
        /* ignore */
      }
    }
    const active = getActiveAudio();
    if (active) active.volume = volume;
  }, [getActiveAudio, getInactiveAudio, volume]);

  const loadAndPlay = useCallback(
    async (track: AudioTrack) => {
      abortCrossfade();
      const a = getActiveAudio();
      if (!a) return;
      try {
        a.volume = volume;
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
    [abortCrossfade, getActiveAudio, pushHistory, pruneAndPreload, volume],
  );

  // Start a Smart Mix crossfade into the track at `nextIndex`.
  // The currently-active element fades out while the inactive element
  // simultaneously fades in with the next track loaded; on completion
  // we swap which element is active and bump the index.
  const startCrossfade = useCallback(
    async (nextIndex: number) => {
      if (inCrossfadeRef.current) return;
      const active = getActiveAudio();
      const inactive = getInactiveAudio();
      const q = queueRef.current;
      const curTrack = q[indexRef.current];
      const nextTrack = q[nextIndex];
      if (!active || !inactive || !nextTrack) return;
      // Effective duration is the per-playlist override (when the current
      // track belongs to a playlist) or the global setting.
      const eff = resolveEffectiveSmartMix(curTrack?.sourcePlaylistId ?? null);
      const dur = eff.durationSec;
      if (dur <= 0) return;

      inCrossfadeRef.current = true;
      setIsCrossfading(true);
      setCrossfadeProgress(0);
      try {
        const url = await resolveTrackUrl(nextTrack);
        inactive.src = url;
        inactive.currentTime = 0;
        inactive.volume = 0;
        await inactive.play();
      } catch (e) {
        console.warn("[smart-mix] crossfade prep failed; falling back", e);
        inCrossfadeRef.current = false;
        setIsCrossfading(false);
        setCrossfadeProgress(0);
        return;
      }

      const startVol = volume;
      const startAt = performance.now();
      let lastProgressSet = 0;
      const tick = () => {
        if (!inCrossfadeRef.current) return;
        const elapsed = (performance.now() - startAt) / 1000;
        const t = Math.min(1, elapsed / dur);
        const g = equalPowerGains(t);
        try {
          active.volume = startVol * g.out;
          inactive.volume = startVol * g.in;
        } catch {
          /* ignore */
        }
        // Throttle progress state to ~25 updates/crossfade instead of one
        // per 50ms tick — UI doesn't need finer granularity.
        if (t - lastProgressSet >= 0.04 || t >= 1) {
          lastProgressSet = t;
          setCrossfadeProgress(t);
        }
        if (t >= 1) {
          if (crossfadeTimerRef.current !== null) {
            window.clearInterval(crossfadeTimerRef.current);
            crossfadeTimerRef.current = null;
          }
          // Finalize swap
          try {
            active.pause();
            active.src = "";
            active.volume = startVol;
          } catch {
            /* ignore */
          }
          inactive.volume = startVol;
          activeKeyRef.current = activeKeyRef.current === "A" ? "B" : "A";
          audioRef.current = inactive;
          setIndex(nextIndex);
          indexRef.current = nextIndex;
          setPosition(inactive.currentTime);
          setDuration(Number.isFinite(inactive.duration) ? inactive.duration : 0);
          pushHistory(nextTrack);
          inCrossfadeRef.current = false;
          setIsCrossfading(false);
          setCrossfadeProgress(0);
          void pruneAndPreload();
        }
      };
      crossfadeTimerRef.current = window.setInterval(tick, 50);
    },
    [
      getActiveAudio,
      getInactiveAudio,
      pushHistory,
      pruneAndPreload,
      resolveEffectiveSmartMix,
      volume,
    ],
  );

  // Dual <audio>; listeners on both, gated by "active" element.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (audioARef.current) return;
    const a = new Audio();
    const b = new Audio();
    a.preload = "auto";
    b.preload = "auto";
    a.volume = volume;
    b.volume = volume;
    audioARef.current = a;
    audioBRef.current = b;
    audioRef.current = a;

    const isActive = (el: HTMLAudioElement) => el === getActiveAudio();

    const tryCrossfade = (el: HTMLAudioElement) => {
      if (!isActive(el)) return;
      if (inCrossfadeRef.current) return;
      if (modeRef.current === "radio") return;
      const dur = el.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      if (repeatRef.current === "one") return; // never crossfade into self
      // Determine next index respecting repeat
      const q = queueRef.current;
      const cur = indexRef.current;
      let nextI = cur + 1;
      if (nextI >= q.length) {
        if (repeatRef.current === "all" && q.length > 0) nextI = 0;
        else return;
      }
      const curTrack = q[cur];
      const nextTrack = q[nextI];
      if (!curTrack || !nextTrack) return;
      // Resolve effective Smart Mix settings (global + per-playlist override
      // for the CURRENT track's source playlist).
      const settings = resolveEffectiveSmartMix(curTrack.sourcePlaylistId ?? null);
      if (!settings.enabled) return;
      const remaining = dur - el.currentTime;
      if (remaining > settings.durationSec + 0.15) return;
      if (remaining <= 0) return;
      if (
        !shouldCrossfade(curTrack.kind, nextTrack.kind, settings, {
          nextIsManual: !!nextTrack.manuallyQueued,
        })
      ) {
        return;
      }
      void startCrossfade(nextI);
    };

    let lastPosSet = 0;
    const bind = (el: HTMLAudioElement) => {
      const onTime = () => {
        if (!isActive(el)) return;
        // Throttle: only update React state if the position changed enough
        // to be visually meaningful. `timeupdate` fires up to ~15Hz and
        // each setPosition rebuilds the memoized context value.
        const cur = el.currentTime;
        if (Math.abs(cur - lastPosSet) >= 0.25 || cur === 0) {
          lastPosSet = cur;
          setPosition(cur);
        }
        tryCrossfade(el);
      };
      const onDur = () => {
        if (!isActive(el)) return;
        setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      };
      const onPlay = () => {
        if (!isActive(el)) return;
        setIsPlaying(true);
      };
      const onPause = () => {
        if (!isActive(el)) return;
        // Don't flip isPlaying off mid-crossfade for the outgoing element
        if (inCrossfadeRef.current) return;
        setIsPlaying(false);
      };
      const onEnded = () => {
        if (!isActive(el)) return;
        if (inCrossfadeRef.current) return; // crossfade handles the swap itself
        void handleEnded();
      };
      const onError = () => {
        if (!isActive(el)) return;
        setIsPlaying(false);
        console.error("[global-player] audio error", el.error?.code, el.src);
        toast.error("Falha ao carregar o áudio.");
      };
      el.addEventListener("timeupdate", onTime);
      el.addEventListener("durationchange", onDur);
      el.addEventListener("loadedmetadata", onDur);
      el.addEventListener("ended", onEnded);
      el.addEventListener("play", onPlay);
      el.addEventListener("pause", onPause);
      el.addEventListener("error", onError);
      return () => {
        el.removeEventListener("timeupdate", onTime);
        el.removeEventListener("durationchange", onDur);
        el.removeEventListener("loadedmetadata", onDur);
        el.removeEventListener("ended", onEnded);
        el.removeEventListener("play", onPlay);
        el.removeEventListener("pause", onPause);
        el.removeEventListener("error", onError);
      };
    };

    const unbindA = bind(a);
    const unbindB = bind(b);

    return () => {
      unbindA();
      unbindB();
      if (crossfadeTimerRef.current !== null) {
        window.clearInterval(crossfadeTimerRef.current);
        crossfadeTimerRef.current = null;
      }
      a.pause();
      b.pause();
      a.src = "";
      b.src = "";
      audioARef.current = null;
      audioBRef.current = null;
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helpers internos para navegação por modo
  // (modo legado "shuffle" removido: agora `isShuffle` independente
  //  embaralha a fila ativa via Fisher-Yates antes da reprodução,
  //  e o advance percorre linearmente — sem repetições prematuras.)

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

  // next / prev / ended — fila ativa percorrida linearmente.
  // Quando `isShuffle` está ligado, a fila já foi pré-embaralhada;
  // andar 1 a 1 garante que cada faixa toca exatamente uma vez antes
  // de qualquer ciclo (sem repetição prematura).
  const advanceNext = useCallback(async () => {
    const m = modeRef.current;
    if (m === "radio") {
      const { error } = await supabase.rpc("advance_playback", {});
      if (error) toast.error(error.message);
      return;
    }
    const q = queueRef.current;
    const ni = indexRef.current + 1;
    if (ni >= q.length) {
      // Fim da fila — em repeat=all com shuffle ligado, gera nova rodada
      // (reshuffle do restante, sem repetir a última imediatamente).
      if (repeatRef.current === "all" && q.length > 0) {
        if (isShuffleRef.current && q.length > 1) {
          const curTrack = q[indexRef.current];
          const original =
            originalQueueRef.current.length > 0
              ? originalQueueRef.current.slice()
              : q.slice();
          const reshuffled = buildShuffleQueue(original, curTrack?.id ?? null);
          // Pula a faixa atual (já tocada) e segue para a próxima da nova
          // rodada — startIndex = 1.
          setQueue(reshuffled);
          queueRef.current = reshuffled;
          await goToIndex(Math.min(1, reshuffled.length - 1));
          return;
        }
        await goToIndex(0);
      }
      return;
    }
    await goToIndex(ni);
  }, [goToIndex]);

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
    // Em shuffle ligado, prev percorre a fila (que já é o histórico real
    // da ordem em que tocou) — não recalcula embaralhamento.
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
    // (modo legado "shuffle" não cai mais aqui; advanceNext cuida do walk)
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
      const startTrack = tracks[i];
      let activeQueue = tracks;
      let activeIndex = i;
      if (isShuffleRef.current && tracks.length > 1) {
        // Snapshot da ordem original (jamais alteramos playlist_songs)
        originalQueueRef.current = tracks.slice();
        activeQueue = buildShuffleQueue(tracks, startTrack.id);
        activeIndex = Math.max(
          0,
          activeQueue.findIndex((t) => t.id === startTrack.id),
        );
      } else if (isShuffleRef.current) {
        originalQueueRef.current = tracks.slice();
      } else {
        originalQueueRef.current = [];
      }
      setQueue(activeQueue);
      setIndex(activeIndex);
      queueRef.current = activeQueue;
      indexRef.current = activeIndex;
      shuffleHistRef.current = [];
      await loadAndPlay(activeQueue[activeIndex]);
      broadcast({
        type: "play_queue",
        tracks: activeQueue,
        index: activeIndex,
        mode: modeRef.current,
      });
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
      abortCrossfade();
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
    [abortCrossfade, broadcast],
  );

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    // During a crossfade the per-element volumes are being ramped by the
    // engine; updating both elements directly would break the ramp. The
    // engine reads the latest user volume on its next tick, so just update
    // the user volume and let the engine catch up.
    if (!inCrossfadeRef.current) {
      if (audioARef.current) audioARef.current.volume = clamped;
      if (audioBRef.current) audioBRef.current.volume = clamped;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("global-player-volume", String(clamped));
    }
  }, []);

  const stop = useCallback(() => {
    abortCrossfade();
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
    // Limpa snapshot do shuffle (preserva a preferência isShuffle do usuário)
    originalQueueRef.current = [];
    broadcast({ type: "stop" });
  }, [abortCrossfade, broadcast]);

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

  // === Shuffle toggle =======================================================
  const toggleShuffle = useCallback(() => {
    const next = !isShuffleRef.current;
    const curTrack = queueRef.current[indexRef.current] ?? null;
    if (next) {
      // Ativar: snapshot da ordem original, embaralha o restante via Fisher-Yates
      if (originalQueueRef.current.length === 0) {
        originalQueueRef.current = queueRef.current.slice();
      }
      const shuffled = buildShuffleQueue(
        originalQueueRef.current,
        curTrack?.id ?? null,
      );
      setQueue(shuffled);
      queueRef.current = shuffled;
      const newIdx = curTrack
        ? Math.max(0, shuffled.findIndex((t) => t.id === curTrack.id))
        : 0;
      setIndex(newIdx);
      indexRef.current = newIdx;
    } else {
      // Desativar: restaura ordem original a partir da música atual
      const original =
        originalQueueRef.current.length > 0
          ? originalQueueRef.current.slice()
          : queueRef.current.slice();
      setQueue(original);
      queueRef.current = original;
      const newIdx = curTrack
        ? Math.max(0, original.findIndex((t) => t.id === curTrack.id))
        : 0;
      setIndex(newIdx);
      indexRef.current = newIdx;
      originalQueueRef.current = [];
    }
    isShuffleRef.current = next;
    setIsShuffleState(next);
    shuffleHistRef.current = [];
    if (typeof window !== "undefined") {
      localStorage.setItem("global-player-shuffle", next ? "1" : "0");
    }
    void pruneAndPreload();
  }, [pruneAndPreload]);

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
      isShuffle,
      toggleShuffle,
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
      smartMix,
      setSmartMix,
      isCrossfading,
      crossfadeProgress,
      getPlaylistSmartMix,
      setPlaylistSmartMix,
      resolveEffectiveSmartMix,
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
      isShuffle,
      toggleShuffle,
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
      smartMix,
      setSmartMix,
      isCrossfading,
      crossfadeProgress,
      getPlaylistSmartMix,
      setPlaylistSmartMix,
      resolveEffectiveSmartMix,
    ],
  );


  return (
    <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>
  );
}
