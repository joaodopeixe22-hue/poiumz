import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatTime } from "@/lib/format";

type Song = {
  id: string;
  titulo: string;
  artista: string | null;
  duracao_segundos: number | null;
  storage_path: string;
};

type PlaybackRow = {
  id: boolean;
  is_playing: boolean;
  is_locked: boolean;
  current_song_id: string | null;
  position_seconds: number;
  volume: number;
  updated_at: string;
};

const BUCKET = "songs";

export function RadioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playback, setPlayback] = useState<PlaybackRow | null>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [localPlaying, setLocalPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Carrega estado inicial e assina realtime
  useEffect(() => {
    let mounted = true;
    supabase
      .from("playback_state")
      .select("*")
      .eq("id", true)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted && data) setPlayback(data as PlaybackRow);
      });

    const channel = supabase
      .channel("playback-state")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "playback_state" },
        (payload) => {
          setPlayback(payload.new as PlaybackRow);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Quando muda a música, busca metadados + URL
  useEffect(() => {
    if (!playback?.current_song_id) {
      setSong(null);
      setAudioUrl(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("songs")
      .select("id, titulo, artista, duracao_segundos, storage_path")
      .eq("id", playback.current_song_id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setSong(data as Song);
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.storage_path);
        setAudioUrl(pub.publicUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [playback?.current_song_id]);

  const onTogglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (audio.paused) {
      try {
        await audio.play();
        setLocalPlaying(true);
      } catch {
        // navegador bloqueou autoplay — usuário precisa clicar
      }
    } else {
      audio.pause();
      setLocalPlaying(false);
    }
  };

  const onToggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    setMuted(a.muted);
  };

  const isOnAir = !!playback?.is_playing && !!song;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/10 pointer-events-none" />

      <div className="relative p-8 md:p-12">
        {/* Status + Logo */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Radio className="size-5 text-primary" />
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Rádio Corporativa
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${
                isOnAir ? "bg-red-500 animate-pulse" : "bg-muted-foreground/40"
              }`}
              aria-hidden
            />
            <span className="text-xs font-mono uppercase tracking-widest">
              {isOnAir ? "no ar" : "fora do ar"}
            </span>
          </div>
        </div>

        {/* Música atual */}
        <div className="mb-10">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Tocando agora
          </p>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-2">
            {song?.titulo ?? "Aguardando programação"}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground">
            {song?.artista ?? "—"}
          </p>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-6">
          <button
            onClick={onTogglePlay}
            disabled={!audioUrl}
            className="size-16 md:size-20 rounded-full bg-primary text-primary-foreground grid place-items-center hover:scale-105 transition-transform shadow-xl shadow-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={localPlaying ? "Pausar" : "Tocar"}
          >
            {localPlaying ? (
              <Pause className="size-7" />
            ) : (
              <Play className="size-7 translate-x-0.5" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2 font-mono text-xs text-muted-foreground tabular-nums">
              <span>{formatTime(position)}</span>
              <span>{formatTime(duration || song?.duracao_segundos)}</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: duration ? `${(position / duration) * 100}%` : "0%",
                }}
              />
            </div>
          </div>

          <button
            onClick={onToggleMute}
            className="size-10 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label={muted ? "Tirar mudo" : "Mutar"}
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
        </div>

        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onEnded={() => setLocalPlaying(false)}
          />
        )}
      </div>
    </div>
  );
}
