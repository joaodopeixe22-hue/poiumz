import { create } from "zustand";

export type CurrentSong = {
  id: string;
  titulo: string;
  artista: string | null;
  duracao_segundos: number | null;
  storage_path: string;
};

interface PlayerState {
  currentSong: CurrentSong | null;
  isPlaying: boolean;
  position: number;
  volume: number;
  setCurrentSong: (s: CurrentSong | null) => void;
  setIsPlaying: (b: boolean) => void;
  setPosition: (n: number) => void;
  setVolume: (n: number) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentSong: null,
  isPlaying: false,
  position: 0,
  volume: 0.8,
  setCurrentSong: (s) => set({ currentSong: s, position: 0 }),
  setIsPlaying: (b) => set({ isPlaying: b }),
  setPosition: (n) => set({ position: n }),
  setVolume: (n) => set({ volume: Math.max(0, Math.min(1, n)) }),
}));
