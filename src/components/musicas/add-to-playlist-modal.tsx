import { useEffect, useMemo, useState } from "react";
import { ListMusic, Plus, Search, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlaylists } from "@/hooks/use-playlists";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songIds: string[];
  onDone?: () => void;
};

export function AddToPlaylistModal({ open, onOpenChange, songIds, onDone }: Props) {
  const { profile } = useProfile();
  const { playlists, loading, refresh } = usePlaylists();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedId(null);
      setCreating(false);
      setNewName("");
    }
  }, [open]);

  const sorted = useMemo(
    () => [...playlists].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [playlists],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => p.nome.toLowerCase().includes(q));
  }, [sorted, query]);

  const count = songIds.length;

  const handleCreate = async () => {
    const v = newName.trim();
    if (!v) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("playlists")
      .insert({ nome: v, created_by: profile?.id })
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível criar a playlist.");
      return;
    }
    toast.success(`Playlist "${v}" criada.`);
    setCreating(false);
    setNewName("");
    await refresh();
    setSelectedId(data.id);
  };

  const handleAdd = async () => {
    if (!selectedId || count === 0) return;
    const playlist = playlists.find((p) => p.id === selectedId);
    setSaving(true);
    try {
      // Existing song_ids for this playlist
      const { data: existing, error: exErr } = await supabase
        .from("playlist_songs")
        .select("song_id, posicao")
        .eq("playlist_id", selectedId);

      if (exErr) {
        if (exErr.message.toLowerCase().includes("permission")) {
          toast.error("Você não possui permissão para editar esta playlist.");
        } else {
          toast.error("Não foi possível adicionar as músicas.");
        }
        return;
      }

      const existingIds = new Set((existing ?? []).map((r) => r.song_id));
      const maxPos = (existing ?? []).reduce(
        (m, r) => (r.posicao > m ? r.posicao : m),
        0,
      );

      const toInsert = songIds.filter((id) => !existingIds.has(id));
      const skipped = songIds.length - toInsert.length;

      if (toInsert.length === 0) {
        toast.message(`Todas as ${count} músicas já estavam em "${playlist?.nome ?? ""}".`);
        onOpenChange(false);
        return;
      }

      const rows = toInsert.map((song_id, idx) => ({
        playlist_id: selectedId,
        song_id,
        posicao: maxPos + idx + 1,
      }));

      const { error: insErr } = await supabase.from("playlist_songs").insert(rows);
      if (insErr) {
        if (insErr.message.toLowerCase().includes("permission") || insErr.code === "42501") {
          toast.error("Você não possui permissão para editar esta playlist.");
        } else {
          toast.error("Não foi possível adicionar as músicas.");
        }
        return;
      }

      const name = playlist?.nome ?? "playlist";
      if (skipped > 0) {
        toast.success(
          `${toInsert.length} música(s) adicionada(s). ${skipped} já existia(m) na playlist.`,
        );
      } else {
        toast.success(
          `${toInsert.length} ${toInsert.length === 1 ? "música adicionada" : "músicas adicionadas"} à playlist "${name}".`,
        );
      }
      onOpenChange(false);
      onDone?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {creating ? "Nova playlist" : "Adicionar à playlist"}
          </DialogTitle>
          <DialogDescription>
            {creating
              ? "Crie uma nova playlist e adicione as músicas selecionadas."
              : `Adicionar ${count} ${count === 1 ? "música" : "músicas"} à playlist`}
          </DialogDescription>
        </DialogHeader>

        {creating ? (
          <div className="space-y-3">
            <Input
              placeholder="Nome da playlist"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Após criada, a playlist será selecionada automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar playlist…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreating(true)}
                className="gap-1.5 shrink-0"
              >
                <Plus className="size-3.5" />
                Nova
              </Button>
            </div>

            <div className="rounded-md border border-border">
              <ScrollArea className="h-64">
                {loading ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Carregando…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {query ? "Nenhuma playlist encontrada." : "Nenhuma playlist ainda."}
                  </div>
                ) : (
                  <ul className="py-1">
                    {filtered.map((pl) => {
                      const isSelected = selectedId === pl.id;
                      return (
                        <li key={pl.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(pl.id)}
                            className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                              isSelected
                                ? "bg-primary/10 text-foreground"
                                : "hover:bg-secondary/60"
                            }`}
                          >
                            <div
                              className={`size-8 rounded-md grid place-items-center shrink-0 ${
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              <ListMusic className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{pl.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {pl.song_count ?? 0}{" "}
                                {pl.song_count === 1 ? "música" : "músicas"}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter>
          {creating ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                }}
                disabled={saving}
                className="gap-1.5"
              >
                <ArrowLeft className="size-3.5" />
                Voltar
              </Button>
              <Button onClick={handleCreate} disabled={!newName.trim() || saving}>
                {saving ? "Criando…" : "Criar e selecionar"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleAdd} disabled={!selectedId || count === 0 || saving}>
                {saving
                  ? "Adicionando…"
                  : `Adicionar ${count > 0 ? `(${count})` : ""}`.trim()}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
