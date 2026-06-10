import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Music, Plus, Search, Pencil, Trash2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useSongs, getSongSignedUrl, type Song } from "@/hooks/use-songs";
import { supabase } from "@/integrations/supabase/client";
import { formatTime, formatRelative } from "@/lib/format";
import { UploadDialog } from "@/components/musicas/upload-dialog";
import { EditSongSheet } from "@/components/musicas/edit-song-sheet";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/musicas")({
  component: MusicasPage,
});

function MusicasPage() {
  const { profile } = useProfile();
  const { songs, loading, refresh } = useSongs();
  const [query, setQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<Song | null>(null);
  const [deleting, setDeleting] = useState<Song | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const canUpload = !!profile?.can_upload || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(
      (s) =>
        s.titulo.toLowerCase().includes(q) ||
        (s.artista ?? "").toLowerCase().includes(q),
    );
  }, [songs, query]);

  const togglePlay = async (song: Song) => {
    if (playingId === song.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    try {
      const url = await getSongSignedUrl(song.storage_path, 120);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      audioRef.current.onended = () => setPlayingId(null);
      await audioRef.current.play();
      setPlayingId(song.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível reproduzir");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const song = deleting;
    setDeleting(null);
    const { error: storageErr } = await supabase.storage.from("songs").remove([song.storage_path]);
    if (storageErr) {
      // segue mesmo assim — pode ser arquivo já ausente
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
          </p>
        </div>
        {canUpload && (
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Enviar músicas
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou artista…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Music className="size-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">
              {query ? "Nenhum resultado." : "Nenhuma música no acervo."}
            </p>
            {!query && canUpload && (
              <p className="text-xs text-muted-foreground mt-1">
                Clique em "Enviar músicas" para começar.
              </p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left py-3 px-4 w-12"></th>
                <th className="text-left py-3 px-4">Título</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Artista</th>
                <th className="text-left py-3 px-4 hidden lg:table-cell">Duração</th>
                <th className="text-left py-3 px-4 hidden lg:table-cell">Adicionada</th>
                <th className="text-right py-3 px-4 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((song) => (
                <tr key={song.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4">
                    <button
                      onClick={() => togglePlay(song)}
                      className="size-8 rounded-full grid place-items-center bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors"
                      aria-label={playingId === song.id ? "Pausar" : "Reproduzir"}
                    >
                      {playingId === song.id ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                    </button>
                  </td>
                  <td className="py-3 px-4 font-medium truncate max-w-xs">{song.titulo}</td>
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
                        <>
                          <button
                            onClick={() => setEditing(song)}
                            className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            aria-label="Editar"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleting(song)}
                            className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            aria-label="Excluir"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
    </div>
  );
}
