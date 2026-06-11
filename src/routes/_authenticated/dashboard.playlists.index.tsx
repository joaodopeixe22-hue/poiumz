import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ListMusic, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { usePlaylists, type Playlist } from "@/hooks/use-playlists";
import { supabase } from "@/integrations/supabase/client";
import { formatPlaylistDuration } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/playlists/")({
  component: PlaylistsPage,
});

function PlaylistsPage() {
  const { profile } = useProfile();
  const { playlists, loading, refresh } = usePlaylists();
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<Playlist | null>(null);
  const [deleting, setDeleting] = useState<Playlist | null>(null);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  const canEdit = profile?.status === "aprovado";

  const openCreate = () => {
    setNome("");
    setCreateOpen(true);
  };

  const openRename = (pl: Playlist) => {
    setNome(pl.nome);
    setRenaming(pl);
  };

  const handleCreate = async () => {
    const v = nome.trim();
    if (!v) return;
    setSaving(true);
    const { error } = await supabase
      .from("playlists")
      .insert({ nome: v, created_by: profile?.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    setCreateOpen(false);
    toast.success("Playlist criada.");
    refresh();
  };

  const handleRename = async () => {
    if (!renaming) return;
    const v = nome.trim();
    if (!v) return;
    setSaving(true);
    const { error } = await supabase.from("playlists").update({ nome: v }).eq("id", renaming.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setRenaming(null);
    toast.success("Playlist renomeada.");
    refresh();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    // remove vínculos primeiro (sem cascade declarado)
    await supabase.from("playlist_songs").delete().eq("playlist_id", target.id);
    const { error } = await supabase.from("playlists").delete().eq("id", target.id);
    if (error) return toast.error(error.message);
    toast.success("Playlist removida.");
    refresh();
  };

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Programação
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Playlists</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {playlists.length} {playlists.length === 1 ? "playlist" : "playlists"} criadas
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" />
            Nova playlist
          </Button>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Carregando…
        </div>
      ) : playlists.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <ListMusic className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Nenhuma playlist ainda.</p>
          {canEdit && (
            <p className="text-xs text-muted-foreground mt-1">
              Clique em "Nova playlist" para começar.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors"
            >
              <Link
                to="/dashboard/playlists/$playlistId"
                params={{ playlistId: pl.id }}
                className="block"
              >
                <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center mb-3">
                  <ListMusic className="size-5" />
                </div>
                <h3 className="font-semibold truncate">{pl.nome}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPlaylistDuration(pl.song_count, pl.total_duration_seconds)}
                </p>
              </Link>
              {canEdit && (
                <div className="flex justify-end gap-1 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openRename(pl)}
                    className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label="Renomear"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleting(pl)}
                    className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    aria-label="Excluir"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Criar */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova playlist</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome da playlist"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!nome.trim() || saving}>
              {saving ? "Criando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renomear */}
      <Dialog open={!!renaming} onOpenChange={(v) => !v && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear playlist</DialogTitle>
          </DialogHeader>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancelar
            </Button>
            <Button onClick={handleRename} disabled={!nome.trim() || saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir playlist?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.nome}" será removida. As músicas continuam no acervo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
