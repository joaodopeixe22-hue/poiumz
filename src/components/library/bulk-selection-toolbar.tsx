import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelectionStore } from "@/stores/selection-store";
import { deleteTracks } from "@/lib/library.functions";
import { bulkUpdateTracks, bulkUpdateTags } from "@/lib/bulk.functions";
import { listPlaylists, createPlaylist, addTracksToPlaylist } from "@/lib/playlists.functions";
import { toast } from "sonner";

function MS({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols ${className}`} aria-hidden>
      {name}
    </span>
  );
}

export function BulkSelectionToolbar() {
  const selected = useSelectionStore((s) => s.selected);
  const clear = useSelectionStore((s) => s.clear);
  const count = selected.size;

  const qc = useQueryClient();
  const delFn = useServerFn(deleteTracks);
  const bulkFn = useServerFn(bulkUpdateTracks);

  const delMut = useMutation({
    mutationFn: (ids: string[]) => delFn({ data: { ids } }),
    onSuccess: (r) => {
      clear();
      qc.invalidateQueries({ queryKey: ["tracks"] });
      qc.invalidateQueries({ queryKey: ["playlists"] });
      toast.success(`${r.deleted} removida(s).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const favMut = useMutation({
    mutationFn: (ids: string[]) => bulkFn({ data: { ids, patch: { is_favorite: true } } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracks"] });
      toast.success("Adicionadas aos favoritos.");
    },
  });

  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
      if (e.key === "Delete" || (e.key === "Backspace" && (e.metaKey || e.ctrlKey))) {
        if (confirm(`Excluir ${count} faixa(s)?`)) delMut.mutate(Array.from(selected));
      }
      if (e.key === "f" && !e.metaKey && !e.ctrlKey) {
        const tgt = e.target as HTMLElement;
        if (tgt.tagName !== "INPUT" && tgt.tagName !== "TEXTAREA") {
          favMut.mutate(Array.from(selected));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, selected, clear, delMut, favMut]);

  if (count === 0) return null;

  return (
    <>
      <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-full bg-card/95 backdrop-blur-xl border border-border shadow-2xl px-2 py-1.5">
        <span className="text-xs font-medium px-3">{count} selecionada(s)</span>
        <span className="w-px h-5 bg-border mx-0.5" />
        <ToolbarBtn
          icon="favorite"
          label="Favoritar"
          onClick={() => favMut.mutate(Array.from(selected))}
        />
        <AddToPlaylistPopover trackIds={Array.from(selected)} onAdded={clear} />
        <ToolbarBtn icon="edit" label="Editar" onClick={() => setEditOpen(true)} />
        <ToolbarBtn
          icon="delete"
          label="Excluir"
          danger
          onClick={() => {
            if (
              confirm(`Excluir ${count} faixa(s)? Esta ação não pode ser desfeita.`)
            ) {
              delMut.mutate(Array.from(selected));
            }
          }}
        />
        <span className="w-px h-5 bg-border mx-0.5" />
        <button
          onClick={clear}
          className="size-7 grid place-items-center rounded-full text-muted-foreground hover:bg-secondary transition-colors"
          aria-label="Limpar"
        >
          <MS name="close" className="text-[16px]" />
        </button>
      </div>

      <BulkEditModal open={editOpen} onOpenChange={setEditOpen} trackIds={Array.from(selected)} />
    </>
  );
}

function ToolbarBtn({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs transition-colors ${
        danger
          ? "text-destructive hover:bg-destructive/15"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
    >
      <MS name={icon} className="text-[14px]" />
      <span>{label}</span>
    </button>
  );
}

function AddToPlaylistPopover({ trackIds, onAdded }: { trackIds: string[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const listFn = useServerFn(listPlaylists);
  const addFn = useServerFn(addTracksToPlaylist);
  const createFn = useServerFn(createPlaylist);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["playlists"],
    queryFn: () => listFn({}),
    enabled: open,
  });

  const addMut = useMutation({
    mutationFn: (playlistId: string) => addFn({ data: { playlistId, trackIds, mode: "append" } }),
    onSuccess: (r) => {
      toast.success(
        `+${r.added} adicionada(s)${r.skipped ? `, ${r.skipped} já presente(s)` : ""}.`,
      );
      qc.invalidateQueries({ queryKey: ["playlists"] });
      qc.invalidateQueries({ queryKey: ["playlist"] });
      setOpen(false);
      onAdded();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { name: newName.trim(), trackIds } }),
    onSuccess: () => {
      toast.success(`Playlist "${newName}" criada.`);
      qc.invalidateQueries({ queryKey: ["playlists"] });
      setOpen(false);
      setCreating(false);
      setNewName("");
      onAdded();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <MS name="playlist_add" className="text-[14px]" />
          <span>Playlist</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={8}
          className="z-50 w-64 rounded-xl bg-card border border-border shadow-2xl p-2 max-h-72 overflow-y-auto"
        >
          {creating ? (
            <div className="p-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da nova playlist"
                className="w-full h-9 px-3 rounded-md bg-secondary text-sm outline-none border border-transparent focus:border-accent"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) createMut.mutate();
                  if (e.key === "Escape") setCreating(false);
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setCreating(false)}
                  className="flex-1 h-8 rounded-md text-xs text-muted-foreground hover:bg-secondary"
                >
                  Cancelar
                </button>
                <button
                  disabled={!newName.trim() || createMut.isPending}
                  onClick={() => createMut.mutate()}
                  className="flex-1 h-8 rounded-md text-xs bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Criar
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-2.5 h-8 rounded-md text-xs hover:bg-secondary transition-colors"
              >
                <MS name="add" className="text-[16px] text-accent" />
                <span>Nova playlist…</span>
              </button>
              {(data?.playlists ?? []).length > 0 && <div className="h-px bg-border my-1" />}
              {(data?.playlists ?? []).map((p) => (
                <button
                  key={p.id}
                  onClick={() => addMut.mutate(p.id)}
                  className="w-full flex items-center gap-2 px-2.5 h-8 rounded-md text-xs hover:bg-secondary transition-colors text-left"
                >
                  <MS name="queue_music" className="text-[16px] text-muted-foreground" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground">{p.tracks_count}</span>
                </button>
              ))}
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function BulkEditModal({
  open,
  onOpenChange,
  trackIds,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trackIds: string[];
}) {
  const [genre, setGenre] = useState("");
  const [addTags, setAddTags] = useState("");
  const updateFn = useServerFn(bulkUpdateTracks);
  const tagsFn = useServerFn(bulkUpdateTags);
  const qc = useQueryClient();
  const clear = useSelectionStore((s) => s.clear);

  const mut = useMutation({
    mutationFn: async () => {
      if (genre.trim()) {
        await updateFn({ data: { ids: trackIds, patch: { genre: genre.trim() } } });
      }
      const tags = addTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tags.length) {
        await tagsFn({ data: { ids: trackIds, addTags: tags } });
      }
    },
    onSuccess: () => {
      toast.success(`${trackIds.length} faixa(s) atualizada(s).`);
      qc.invalidateQueries({ queryKey: ["tracks"] });
      onOpenChange(false);
      clear();
      setGenre("");
      setAddTags("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[460px] max-w-[92vw] rounded-2xl bg-card border border-border p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold">
            Editar {trackIds.length} faixa(s)
          </Dialog.Title>
          <Dialog.Description className="text-xs text-muted-foreground mt-1">
            Deixe um campo vazio para manter os valores atuais.
          </Dialog.Description>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Gênero</label>
              <input
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="ex.: Ambiente"
                className="mt-1.5 w-full h-10 px-3 rounded-md bg-secondary text-sm outline-none border border-transparent focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Adicionar tags (separadas por vírgula)
              </label>
              <input
                value={addTags}
                onChange={(e) => setAddTags(e.target.value)}
                placeholder="foco, instrumental"
                className="mt-1.5 w-full h-10 px-3 rounded-md bg-secondary text-sm outline-none border border-transparent focus:border-accent"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-2 justify-end">
            <Dialog.Close asChild>
              <button className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:bg-secondary">
                Cancelar
              </button>
            </Dialog.Close>
            <button
              disabled={mut.isPending || (!genre.trim() && !addTags.trim())}
              onClick={() => mut.mutate()}
              className="h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {mut.isPending ? "Salvando…" : "Aplicar"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
