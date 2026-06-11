import { useState } from "react";
import { Play, Pause, SkipForward, SkipBack, ListMusic, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/hooks/use-profile";
import { usePlayback } from "@/hooks/use-playback";
import { usePlaylists } from "@/hooks/use-playlists";
import { supabase } from "@/integrations/supabase/client";

/**
 * Controles operacionais exibidos diretamente na Home para
 * usuários aprovados (admin/operador). Toda ação escreve em
 * playback_state — a UI nunca decide reprodução localmente.
 */
export function HomeRadioControls() {
  const { profile, loading: profileLoading } = useProfile();
  const { playback, startPlaylist, pause, resume, next } = usePlayback();
  const { playlists } = usePlaylists();
  const [busy, setBusy] = useState(false);

  if (profileLoading) return null;
  const canControl =
    !!profile &&
    profile.status === "aprovado" &&
    (profile.role === "admin" || profile.role === "operador");
  if (!canControl) return null;

  const isAdmin = profile.role === "admin";
  const lockedForMe = !!playback?.is_locked && !isAdmin;

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
    } finally {
      setBusy(false);
    }
  };

  // Anterior: escreve diretamente em playback_state retrocedendo o loop_index
  // e setando a música anterior da playlist. RLS continua sendo a proteção real.
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
        })
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ListMusic className="size-4 text-primary" />
        <h2 className="text-sm font-mono uppercase tracking-widest">
          Controles de operação
        </h2>
        {lockedForMe && (
          <span className="ml-auto flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-yellow-500">
            <Lock className="size-3" /> travada
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
          disabled={busy || lockedForMe || (!playback?.active_playlist_id && !playback?.is_playing)}
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
      </div>

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

      <p className="text-xs text-muted-foreground">
        Todas as ações escrevem em <code className="font-mono">playback_state</code> e
        são sincronizadas em tempo real para todos os ouvintes.
      </p>
    </div>
  );
}
