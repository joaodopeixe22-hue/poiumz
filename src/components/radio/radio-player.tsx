import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Radio, Megaphone, Lock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatTime } from "@/lib/format";
import { usePlayback, computeLivePosition } from "@/hooks/use-playback";
import { useRadioSettings } from "@/hooks/use-radio-settings";
import { logRadio } from "@/lib/radio-diagnostics";

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

export function RadioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { playback } = usePlayback();
  const { settings } = useRadioSettings();
  const [current, setCurrent] = useState<CurrentItem | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [localPlaying, setLocalPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [livePos, setLivePos] = useState(0);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);
  const [playlistName, setPlaylistName] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("radioUnlocked") === "1";
  });

  const targetVolume = () => {
    const defaultVol = settings?.default_volume ?? 80;
    return Math.max(0, Math.min(1, defaultVol / 100));
  };

  // Nome da playlist no ar
  useEffect(() => {
    let cancelled = false;
    const pid = playback?.active_playlist_id;
    if (!pid) {
      setPlaylistName(null);
      return;
    }
    supabase
      .from("playlists")
      .select("nome")
      .eq("id", pid)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPlaylistName((data as { nome?: string } | null)?.nome ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [playback?.active_playlist_id]);

  // Diagnóstico: emite snapshot do playback_state recebido sempre que muda
  useEffect(() => {
    logRadio("playback_state_received", {
      is_playing: playback?.is_playing ?? null,
      current_song_id: playback?.current_song_id ?? null,
      current_institutional_id: playback?.current_institutional_id ?? null,
      started_at: playback?.started_at ?? null,
      position_seconds: playback?.position_seconds ?? null,
      is_locked: playback?.is_locked ?? null,
    });
  }, [
    playback?.is_playing,
    playback?.current_song_id,
    playback?.current_institutional_id,
    playback?.started_at,
    playback?.position_seconds,
    playback?.is_locked,
  ]);

  // Resolve o item atual e gera URL
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadError(null);
      if (playback?.current_institutional_id) {
        const { data, error } = await supabase
          .from("institutional_contents")
          .select("id, titulo, tipo, duracao_segundos, storage_path")
          .eq("id", playback.current_institutional_id)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          logRadio("url_resolution_failed", {
            kind: "institutional",
            id: playback.current_institutional_id,
            error: error?.message ?? "not found",
          });
          setLoadError("Conteúdo não encontrado");
          return;
        }
        const { data: pub } = supabase.storage
          .from(INSTITUTIONAL_BUCKET)
          .getPublicUrl(data.storage_path);
        logRadio("url_resolved", {
          kind: "institutional",
          id: data.id,
          bucket: INSTITUTIONAL_BUCKET,
          storage_path: data.storage_path,
          url: pub.publicUrl,
          method: "public",
        });
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
        const { data, error } = await supabase
          .from("songs")
          .select("id, titulo, artista, duracao_segundos, storage_path")
          .eq("id", playback.current_song_id)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          logRadio("url_resolution_failed", {
            kind: "song",
            id: playback.current_song_id,
            error: error?.message ?? "not found",
          });
          setLoadError("Faixa não encontrada");
          return;
        }
        const { data: pub } = supabase.storage
          .from(SONG_BUCKET)
          .getPublicUrl(data.storage_path);
        let url = pub.publicUrl;
        let method: "public" | "signed" = "public";
        let headStatus: number | null = null;
        try {
          const head = await fetch(url, { method: "HEAD" });
          headStatus = head.status;
          if (!head.ok) throw new Error(`HTTP ${head.status}`);
        } catch (e) {
          logRadio("url_resolution_failed", {
            kind: "song",
            id: data.id,
            stage: "head",
            head_status: headStatus,
            error: (e as Error)?.message,
          });
          const { data: signed, error: signErr } = await supabase.storage
            .from(SONG_BUCKET)
            .createSignedUrl(data.storage_path, 3600);
          if (cancelled) return;
          if (signErr || !signed?.signedUrl) {
            logRadio("url_resolution_failed", {
              kind: "song",
              id: data.id,
              stage: "signed",
              error: signErr?.message,
            });
            setAudioUrl(null);
            setLoadError("Não foi possível obter a URL do áudio");
            return;
          }
          url = signed.signedUrl;
          method = "signed";
        }
        logRadio("url_resolved", {
          kind: "song",
          id: data.id,
          bucket: SONG_BUCKET,
          storage_path: data.storage_path,
          url,
          method,
          head_status: headStatus,
        });
        setCurrent({
          kind: "song",
          id: data.id,
          titulo: data.titulo,
          artista: data.artista,
          duracao_segundos: data.duracao_segundos,
          storage_path: data.storage_path,
        });
        setAudioUrl(url);
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

  // Sincroniza o elemento <audio> com playback_state.
  // Depende somente dos campos relevantes — evitar passar `playback` inteiro
  // que reagia a cada tick do realtime.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;

    const srcChanged = a.src !== audioUrl;
    if (srcChanged) {
      a.src = audioUrl;
      a.load();
      logRadio("src_applied", { url: audioUrl });
    }

    a.volume = targetVolume();

    const pos = computeLivePosition(playback);
    if (Number.isFinite(pos) && Math.abs(a.currentTime - pos) > 1.5) {
      try {
        a.currentTime = pos;
      } catch {
        /* ignore */
      }
    }

    if (playback?.is_playing) {
      setLoadError(null);
      logRadio("play_attempt", {
        trigger: "auto",
        url: audioUrl,
        seek_to: pos,
      });
      const playPromise = a.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            logRadio("play_success", { trigger: "auto" });
            setNeedsGesture(false);
            setLocalPlaying(true);
          })
          .catch((err) => {
            const e = err as { name?: string; message?: string };
            if (e?.name === "NotAllowedError" || e?.name === "AbortError") {
              logRadio("play_blocked", { name: e?.name, message: e?.message });
              setNeedsGesture(true);
            } else {
              logRadio("play_failed", { name: e?.name, message: e?.message });
              setLoadError(e?.message ?? "Falha ao iniciar a reprodução");
            }
            setLocalPlaying(false);
          });
      }
    } else {
      try {
        a.pause();
      } catch {
        /* ignore */
      }
      setLocalPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, playback?.is_playing, playback?.started_at]);

  // Ajusta volume em tempo real quando configuração mudar
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = targetVolume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.default_volume]);

  // Tick local para barra de progresso (sem auto-avanço — quem agenda é o operador)
  useEffect(() => {
    const id = setInterval(() => {
      setLivePos(computeLivePosition(playback));
    }, 500);
    return () => clearInterval(id);
  }, [playback]);

  const handleManualPlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    logRadio("manual_play", { url: audioUrl });
    try {
      if (!a.src && audioUrl) {
        a.src = audioUrl;
        a.load();
      }
      a.volume = targetVolume();
      const pos = computeLivePosition(playback);
      if (Number.isFinite(pos)) {
        try {
          a.currentTime = pos;
        } catch {
          /* ignore */
        }
      }
      logRadio("play_attempt", { trigger: "manual", url: audioUrl, seek_to: pos });
      await a.play();
      logRadio("play_success", { trigger: "manual" });
      try {
        window.localStorage.setItem("radioUnlocked", "1");
      } catch {
        /* ignore */
      }
      setUnlocked(true);
      setNeedsGesture(false);
      setLocalPlaying(true);
      setLoadError(null);
    } catch (err) {
      const e = err as { name?: string; message?: string };
      logRadio("play_failed", { trigger: "manual", name: e?.name, message: e?.message });
      setLoadError(e?.message ?? "Não foi possível iniciar");
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
  const playBtnDisabled = !audioUrl || !playback?.is_playing;

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
        <div className="mb-6">
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

        {/* Avisos */}
        {needsGesture && playback?.is_playing && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
            <AlertCircle className="size-4 text-primary shrink-0" />
            <span className="text-foreground/90">
              O navegador bloqueou a reprodução automática. Clique em{" "}
              <strong>▶ Iniciar Rádio</strong> para liberar o som.
            </span>
          </div>
        )}
        {loadError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}
        {buffering && playback?.is_playing && (
          <div className="mb-4 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Carregando…
          </div>
        )}

        {/* Controles */}
        <div className="flex items-center gap-6">
          <button
            onClick={handleManualPlay}
            disabled={playBtnDisabled}
            className="size-16 md:size-20 rounded-full bg-primary text-primary-foreground grid place-items-center hover:scale-105 transition-transform shadow-xl shadow-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={needsGesture ? "Iniciar Rádio" : localPlaying ? "Pausar" : "Tocar"}
            title={
              !playback?.is_playing
                ? "Aguardando o operador iniciar a transmissão"
                : needsGesture
                  ? "▶ Iniciar Rádio"
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
          playsInline
          onLoadedMetadata={() => {
            const a = audioRef.current;
            if (!a) return;
            const pos = computeLivePosition(playback);
            try {
              if (Number.isFinite(pos) && Math.abs(a.currentTime - pos) > 1) {
                a.currentTime = pos;
              }
            } catch {
              /* ignore */
            }
            logRadio("loaded_metadata", { duration: a.duration });
          }}
          onCanPlay={() => setBuffering(false)}
          onWaiting={() => {
            setBuffering(true);
            logRadio("buffering", {});
          }}
          onPlaying={() => {
            setBuffering(false);
            setLocalPlaying(true);
          }}
          onPause={() => setLocalPlaying(false)}
          onEnded={() => setLocalPlaying(false)}
          onError={() => {
            const a = audioRef.current;
            logRadio("audio_error", {
              code: a?.error?.code ?? null,
              message: a?.error?.message ?? null,
              src: a?.src ?? null,
            });
            setLoadError(
              a?.error
                ? `Erro de áudio (código ${a.error.code})`
                : "Falha ao carregar o áudio",
            );
            setLocalPlaying(false);
          }}
        />
      </div>
    </div>
  );
}
