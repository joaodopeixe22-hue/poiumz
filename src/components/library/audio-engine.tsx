import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/stores/player-store";
import { useServerFn } from "@tanstack/react-start";
import { getTrackSignedUrl } from "@/lib/library.functions";

/**
 * Mounts a hidden <audio> element wired to the player store.
 * Resolves signed URLs lazily for queued tracks (which only carry id).
 */
export function AudioEngine() {
  const ref = useRef<HTMLAudioElement>(null);
  const track = usePlayerStore((s) => s.currentTrack);
  const playbackState = usePlayerStore((s) => s.playbackState);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const setPosition = usePlayerStore((s) => s.setPosition);
  const next = usePlayerStore((s) => s.next);
  const setCurrent = usePlayerStore((s) => s.setCurrentTrack);
  const play = usePlayerStore((s) => s.play);

  const signFn = useServerFn(getTrackSignedUrl);
  const loadedId = useRef<string | null>(null);

  // Resolve src for track if missing
  useEffect(() => {
    if (!track) {
      loadedId.current = null;
      return;
    }
    if (track.src) return;
    let cancelled = false;
    signFn({ data: { id: track.id } })
      .then(({ url }) => {
        if (cancelled) return;
        setCurrent({ ...track, src: url });
        play();
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [track, signFn, setCurrent, play]);

  // Load + play/pause
  useEffect(() => {
    const el = ref.current;
    if (!el || !track?.src) return;
    if (loadedId.current !== track.id) {
      loadedId.current = track.id;
      el.src = track.src;
      el.load();
    }
    if (playbackState === "playing") {
      el.play().catch(() => {});
    } else if (playbackState === "paused") {
      el.pause();
    }
  }, [track?.id, track?.src, playbackState]);

  // Volume / mute
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
  }, [volume, muted]);

  return (
    <audio
      ref={ref}
      onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
      onEnded={() => next()}
      preload="auto"
    />
  );
}
