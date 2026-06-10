import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Radio, Megaphone, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatTime } from "@/lib/format";
import { usePlayback, computeLivePosition } from "@/hooks/use-playback";
import { useRadioSettings } from "@/hooks/use-radio-settings";

type CurrentItem = {
  kind: "song" | "institutional";
  id: string;
  titulo: string;
  artista: string | null;
  duracao_segundos: number | null;
  storage_path: string;
};

const SONG_BUCKET = "songs";
const INSTITUTIONAL_BUCKET = "institutional";

const FADE_IN_SECONDS = 0.6;
const FADE_OUT_SECONDS = 0.4;
const TRACK_CHANGE_FADE = 0.35;

export function RadioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { playback, next } = usePlayback();
  const { settings } = useRadioSettings();
  const [current, setCurrent] = useState<CurrentItem | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [localPlaying, setLocalPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [livePos, setLivePos] = useState(0);
  const advancingRef = useRef(false);

  // Web Audio graph: source -> compressor (normalização perceptual) -> gain (fade) -> destination
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const targetVolumeRef = useRef<number>(0.8);

  const targetVolume = () => {
    const defaultVol = settings?.default_volume ?? 80;
    return Math.max(0, Math.min(1, defaultVol / 100));
  };

  const ensureAudioGraph = () => {
    const a = audioRef.current;
    if (!a) return null;
    if (!audioCtxRef.current) {
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        const ctx = new Ctx();
        const source = ctx.createMediaElementSource(a);
        // Compressor com configuração de "loudness leveling":
        // ataque rápido, release moderado, ratio alto para domar picos entre faixas
        // e makeup gain (via post-gain) compensa a redução geral.
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 24;
        compressor.ratio.value = 6;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.25;
        const gain = ctx.createGain();
        gain.gain.value = 0; // começa em silêncio para fade-in
        source.connect(compressor);
        compressor.connect(gain);
        gain.connect(ctx.destination);
        audioCtxRef.current = ctx;
        sourceRef.current = source;
        compressorRef.current = compressor;
        gainRef.current = gain;
      } catch {
        return null;
      }
    }
    return audioCtxRef.current;
  };

  const fadeTo = (value: number, seconds: number) => {
    const ctx = audioCtxRef.current;
    const gain = gainRef.current;
    if (!ctx || !gain) return;
    const now = ctx.currentTime;
    const current = gain.gain.value;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(current, now);
      // rampa exponencial soa mais natural; precisa de valor > 0
      const safeTarget = Math.max(0.0001, value);
      const safeCurrent = Math.max(0.0001, current);
      gain.gain.setValueAtTime(safeCurrent, now);
      gain.gain.exponentialRampToValueAtTime(safeTarget, now + seconds);
      if (value <= 0.0001) {
        gain.gain.setValueAtTime(0, now + seconds);
      }
    } catch {
      gain.gain.value = value;
    }
  };

  // Resolve o item atual e gera URL pública
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (playback?.current_institutional_id) {
        const { data } = await supabase
          .from("institutional_contents")
          .select("id, titulo, tipo, duracao_segundos, storage_path")
          .eq("id", playback.current_institutional_id)
          .maybeSingle();
        if (cancelled || !data) return;
        const { data: pub } = supabase.storage
          .from(INSTITUTIONAL_BUCKET)
          .getPublicUrl(data.storage_path);
        setCurrent({
          kind: "institutional",
          id: data.id,
          titulo: data.titulo,
          artista: data.tipo === "vinheta" ? "Vinheta institucional" : "Aviso",
          duracao_segundos: data.duracao_segundos,
          storage_path: data.storage_path,
        });
        setAudioUrl(pub.publicUrl);
      } else if (playback?.current_song_id) {
        const { data } = await supabase
          .from("songs")
          .select("id, titulo, artista, duracao_segundos, storage_path")
          .eq("id", playback.current_song_id)
          .maybeSingle();
        if (cancelled || !data) return;
        const { data: pub } = supabase.storage
          .from(SONG_BUCKET)
          .getPublicUrl(data.storage_path);
        setCurrent({
          kind: "song",
          id: data.id,
          titulo: data.titulo,
          artista: data.artista,
          duracao_segundos: data.duracao_segundos,
          storage_path: data.storage_path,
        });
        setAudioUrl(pub.publicUrl);
      } else {
        setCurrent(null);
        setAudioUrl(null);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [playback?.current_song_id, playback?.current_institutional_id]);

  // Quando muda o item OU started_at, sincroniza o elemento <audio>
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;
    const targetSrc = audioUrl;
    const srcChanged = a.src !== targetSrc;
    const applySrcAndPlay = () => {
      if (srcChanged) {
        a.src = targetSrc;
      }
      const pos = computeLivePosition(playback);
      if (Math.abs(a.currentTime - pos) > 1.5) {
        try {
          a.currentTime = pos;
        } catch {
          // ignore
        }
      }
      if (playback?.is_playing) {
        // garante volume base no elemento; o gain controla o fade
        a.volume = 1;
        ensureAudioGraph();
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
        a.play()
          .then(() => {
            setLocalPlaying(true);
            targetVolumeRef.current = targetVolume();
            fadeTo(targetVolumeRef.current, srcChanged ? TRACK_CHANGE_FADE : FADE_IN_SECONDS);
          })
          .catch(() => {
            setLocalPlaying(false);
          });
      } else {
        // fade-out e então pausa
        fadeTo(0, FADE_OUT_SECONDS);
        window.setTimeout(() => {
          a.pause();
          setLocalPlaying(false);
        }, FADE_OUT_SECONDS * 1000 + 50);
      }
    };

    if (srcChanged && !a.paused) {
      // troca de faixa em pleno ar: fade-out curto antes de trocar o src
      fadeTo(0, TRACK_CHANGE_FADE);
      window.setTimeout(applySrcAndPlay, TRACK_CHANGE_FADE * 1000 + 30);
    } else {
      applySrcAndPlay();
    }
  }, [audioUrl, playback?.is_playing, playback?.started_at, playback]);

  // Aplica volume padrão das configurações: ajusta o alvo do gain
  useEffect(() => {
    targetVolumeRef.current = targetVolume();
    if (playback?.is_playing && gainRef.current) {
      fadeTo(targetVolumeRef.current, 0.3);
    }
  }, [playback?.is_playing, settings?.default_volume]);

  // Tick local para barra de progresso + auto-avanço
  useEffect(() => {
    const id = setInterval(() => {
      const pos = computeLivePosition(playback);
      setLivePos(pos);
      const dur = current?.duracao_segundos ?? null;
      if (
        playback?.is_playing &&
        dur &&
        pos >= dur - 0.3 &&
        !advancingRef.current
      ) {
        advancingRef.current = true;
        next({
          expectedSong: playback.current_song_id ?? undefined,
          expectedInstitutional: playback.current_institutional_id ?? undefined,
        }).finally(() => {
          setTimeout(() => {
            advancingRef.current = false;
          }, 1500);
        });
      }
    }, 500);
    return () => clearInterval(id);
  }, [playback, current?.duracao_segundos, next]);

  const handleManualPlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      ensureAudioGraph();
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") {
        await ctx.resume();
      }
      a.volume = 1;
      a.currentTime = computeLivePosition(playback);
      await a.play();
      setLocalPlaying(true);
      targetVolumeRef.current = targetVolume();
      fadeTo(targetVolumeRef.current, FADE_IN_SECONDS);
    } catch {
      // ignore
    }
  };

  const onToggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    setMuted(a.muted);
  };

  const isOnAir = !!playback?.is_playing && !!current;
  const dur = current?.duracao_segundos ?? 0;
  const progressPct = dur ? Math.min(100, (livePos / dur) * 100) : 0;

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
          <div className="flex items-center gap-3">
            {playback?.is_locked && (
              <span className="flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-yellow-500">
                <Lock className="size-3" /> travada
              </span>
            )}
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
          <div className="flex items-center gap-2 mb-3">
            {current?.kind === "institutional" ? (
              <Megaphone className="size-3.5 text-yellow-500" />
            ) : null}
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {current?.kind === "institutional" ? "Mensagem institucional" : "Tocando agora"}
            </p>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-2">
            {current?.titulo ?? "Aguardando programação"}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground">
            {current?.artista ?? "—"}
          </p>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-6">
          <button
            onClick={handleManualPlay}
            disabled={!audioUrl || !playback?.is_playing}
            className="size-16 md:size-20 rounded-full bg-primary text-primary-foreground grid place-items-center hover:scale-105 transition-transform shadow-xl shadow-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Tocar"
            title={
              !playback?.is_playing
                ? "Aguardando o operador iniciar a transmissão"
                : localPlaying
                  ? "No ar"
                  : "Tocar"
            }
          >
            {localPlaying ? (
              <Pause className="size-7" />
            ) : (
              <Play className="size-7 translate-x-0.5" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2 font-mono text-xs text-muted-foreground tabular-nums">
              <span>{formatTime(livePos)}</span>
              <span>{formatTime(dur)}</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  current?.kind === "institutional" ? "bg-yellow-500" : "bg-primary"
                }`}
                style={{ width: `${progressPct}%` }}
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

        <audio
          ref={audioRef}
          preload="auto"
          crossOrigin="anonymous"
          onLoadedMetadata={() => {
            const a = audioRef.current;
            if (!a) return;
            const pos = computeLivePosition(playback);
            try {
              if (Math.abs(a.currentTime - pos) > 1) a.currentTime = pos;
            } catch {
              // ignore
            }
            // o elemento fica em volume cheio; o GainNode controla volume + fades
            a.volume = 1;
          }}
        />
      </div>
    </div>
  );
}
