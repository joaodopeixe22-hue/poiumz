import { useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { formatTime } from "@/lib/format";

export function GlobalPlayerBar() {
  const {
    currentTrack,
    queue,
    index,
    isPlaying,
    duration,
    position,
    volume,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    stop,
  } = useAudioPlayer();
  const [muted, setMuted] = useState(false);

  if (!currentTrack) return null;

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const hasPrev = index > 0;
  const hasNext = index < queue.length - 1;

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(ratio * duration);
  };

  const toggleMute = () => {
    if (muted) {
      setVolume(volume > 0 ? volume : 0.8);
      setMuted(false);
    } else {
      setVolume(0);
      setMuted(true);
    }
  };

  return (
    <div className="sticky bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl">
      <div className="px-4 md:px-6 py-3 flex items-center gap-4">
        <div className="min-w-0 flex-1 max-w-xs">
          <p className="text-sm font-medium truncate">{currentTrack.titulo}</p>
          <p className="text-xs text-muted-foreground truncate">
            {currentTrack.artista ?? "—"}
            {queue.length > 1 && ` · ${index + 1}/${queue.length}`}
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center gap-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              disabled={!hasPrev}
              className="size-8 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              aria-label="Anterior"
            >
              <SkipBack className="size-4" />
            </button>
            <button
              onClick={toggle}
              className="size-10 rounded-full grid place-items-center bg-primary text-primary-foreground hover:scale-105 transition-transform shadow"
              aria-label={isPlaying ? "Pausar" : "Tocar"}
            >
              {isPlaying ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4 translate-x-0.5" />
              )}
            </button>
            <button
              onClick={next}
              disabled={!hasNext}
              className="size-8 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              aria-label="Próxima"
            >
              <SkipForward className="size-4" />
            </button>
          </div>
          <div className="w-full flex items-center gap-2 font-mono text-[10px] text-muted-foreground tabular-nums">
            <span className="w-10 text-right">{formatTime(position)}</span>
            <div
              onClick={onSeek}
              className="flex-1 h-1.5 bg-border rounded-full overflow-hidden cursor-pointer group"
              role="slider"
              aria-valuemin={0}
              aria-valuemax={duration || 0}
              aria-valuenow={position}
            >
              <div
                className="h-full bg-primary transition-all group-hover:bg-primary/90"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label={muted ? "Tirar mudo" : "Mutar"}
          >
            {muted || volume === 0 ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              setMuted(false);
            }}
            className="w-20 accent-primary"
            aria-label="Volume"
          />
        </div>
        <button
          onClick={stop}
          className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Fechar player"
          title="Fechar player"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
