import { useContext } from "react";
import { AudioPlayerContext } from "@/contexts/AudioPlayerContext";

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error("useAudioPlayer deve estar dentro de <AudioPlayerProvider>");
  }
  return ctx;
}

export type { AudioTrack } from "@/contexts/AudioPlayerContext";
