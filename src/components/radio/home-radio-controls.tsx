import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  ListMusic,
  Lock,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Radio as RadioIcon,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";
import { usePlayback, computeLivePosition } from "@/hooks/use-playback";
import { usePlaylists } from "@/hooks/use-playlists";
import { supabase } from "@/integrations/supabase/client";
import { formatTime } from "@/lib/format";

const VOLUME_KEY = "radioVolume";
const VOLUME_EVENT = "radio:setVolume";

/**
 * Painel avançado de operação exibido na Home para admin/operador aprovado.
 * Toda alteração de estado de reprodução é gravada em playback_state
 * (RLS continua sendo a proteção real). O volume é local por dispositivo.
 */
export function HomeRadioControls() {
  const { profile, loading: profileLoading } = useProfile();
  const { user } = useAuth();
  const { playback, startPlaylist, pause, resume, next, setShuffle, setLoopPlaylist } =
    usePlayback({ autoAdvance: true });
  const { playlists } = usePlaylists();
  const [busy, setBusy] = useState(false);
  const [currentSongMeta, setCurrentSongMeta] = useState<{
    titulo: string;
    artista: string | null;
    duracao_segundos: number | null;
  } | null>(null);
  const [controllerName, setControllerName] = useState<string | null>(null);
  const [livePos, setLivePos] = useState(0);
  const [volume, setVolume] = useState<number>(() => {
    if (typeof window === "undefined") return 0.8;
    const v = window.localStorage.getItem(VOLUME_KEY);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.8;
  });
  const lastVolBeforeMute = useRef<number>(0.8);

  const canControl =
    !!profile &&
    profile.status === "aprovado" &&
    (profile.role === "admin" || profile.role === "operador");

  const isAdmin = profile?.role === "admin";
  const lockedForMe = !!playback?.is_locked && !isAdmin;

  // Metadados da faixa atual para a barra de progresso
  useEffect(() => {
    let cancelled = false;
    const songId = playback?.current_song_id;
    if (!songId) {
      setCurrentSongMeta(null);
      return;
    }
    supabase
      .from("songs")
      .select("titulo, artista, duracao_segundos")
      .eq("id", songId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setCurrentSongMeta(data);
      });
    return () => {
      cancelled = true;
    };
  }, [playback?.current_song_id]);

  // Nome de quem está controlando
  useEffect(() => {
    let cancelled = false;
    const id = playback?.controlled_by;
    if (!id) {
      setControllerName(null);
      return;
    }
    supabase
      .from("profiles")
      .select("nome")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setControllerName((data?.nome as string | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [playback?.controlled_by]);

  // Tick local da barra de progresso
  useEffect(() => {
    const id = setInterval(() => {
      const dur = currentSongMeta?.duracao_segundos ?? 0;
      let pos = computeLivePosition(playback);
      if (dur > 0 && pos > dur) pos = dur;
      if (!Number.isFinite(pos) || pos < 0) pos = 0;
      setLivePos(pos);
    }, 500);
    return () => clearInterval(id);
  }, [playback, currentSongMeta?.duracao_segundos]);

  // Propaga volume para o elemento <audio> do RadioPlayer
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(VOLUME_EVENT, { detail: { volume } }));
  }, [volume]);

  const stamp = useMemo(
    () => ({ controlled_by: user?.id ?? null }),
    [user?.id],
  );

  if (profileLoading) return null;
  if (!canControl) return null;

  const markControlled = async () => {
    if (!user?.id) return;
    if (playback?.controlled_by === user.id) return;
    await supabase
      .from("playback_state")
      .update(stamp as never)
      .eq("id", true);
  };

  const handlePlayPause = async () => {
    if (lockedForMe) return toast.error("A rádio está travada pelo admin.");
    setBusy(true);
    try {
      if (playback?.is_playing) {
        const { error } = await pause();
        if (error) toast.error(error);
      } else {
        const { error } = await resume();
        if (error) toast.error(error);
      }
      await markControlled();
    } finally {
      setBusy(false);
    }
  };

  const handleNext = async () => {
    if (lockedForMe) return toast.error("A rádio está travada pelo admin.");
    setBusy(true);
    try {
      const { error } = await next({
        expectedSong: playback?.current_song_id ?? undefined,
        expectedInstitutional: playback?.current_institutional_id ?? undefined,
      });
      if (error) toast.error(error);
      await markControlled();
    } finally {
      setBusy(false);
    }
  };

  const handlePrev = async () => {
    if (lockedForMe) return toast.error("A rádio está travada pelo admin.");
    if (!playback?.active_playlist_id) return;
    setBusy(true);
    try {
      const { data: songs } = await supabase
        .from("playlist_songs")
        .select("song_id, posicao")
        .eq("playlist_id", playback.active_playlist_id)
        .order("posicao", { ascending: true });
      const list = (songs as { song_id: string; posicao: number }[] | null) ?? [];
      if (list.length === 0) return;
      const cur = playback.loop_index ?? 0;
      const prev = (cur - 1 + list.length) % list.length;
      const { error } = await supabase
        .from("playback_state")
        .update({
          current_song_id: list[prev].song_id,
          current_institutional_id: null,
          loop_index: prev,
          position_seconds: 0,
          started_at: new Date().toISOString(),
          is_playing: true,
          controlled_by: user?.id ?? null,
        } as never)
        .eq("id", true);
      if (error) toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePickPlaylist = async (id: string) => {
    if (!id) return;
    if (lockedForMe) return toast.error("A rádio está travada pelo admin.");
    setBusy(true);
    try {
      const { error } = await startPlaylist(id);
      if (error) toast.error(error);
      else toast.success("Transmissão iniciada.");
      await markControlled();
    } finally {
      setBusy(false);
    }
  };

  const handleToggleShuffle = async () => {
    if (lockedForMe) return toast.error("A rádio está travada pelo admin.");
    const { error } = await setShuffle(!playback?.shuffle);
    if (error) return toast.error(error);
    await markControlled();
  };

  const handleToggleRepeat = async () => {
    if (lockedForMe) return toast.error("A rádio está travada pelo admin.");
    const { error } = await setLoopPlaylist(!playback?.loop_playlist);
    if (error) return toast.error(error);
    await markControlled();
  };

  const handleSeek = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (lockedForMe) return toast.error("A rádio está travada pelo admin.");
    const dur = currentSongMeta?.duracao_segundos ?? 0;
    if (!dur || !playback?.current_song_id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const secs = Math.floor(ratio * dur);
    const { error } = await supabase
      .from("playback_state")
      .update({
        position_seconds: secs,
        started_at: playback.is_playing ? new Date().toISOString() : null,
        controlled_by: user?.id ?? null,
      } as never)
      .eq("id", true);
    if (error) toast.error(error.message);
  };

  const handleMuteToggle = () => {
    if (volume > 0) {
      lastVolBeforeMute.current = volume;
      setVolume(0);
    } else {
      setVolume(lastVolBeforeMute.current || 0.8);
    }
  };

  const dur = currentSongMeta?.duracao_segundos ?? 0;
  const progressPct = dur > 0 ? Math.min(100, (livePos / dur) * 100) : 0;
  const isOnAir = !!playback?.is_playing && !!playback?.current_song_id;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      {/* Cabeçalho com status */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <RadioIcon className="size-4 text-primary" />
          <h2 className="text-sm font-mono uppercase tracking-widest">
            Controles avançados
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
            isOnAir
              ? "bg-red-500/15 text-red-500"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              isOnAir ? "bg-red-500 animate-pulse" : "bg-muted-foreground"
            }`}
          />
          {isOnAir ? "no ar" : "fora do ar"}
        </span>
        {controllerName && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <UserIcon className="size-3" />
            controlando: <span className="text-foreground">{controllerName}</span>
          </span>
        )}
        {lockedForMe && (
          <span className="ml-auto flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-yellow-500">
            <Lock className="size-3" /> travada
          </span>
        )}
      </div>

      {/* Faixa atual + progresso clicável */}
      {currentSongMeta && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium truncate">
              {currentSongMeta.titulo}
              {currentSongMeta.artista && (
                <span className="text-muted-foreground font-normal">
                  {" · "}
                  {currentSongMeta.artista}
                </span>
              )}
            </p>
            <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">
              {formatTime(livePos)} / {formatTime(dur)}
            </span>
          </div>
          <div
            role="slider"
            tabIndex={0}
            aria-label="Posição da faixa"
            aria-valuemin={0}
            aria-valuemax={dur || 0}
            aria-valuenow={Math.floor(livePos)}
            onClick={handleSeek}
            className={`h-2 bg-border rounded-full overflow-hidden ${
              lockedForMe || !dur ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }`}
          >
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Controles de transporte */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="icon"
          variant={playback?.shuffle ? "default" : "secondary"}
          onClick={handleToggleShuffle}
          disabled={busy || lockedForMe}
          title="Embaralhar"
          aria-label="Embaralhar"
        >
          <Shuffle className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handlePrev}
          disabled={busy || lockedForMe || !playback?.active_playlist_id}
          className="gap-2"
        >
          <SkipBack className="size-4" /> Anterior
        </Button>
        <Button
          size="sm"
          onClick={handlePlayPause}
          disabled={
            busy || lockedForMe || (!playback?.active_playlist_id && !playback?.is_playing)
          }
          className="gap-2"
        >
          {playback?.is_playing ? (
            <>
              <Pause className="size-4" /> Pausar
            </>
          ) : (
            <>
              <Play className="size-4" /> Tocar
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleNext}
          disabled={busy || lockedForMe || !playback?.active_playlist_id}
          className="gap-2"
        >
          <SkipForward className="size-4" /> Próxima
        </Button>
        <Button
          size="icon"
          variant={playback?.loop_playlist ? "default" : "secondary"}
          onClick={handleToggleRepeat}
          disabled={busy || lockedForMe}
          title="Repetir playlist"
          aria-label="Repetir playlist"
        >
          <Repeat className="size-4" />
        </Button>

        {/* Volume local */}
        <div className="ml-auto flex items-center gap-2 min-w-[180px]">
          <button
            onClick={handleMuteToggle}
            className="size-8 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label={volume === 0 ? "Tirar mudo" : "Mutar"}
          >
            {volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <Slider
            value={[Math.round(volume * 100)]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => setVolume(Math.max(0, Math.min(1, (v[0] ?? 0) / 100)))}
            className="flex-1"
            aria-label="Volume local deste dispositivo"
          />
          <span className="text-xs font-mono text-muted-foreground tabular-nums w-8 text-right">
            {Math.round(volume * 100)}
          </span>
        </div>
      </div>

      {/* Seletor de playlist */}
      <Select
        value={playback?.active_playlist_id ?? ""}
        onValueChange={handlePickPlaylist}
        disabled={busy || lockedForMe}
      >
        <SelectTrigger>
          <SelectValue placeholder="Trocar playlist no ar" />
        </SelectTrigger>
        <SelectContent>
          {playlists.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Nenhuma playlist cadastrada.
            </div>
          ) : (
            playlists.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome} · {p.song_count ?? 0}{" "}
                {p.song_count === 1 ? "música" : "músicas"}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

    </div>
  );
}
