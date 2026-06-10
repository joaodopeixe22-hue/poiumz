import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  X,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  Music2,
  Shuffle,
  Radio,
  ListMusic,
  Repeat,
  Repeat1,
  ListVideo,
  Zap,
  Trash2,
  Check,
} from "lucide-react";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type { PlayerMode, PreloadCount } from "@/contexts/AudioPlayerContext";
import { formatTime } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


type DocumentPiP = {
  requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window>;
  window: Window | null;
};

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPiP;
  }
}

export function GlobalPlayerBar() {
  const {
    currentTrack,
    queue,
    index,
    mode,
    repeat,
    isPlaying,
    duration,
    position,
    volume,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    setMode,
    cycleRepeat,
    stop,
  } = useAudioPlayer();
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const lastVolumeRef = useRef(volume);

  const pipSupported =
    typeof window !== "undefined" && "documentPictureInPicture" in window;

  // Media Session API — controls via OS / lockscreen / media keys
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.titulo,
      artist: currentTrack.artista ?? "",
    });
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    const handlers: Array<[MediaSessionAction, () => void]> = [
      ["play", () => void toggle()],
      ["pause", () => void toggle()],
      ["previoustrack", () => void prev()],
      ["nexttrack", () => void next()],
      ["seekbackward", () => seek(Math.max(0, position - 10))],
      ["seekforward", () => seek(Math.min(duration, position + 10))],
    ];
    for (const [a, h] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(a, h);
      } catch {
        /* ignore unsupported */
      }
    }
  }, [currentTrack, isPlaying, toggle, prev, next, seek, position, duration]);

  // Esc to close expanded view
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
      if (e.key === " ") {
        e.preventDefault();
        void toggle();
      }
      if (e.key === "ArrowRight") seek(Math.min(duration, position + 5));
      if (e.key === "ArrowLeft") seek(Math.max(0, position - 5));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, toggle, seek, position, duration]);

  if (!currentTrack) return null;

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const hasPrev = mode === "playlist" ? index > 0 || repeat === "all" : true;
  const hasNext =
    mode === "playlist"
      ? index < queue.length - 1 || repeat === "all"
      : mode === "shuffle"
        ? queue.length > 1
        : true;

  const cycleMode = () => {
    const order: PlayerMode[] = ["playlist", "shuffle", "radio"];
    const i = order.indexOf(mode);
    setMode(order[(i + 1) % order.length]);
  };

  const modeMeta: Record<PlayerMode, { label: string; Icon: typeof Shuffle }> = {
    playlist: { label: "Playlist", Icon: ListMusic },
    shuffle: { label: "Aleatório", Icon: Shuffle },
    radio: { label: "Rádio", Icon: Radio },
  };

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(ratio * duration);
  };

  const toggleMute = () => {
    if (muted || volume === 0) {
      setVolume(lastVolumeRef.current || 0.8);
      setMuted(false);
    } else {
      lastVolumeRef.current = volume;
      setVolume(0);
      setMuted(true);
    }
  };

  const togglePiP = async () => {
    if (!pipSupported) return;
    const pip = window.documentPictureInPicture!;
    if (pip.window) {
      pip.window.close();
      setPipActive(false);
      return;
    }
    try {
      const pipWin = await pip.requestWindow({ width: 380, height: 140 });
      // Copy styles into the PiP window
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const css = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
          const style = pipWin.document.createElement("style");
          style.textContent = css;
          pipWin.document.head.appendChild(style);
        } catch {
          if (sheet.href) {
            const link = pipWin.document.createElement("link");
            link.rel = "stylesheet";
            link.href = sheet.href;
            pipWin.document.head.appendChild(link);
          }
        }
      }
      pipWin.document.body.className = document.body.className;
      pipWin.document.body.style.margin = "0";
      const root = pipWin.document.createElement("div");
      pipWin.document.body.appendChild(root);
      // Simple inline UI inside PiP, controls dispatched back to main window
      const render = () => {
        const trk = currentTrack;
        root.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:8px;padding:14px;font-family:inherit;background:hsl(var(--card,0 0% 100%));color:hsl(var(--foreground,0 0% 10%));height:100vh;box-sizing:border-box;">
            <div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${trk?.titulo ?? ""}</div>
            <div style="font-size:12px;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${trk?.artista ?? ""}</div>
            <div style="display:flex;gap:8px;justify-content:center;margin-top:auto;">
              <button id="pip-prev" style="padding:6px 10px;border-radius:6px;border:1px solid #8884;background:transparent;cursor:pointer;">⏮</button>
              <button id="pip-play" style="padding:6px 14px;border-radius:6px;border:1px solid #8884;background:transparent;cursor:pointer;">${isPlaying ? "⏸" : "▶"}</button>
              <button id="pip-next" style="padding:6px 10px;border-radius:6px;border:1px solid #8884;background:transparent;cursor:pointer;">⏭</button>
            </div>
          </div>`;
        pipWin.document.getElementById("pip-prev")?.addEventListener("click", () => void prev());
        pipWin.document.getElementById("pip-next")?.addEventListener("click", () => void next());
        pipWin.document.getElementById("pip-play")?.addEventListener("click", () => void toggle());
      };
      render();
      pipWin.addEventListener("pagehide", () => setPipActive(false));
      setPipActive(true);
    } catch (e) {
      console.error("[pip] failed", e);
    }
  };

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <>
      <div className="sticky bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl">
        <div className="px-4 md:px-6 py-3 flex items-center gap-4">
          <div className="min-w-0 flex-1 max-w-xs flex items-center gap-3">
            <div className="size-10 rounded-md bg-gradient-to-br from-primary/30 to-primary/10 grid place-items-center shrink-0">
              <Music2 className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{currentTrack.titulo}</p>
              <p className="text-xs text-muted-foreground truncate">
                {currentTrack.artista ?? "—"}
                {queue.length > 1 && ` · ${index + 1}/${queue.length}`}
              </p>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center gap-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                disabled={!hasPrev}
                className="size-8 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                aria-label="Anterior"
                title="Anterior"
              >
                <SkipBack className="size-4" />
              </button>
              <button
                onClick={toggle}
                className="size-10 rounded-full grid place-items-center bg-primary text-primary-foreground hover:scale-105 transition-transform shadow"
                aria-label={isPlaying ? "Pausar" : "Tocar"}
                title={isPlaying ? "Pausar (espaço)" : "Tocar (espaço)"}
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
                title="Próxima"
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

          <div className="flex items-center gap-1">
            <button
              onClick={cycleRepeat}
              className={`size-8 rounded-md grid place-items-center transition-colors ${
                repeat === "off"
                  ? "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  : "text-primary bg-primary/10 hover:bg-primary/15"
              }`}
              aria-label={
                repeat === "off"
                  ? "Repetir: desativado"
                  : repeat === "all"
                    ? "Repetir: fila contínua"
                    : "Repetir: faixa atual"
              }
              title={
                repeat === "off"
                  ? "Repetir: desativado (clique para fila contínua)"
                  : repeat === "all"
                    ? "Repetir: fila contínua (clique para repetir faixa)"
                    : "Repetir: faixa atual (clique para desativar)"
              }
            >
              {repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
            </button>
            <button
              onClick={cycleMode}
              className={`hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium border transition-colors ${
                mode === "playlist"
                  ? "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                  : "border-primary/40 text-primary bg-primary/10 hover:bg-primary/15"
              }`}
              aria-label={`Modo: ${modeMeta[mode].label}. Clique para alternar`}
              title={`Modo: ${modeMeta[mode].label} (clique para alternar)`}
            >
              {(() => {
                const I = modeMeta[mode].Icon;
                return <I className="size-3.5" />;
              })()}
              <span>{modeMeta[mode].label}</span>
            </button>
            <div className="hidden md:flex items-center gap-2 mr-1">
              <button
                onClick={toggleMute}
                className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label={muted ? "Tirar mudo" : "Mutar"}
                title={muted ? "Tirar mudo" : "Mutar"}
              >
                <VolumeIcon className="size-4" />
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
            {pipSupported && (
              <button
                onClick={togglePiP}
                className={`size-8 rounded-md grid place-items-center hover:bg-secondary transition-colors ${pipActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                aria-label="Picture-in-Picture"
                title="Picture-in-Picture"
              >
                <PictureInPicture2 className="size-4" />
              </button>
            )}
            <button
              onClick={() => setExpanded(true)}
              className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Expandir player"
              title="Expandir"
            >
              <Maximize2 className="size-4" />
            </button>
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
      </div>

      {expanded && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col">
          <div className="flex items-center justify-between p-4">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Tocando agora
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="size-9 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Recolher"
              title="Recolher (Esc)"
            >
              <Minimize2 className="size-5" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
            <div className="size-64 max-w-[60vw] aspect-square rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent grid place-items-center shadow-xl">
              <Music2 className="size-24 text-primary/60" />
            </div>
            <div className="text-center max-w-xl">
              <h2 className="text-2xl md:text-3xl font-semibold truncate">
                {currentTrack.titulo}
              </h2>
              <p className="text-muted-foreground mt-1 truncate">
                {currentTrack.artista ?? "—"}
                {queue.length > 1 && ` · faixa ${index + 1} de ${queue.length}`}
              </p>
            </div>
            <div className="w-full max-w-xl flex flex-col gap-2">
              <div
                onClick={onSeek}
                className="h-2 bg-border rounded-full overflow-hidden cursor-pointer group"
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
              <div className="flex justify-between font-mono text-xs text-muted-foreground tabular-nums">
                <span>{formatTime(position)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <button
                onClick={prev}
                disabled={!hasPrev}
                className="size-12 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 transition-colors"
                aria-label="Anterior"
              >
                <SkipBack className="size-6" />
              </button>
              <button
                onClick={toggle}
                className="size-16 rounded-full grid place-items-center bg-primary text-primary-foreground hover:scale-105 transition-transform shadow-lg"
                aria-label={isPlaying ? "Pausar" : "Tocar"}
              >
                {isPlaying ? (
                  <Pause className="size-7" />
                ) : (
                  <Play className="size-7 translate-x-0.5" />
                )}
              </button>
              <button
                onClick={next}
                disabled={!hasNext}
                className="size-12 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 transition-colors"
                aria-label="Próxima"
              >
                <SkipForward className="size-6" />
              </button>
            </div>
            <div className="flex items-center gap-3 w-full max-w-xs">
              <button
                onClick={toggleMute}
                className="size-9 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label={muted ? "Tirar mudo" : "Mutar"}
              >
                <VolumeIcon className="size-4" />
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
                className="flex-1 accent-primary"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
