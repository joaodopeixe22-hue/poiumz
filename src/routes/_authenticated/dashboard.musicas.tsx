import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Music, Plus, Search, Pencil, Trash2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProfile } from "@/hooks/use-profile";
import { useSongs, useSongsInPlaylists, type Song } from "@/hooks/use-songs";
import { usePreviewPlayer } from "@/hooks/use-preview-player";
import { supabase } from "@/integrations/supabase/client";
import { formatTime, formatRelative } from "@/lib/format";
import { UploadDialog } from "@/components/musicas/upload-dialog";
import { EditSongSheet } from "@/components/musicas/edit-song-sheet";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/musicas")({
  component: MusicasPage,
});

type FilterMode = "all" | "unused";

function MusicasPage() {
  const { profile } = useProfile();
  const { songs, loading, refresh } = useSongs();
  const { songsInPlaylists } = useSongsInPlaylists();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<Song | null>(null);
  const [deleting, setDeleting] = useState<Song | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const player = usePreviewPlayer();

  const canUpload = !!profile?.can_upload || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";
  const canDelete = isAdmin || !!profile?.can_upload;

  const unusedCount = useMemo(
    () => songs.filter((s) => !songsInPlaylists.has(s.id)).length,
    [songs, songsInPlaylists],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return songs.filter((s) => {
      if (filter === "unused" && songsInPlaylists.has(s.id)) return false;
      if (!q) return true;
      return (
        s.titulo.toLowerCase().includes(q) ||
        (s.artista ?? "").toLowerCase().includes(q)
      );
    });
  }, [songs, query, filter, songsInPlaylists]);

  const selectionMode = filter === "unused" && canDelete;
  const allFilteredSelected =
    selectionMode && filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s.id)));
    }
  };

  const switchFilter = (mode: FilterMode) => {
    setFilter(mode);
    setSelected(new Set());
  };

  const togglePlay = async (song: Song) => {
    if (player.current?.id === song.id && player.isPlaying) {
      await player.toggle();
      return;
    }
    if (player.current?.id === song.id && !player.isPlaying) {
      await player.toggle();
      return;
    }
    await player.playTrack({
      id: song.id,
      titulo: song.titulo,
      artista: song.artista,
      duracao_segundos: song.duracao_segundos,
      storage_path: song.storage_path,
    });
  };


  const confirmDelete = async () => {
    if (!deleting) return;
    const song = deleting;
    setDeleting(null);
    const { error: storageErr } = await supabase.storage.from("songs").remove([song.storage_path]);
    if (storageErr) {
      console.warn("storage remove:", storageErr.message);
    }
    const { error } = await supabase.from("songs").delete().eq("id", song.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Música removida.");
    refresh();
  };

  const runBulkDelete = async () => {
    setBulkConfirm(false);
    if (selected.size === 0) return;
    setBulkRunning(true);
    try {
      // Bloqueia exclusão da música atualmente em reprodução
      const { data: pb } = await supabase
        .from("playback_state")
        .select("current_song_id")
        .eq("id", true)
        .maybeSingle();
      const playingNow = pb?.current_song_id ?? null;

      const targets = songs.filter(
        (s) => selected.has(s.id) && !songsInPlaylists.has(s.id) && s.id !== playingNow,
      );
      const skipped = selected.size - targets.length;

      if (targets.length === 0) {
        toast.error("Nada para excluir (verifique a música em reprodução).");
        return;
      }

      const paths = targets.map((s) => s.storage_path);
      const ids = targets.map((s) => s.id);

      const { error: storageErr } = await supabase.storage.from("songs").remove(paths);
      if (storageErr) console.warn("storage remove:", storageErr.message);

      const { error } = await supabase.from("songs").delete().in("id", ids);
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(
        `${targets.length} música(s) removida(s)${skipped > 0 ? ` · ${skipped} ignorada(s)` : ""}.`,
      );
      setSelected(new Set());
      refresh();
    } finally {
      setBulkRunning(false);
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Biblioteca
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Músicas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {songs.length} {songs.length === 1 ? "música" : "músicas"} no acervo
            {unusedCount > 0 && (
              <>
                {" · "}
                <span className="text-amber-500">{unusedCount} sem playlist</span>
              </>
            )}
          </p>
        </div>
        {canUpload && (
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Enviar músicas
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou artista…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="inline-flex rounded-md border border-border bg-card p-0.5">
          <button
            onClick={() => switchFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
              filter === "all"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => switchFilter("unused")}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
              filter === "unused"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sem playlist {unusedCount > 0 && `(${unusedCount})`}
          </button>
        </div>
        {selectionMode && selected.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            disabled={bulkRunning}
            onClick={() => setBulkConfirm(true)}
            className="gap-2 md:ml-auto"
          >
            <Trash2 className="size-3.5" />
            Excluir selecionadas ({selected.size})
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Music className="size-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">
              {query
                ? "Nenhum resultado."
                : filter === "unused"
                  ? "Todas as músicas estão em pelo menos uma playlist."
                  : "Nenhuma música no acervo."}
            </p>
            {!query && filter === "all" && canUpload && (
              <p className="text-xs text-muted-foreground mt-1">
                Clique em "Enviar músicas" para começar.
              </p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {selectionMode && (
                  <th className="text-left py-3 px-4 w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todas"
                    />
                  </th>
                )}
                <th className="text-left py-3 px-4 w-12"></th>
                <th className="text-left py-3 px-4">Título</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Artista</th>
                <th className="text-left py-3 px-4 hidden lg:table-cell">Duração</th>
                <th className="text-left py-3 px-4 hidden lg:table-cell">Adicionada</th>
                <th className="text-right py-3 px-4 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((song) => {
                const isUnused = !songsInPlaylists.has(song.id);
                return (
                  <tr
                    key={song.id}
                    className="border-t border-border hover:bg-secondary/30 transition-colors"
                  >
                    {selectionMode && (
                      <td className="py-3 px-4">
                        <Checkbox
                          checked={selected.has(song.id)}
                          onCheckedChange={() => toggleSelect(song.id)}
                          aria-label={`Selecionar ${song.titulo}`}
                        />
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => togglePlay(song)}
                        className="size-8 rounded-full grid place-items-center bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors"
                        aria-label={playingId === song.id ? "Pausar" : "Reproduzir"}
                      >
                        {playingId === song.id ? (
                          <Pause className="size-3.5" />
                        ) : (
                          <Play className="size-3.5" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-medium max-w-xs">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{song.titulo}</span>
                        {isUnused && filter === "all" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal border-amber-500/40 text-amber-500"
                          >
                            sem playlist
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">
                      {song.artista ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">
                      {formatTime(song.duracao_segundos)}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">
                      {formatRelative(song.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        {isAdmin && (
                          <button
                            onClick={() => setEditing(song)}
                            className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            aria-label="Editar"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeleting(song)}
                            className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            aria-label="Excluir"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onComplete={refresh} />
      <EditSongSheet
        song={editing}
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        onSaved={refresh}
      />
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir música?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.titulo}" será removida do acervo e do armazenamento. Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selected.size} música(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              As músicas selecionadas serão removidas do acervo e do armazenamento. A música que
              estiver tocando no momento será ignorada para não interromper a transmissão. Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runBulkDelete} className="bg-red-500 hover:bg-red-600">
              Excluir selecionadas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
