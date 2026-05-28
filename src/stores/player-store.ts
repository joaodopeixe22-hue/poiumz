import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  cover_url?: string;
  src?: string;
};

export type RepeatMode = "off" | "all" | "one";
export type PlaybackState = "idle" | "playing" | "paused" | "loading";

export type EqProfile = "flat" | "bass_boost" | "vocal" | "focus" | "cinema" | "custom";
export interface EqSettings {
  bass: number; // -12..12 dB
  mid: number;
  treble: number;
  boost: number; // 1..2
  profile: EqProfile;
}

export interface PlayerDevice {
  id: string;
  name: string;
  type: "desktop" | "mobile" | "tablet" | "web";
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  history: Track[];
  position: number;
  playbackState: PlaybackState;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  crossfade: 0 | 2 | 5 | 10;
  eq: EqSettings;
  currentDevice: PlayerDevice | null;

  // actions
  setCurrentTrack: (track: Track | null) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setPosition: (pos: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setRepeat: (r: RepeatMode) => void;
  toggleShuffle: () => void;
  setCrossfade: (n: 0 | 2 | 5 | 10) => void;
  setEq: (eq: Partial<EqSettings>) => void;
  enqueue: (t: Track | Track[]) => void;
  playNext: (t: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  next: () => void;
  prev: () => void;
  setDevice: (d: PlayerDevice | null) => void;
}

const defaultEq: EqSettings = {
  bass: 0,
  mid: 0,
  treble: 0,
  boost: 1,
  profile: "flat",
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      history: [],
      position: 0,
      playbackState: "idle",
      volume: 0.8,
      muted: false,
      repeat: "off",
      shuffle: false,
      crossfade: 0,
      eq: defaultEq,
      currentDevice: null,

      setCurrentTrack: (track) =>
        set({ currentTrack: track, position: 0, playbackState: track ? "loading" : "idle" }),
      play: () => set({ playbackState: "playing" }),
      pause: () => set({ playbackState: "paused" }),
      toggle: () =>
        set((s) => ({
          playbackState: s.playbackState === "playing" ? "paused" : "playing",
        })),
      setPosition: (pos) => set({ position: pos }),
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)), muted: false }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      setRepeat: (r) => set({ repeat: r }),
      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
      setCrossfade: (n) => set({ crossfade: n }),
      setEq: (eq) => set((s) => ({ eq: { ...s.eq, ...eq } })),

      enqueue: (t) =>
        set((s) => ({
          queue: [...s.queue, ...(Array.isArray(t) ? t : [t])],
        })),
      playNext: (t) =>
        set((s) => ({
          queue: [t, ...s.queue],
        })),
      removeFromQueue: (index) => set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })),
      reorderQueue: (from, to) =>
        set((s) => {
          const next = [...s.queue];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          return { queue: next };
        }),
      clearQueue: () => set({ queue: [] }),

      next: () => {
        const { queue, currentTrack, history, repeat } = get();
        if (repeat === "one" && currentTrack) {
          set({ position: 0, playbackState: "playing" });
          return;
        }
        if (queue.length === 0) {
          if (repeat === "all" && history.length > 0) {
            const replay = [...history].reverse();
            set({
              currentTrack: replay[0],
              queue: replay.slice(1),
              history: [],
              position: 0,
              playbackState: "playing",
            });
          } else {
            set({ playbackState: "idle", position: 0 });
          }
          return;
        }
        const [head, ...rest] = queue;
        set({
          currentTrack: head,
          queue: rest,
          history: currentTrack ? [...history, currentTrack].slice(-50) : history,
          position: 0,
          playbackState: "playing",
        });
      },
      prev: () => {
        const { history, currentTrack, queue } = get();
        if (history.length === 0) {
          set({ position: 0 });
          return;
        }
        const prevTrack = history[history.length - 1];
        set({
          currentTrack: prevTrack,
          history: history.slice(0, -1),
          queue: currentTrack ? [currentTrack, ...queue] : queue,
          position: 0,
          playbackState: "playing",
        });
      },
      setDevice: (d) => set({ currentDevice: d }),
    }),
    {
      name: "aethel-player",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage),
      ),
      partialize: (s) => ({
        volume: s.volume,
        muted: s.muted,
        repeat: s.repeat,
        shuffle: s.shuffle,
        crossfade: s.crossfade,
        eq: s.eq,
        currentTrack: s.currentTrack,
        queue: s.queue,
        history: s.history,
        position: s.position,
      }),
    },
  ),
);
