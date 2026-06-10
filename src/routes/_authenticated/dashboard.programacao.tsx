import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Play,
  Pause,
  SkipForward,
  Radio,
  ListMusic,
  Shuffle,
  Lock,
  Unlock,
  Megaphone,
  Repeat,
  RotateCcw,
} from "lucide-react";
import { PriorityQueue } from "@/components/radio/priority-queue";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/hooks/use-profile";
import { usePlayback, computeLivePosition } from "@/hooks/use-playback";
import { usePlaylists } from "@/hooks/use-playlists";
import { supabase } from "@/integrations/supabase/client";
import { formatTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/programacao")({
  component: ProgramacaoPage,
});

function ProgramacaoPage() {
  const { profile } = useProfile();
  const {
    playback,
    startPlaylist,
    pause,
    resume,
    next,
    setShuffle,
    setLocked,
    setInstitutionalEnabled,
    setLoopPlaylist,
    setResumeAfterInstitutional,
  } = usePlayback();
  const { playlists } = usePlaylists();
  const [currentLabel, setCurrentLabel] = useState<{
    titulo: string;
    artista: string | null;
    kind: "song" | "institutional";
  } | null>(null);
  const [livePos, setLivePos] = useState(0);
  const [duracao, setDuracao] = useState<number | null>(null);

  const canControl = profile?.status === "aprovado";
  const isAdmin = profile?.role === "admin";
  const lockedForMe = !!playback?.is_locked && !isAdmin;

  // resolve current title
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (playback?.current_institutional_id) {
        const { data } = await supabase
          .from("institutional_contents")
          .select("titulo, tipo, duracao_segundos")
          .eq("id", playback.current_institutional_id)
          .maybeSingle();
        if (cancelled || !data) return;
        setCurrentLabel({
          titulo: data.titulo,
          artista: data.tipo === "vinheta" ? "Vinheta" : "Aviso",
          kind: "institutional",
        });
        setDuracao(data.duracao_segundos ?? null);
      } else if (playback?.current_song_id) {
        const { data } = await supabase
          .from("songs")
          .select("titulo, artista, duracao_segundos")
          .eq("id", playback.current_song_id)
          .maybeSingle();
        if (cancelled || !data) return;
        setCurrentLabel({
          titulo: data.titulo,
          artista: data.artista,
          kind: "song",
        });
        setDuracao(data.duracao_segundos ?? null);
      } else {
        setCurrentLabel(null);
        setDuracao(null);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [playback?.current_song_id, playback?.current_institutional_id]);

  useEffect(() => {
    const id = setInterval(() => setLivePos(computeLivePosition(playback)), 500);
    return () => clearInterval(id);
  }, [playback]);

  const handleStartPlaylist = async (id: string) => {
    if (!id) return;
    const { error } = await startPlaylist(id);
    if (error) toast.error(error);
    else toast.success("Transmissão iniciada.");
  };

  const handlePlayPause = async () => {
    if (lockedForMe) return toast.error("A rádio está travada pelo admin.");
    if (playback?.is_playing) {
      const { error } = await pause();
      if (error) toast.error(error);
    } else {
      const { error } = await resume();
      if (error) toast.error(error);
    }
  };

  const handleNext = async () => {
    if (lockedForMe) return toast.error("A rádio está travada pelo admin.");
    const { error } = await next({
      expectedSong: playback?.current_song_id ?? undefined,
      expectedInstitutional: playback?.current_institutional_id ?? undefined,
    });
    if (error) toast.error(error);
  };

  const handleShuffle = async (v: boolean) => {
    const { error } = await setShuffle(v);
    if (error) toast.error(error);
  };

  const handleLock = async (v: boolean) => {
    const { error } = await setLocked(v);
    if (error) toast.error(error);
  };

  const handleInstitutional = async (v: boolean) => {
    const { error } = await setInstitutionalEnabled(v);
    if (error) toast.error(error);
  };

  if (!canControl) {
    return (
      <div className="p-6 md:p-10">
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-8 text-center max-w-xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Apenas membros aprovados podem controlar a programação.
          </p>
        </div>
      </div>
    );
  }

  const dur = duracao ?? 0;
  const progress = dur ? Math.min(100, (livePos / dur) * 100) : 0;
  const isOnAir = !!playback?.is_playing && !!currentLabel;

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Operação
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Programação ao vivo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle a transmissão da rádio. Todos os ouvintes escutam sincronizado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {playback?.is_locked && (
            <span className="flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-yellow-500">
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

      {/* Now playing */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          {currentLabel?.kind === "institutional" ? (
            <Megaphone className="size-4 text-yellow-500" />
          ) : (
            <Radio className="size-4 text-primary" />
          )}
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            {currentLabel?.kind === "institutional" ? "Mensagem institucional" : "Tocando agora"}
          </span>
        </div>
        <h2 className="text-2xl font-bold truncate">
          {currentLabel?.titulo ?? "Nada no ar"}
        </h2>
        <p className="text-sm text-muted-foreground truncate mb-5">
          {currentLabel?.artista ?? "—"}
        </p>
        <div className="flex items-center justify-between mb-2 font-mono text-xs text-muted-foreground tabular-nums">
          <span>{formatTime(livePos)}</span>
          <span>{formatTime(dur)}</span>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden mb-6">
          <div
            className={`h-full transition-all ${
              currentLabel?.kind === "institutional" ? "bg-yellow-500" : "bg-primary"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="lg"
            onClick={handlePlayPause}
            disabled={lockedForMe || (!playback?.active_playlist_id && !playback?.is_playing)}
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
            size="lg"
            variant="secondary"
            onClick={handleNext}
            disabled={lockedForMe || !playback?.active_playlist_id}
            className="gap-2"
          >
            <SkipForward className="size-4" /> Próxima
          </Button>
        </div>
      </div>

      {/* Playlist no ar */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ListMusic className="size-4 text-primary" />
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Playlist no ar
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            value={playback?.active_playlist_id ?? ""}
            onValueChange={handleStartPlaylist}
            disabled={lockedForMe}
          >
            <SelectTrigger className="sm:flex-1">
              <SelectValue placeholder="Escolha uma playlist para colocar no ar" />
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
        <p className="text-xs text-muted-foreground mt-3">
          Trocar a playlist reinicia a transmissão a partir do primeiro item.
        </p>
      </div>

      {/* Opções */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <OptionRow
          icon={Shuffle}
          title="Modo aleatório"
          description="Embaralha a ordem das músicas da playlist."
          checked={!!playback?.shuffle}
          onCheckedChange={handleShuffle}
          disabled={lockedForMe}
        />
        <OptionRow
          icon={Megaphone}
          title="Conteúdos institucionais"
          description="Liga/desliga vinhetas e avisos."
          checked={playback?.institutional_enabled ?? true}
          onCheckedChange={handleInstitutional}
          disabled={!isAdmin}
          adminOnly
        />
        <OptionRow
          icon={playback?.is_locked ? Lock : Unlock}
          title="Modo deus (trava)"
          description="Bloqueia controles para todos exceto o admin."
          checked={!!playback?.is_locked}
          onCheckedChange={handleLock}
          disabled={!isAdmin}
          adminOnly
        />
      </div>
    </div>
  );
}

function OptionRow({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  adminOnly,
}: {
  icon: typeof Radio;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  adminOnly?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex items-start gap-3">
      <div className="size-10 rounded-xl bg-secondary text-foreground grid place-items-center shrink-0">
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium truncate">{title}</p>
          <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
        {adminOnly && (
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 mt-1">
            apenas admin
          </p>
        )}
      </div>
    </div>
  );
}
