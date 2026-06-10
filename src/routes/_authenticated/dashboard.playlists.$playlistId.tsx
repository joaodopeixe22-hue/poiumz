import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Search,
  Music,
  Play,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProfile } from "@/hooks/use-profile";
import { useSongs } from "@/hooks/use-songs";
import { usePlaylist } from "@/hooks/use-playlists";
import { usePreviewPlayer, type PreviewTrack } from "@/hooks/use-preview-player";
import { supabase } from "@/integrations/supabase/client";
import { formatTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/playlists/$playlistId")({
  component: PlaylistDetailPage,
});

function PlaylistDetailPage() {
  const { playlistId } = Route.useParams();
  const { profile } = useProfile();
  const { playlist, items, loading, refresh } = usePlaylist(playlistId);
  const { songs } = useSongs();
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const player = usePreviewPlayer();

  const canEdit = profile?.status === "aprovado";

  const playlistTracks: PreviewTrack[] = useMemo(
    () =>
      items
        .filter((it) => it.song)
        .map((it) => ({
          id: it.song!.id,
          titulo: it.song!.titulo,
          artista: it.song!.artista,
          duracao_segundos: it.song!.duracao_segundos,
          storage_path: it.song!.storage_path,
        })),
    [items],
  );

  const playFromIndex = (i: number) => {
    if (playlistTracks.length === 0) return;
    player.playQueue(playlistTracks, i);
  };

  const playRowToggle = (i: number) => {
    const t = playlistTracks[i];
    if (!t) return;
    if (player.current?.id === t.id) {
      player.toggle();
    } else {
      playFromIndex(i);
    }
  };


  const existingIds = useMemo(() => new Set(items.map((i) => i.song_id)), [items]);
  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return songs
      .filter((s) => !existingIds.has(s.id))
      .filter(
        (s) =>
          !q ||
          s.titulo.toLowerCase().includes(q) ||
          (s.artista ?? "").toLowerCase().includes(q),
      );
  }, [songs, existingIds, query]);

  const totalDuration = useMemo(
    () => items.reduce((acc, i) => acc + (i.song?.duracao_segundos ?? 0), 0),
    [items],
  );

  const addSong = async (songId: string) => {
    const nextPos = items.length;
    const { error } = await supabase
      .from("playlist_songs")
      .insert({ playlist_id: playlistId, song_id: songId, posicao: nextPos });
    if (error) return toast.error(error.message);
    refresh();
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("playlist_songs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    // recompactar posições
    const next = items.filter((i) => i.id !== id);
    await Promise.all(
      next.map((it, idx) =>
        supabase.from("playlist_songs").update({ posicao: idx }).eq("id", it.id),
      ),
    );
    refresh();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    await Promise.all([
      supabase.from("playlist_songs").update({ posicao: b.posicao }).eq("id", a.id),
      supabase.from("playlist_songs").update({ posicao: a.posicao }).eq("id", b.id),
    ]);
    refresh();
  };

  if (loading) {
    return (
      <div className="p-6 md:p-10 text-sm text-muted-foreground">Carregando playlist…</div>
    );
  }

  if (!playlist) {
    return (
      <div className="p-6 md:p-10">
        <Link
          to="/dashboard/playlists"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <div className="mt-6 rounded-2xl border border-border bg-card p-10 text-center">
          <p className="text-sm font-medium">Playlist não encontrada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-6">
      <Link
        to="/dashboard/playlists"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Playlists
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Playlist
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{playlist.nome}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} {items.length === 1 ? "música" : "músicas"} ·{" "}
            {formatTime(totalDuration)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => playFromIndex(0)}
              className="gap-2"
            >
              <Play className="size-4" />
              Tocar playlist
            </Button>
          )}
          {canEdit && (
            <Button
              onClick={() => {
                setQuery("");
                setAddOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="size-4" />
              Adicionar músicas
            </Button>
          )}
        </div>
      </div>


      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {items.length === 0 ? (
          <div className="p-12 text-center">
            <Music className="size-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Playlist vazia.</p>
            {canEdit && (
              <p className="text-xs text-muted-foreground mt-1">
                Adicione músicas do acervo.
              </p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left py-3 px-4 w-12">#</th>
                <th className="text-left py-3 px-4">Título</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Artista</th>
                <th className="text-left py-3 px-4 hidden lg:table-cell">Duração</th>
                <th className="text-right py-3 px-4 w-32">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr
                  key={it.id}
                  className="border-t border-border hover:bg-secondary/30 transition-colors"
                >
                  <td className="py-3 px-4 text-muted-foreground font-mono tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-4 font-medium truncate max-w-xs">
                    {it.song?.titulo ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">
                    {it.song?.artista ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">
                    {formatTime(it.song?.duracao_segundos)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => move(idx, -1)}
                          disabled={idx === 0}
                          className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                          aria-label="Mover para cima"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          onClick={() => move(idx, 1)}
                          disabled={idx === items.length - 1}
                          className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                          aria-label="Mover para baixo"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                        <button
                          onClick={() => removeItem(it.id)}
                          className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          aria-label="Remover"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Adicionar músicas */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar músicas</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar no acervo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="max-h-96 overflow-y-auto rounded-md border border-border divide-y divide-border">
            {available.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {songs.length === 0
                  ? "Acervo vazio. Envie músicas primeiro."
                  : "Nenhuma música disponível."}
              </div>
            ) : (
              available.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-secondary/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.titulo}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.artista ?? "—"} · {formatTime(s.duracao_segundos)}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => addSong(s.id)} className="gap-1">
                    <Plus className="size-3.5" /> Adicionar
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
