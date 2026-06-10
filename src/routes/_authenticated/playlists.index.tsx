import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPlaylists, createPlaylist } from "@/lib/playlists.functions";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/layout/page-shell";
import { toast } from "sonner";

function MS({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols ${className}`} aria-hidden>
      {name}
    </span>
  );
}

export const Route = createFileRoute("/_authenticated/playlists/")({
  head: () => ({ meta: [{ title: "Focus Audio — Playlists" }] }),
  component: PlaylistsIndex,
});

function PlaylistsIndex() {
  const listFn = useServerFn(listPlaylists);
  const { data, isLoading } = useQuery({ queryKey: ["playlists"], queryFn: () => listFn({}) });
  const playlists = data?.playlists ?? [];
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader
        eyebrow="Suas seleções"
        title="Playlists"
        subtitle="Crie e organize as suas próprias."
      />
      <div className="px-10 pb-6 flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 h-10 px-4 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <MS name="add" className="text-[18px]" />
          Nova playlist
        </button>
      </div>

      {isLoading ? (
        <p className="px-10 text-sm text-muted-foreground">Carregando…</p>
      ) : playlists.length === 0 ? (
        <div className="px-10 py-16 text-center">
          <div className="mx-auto size-14 rounded-full bg-secondary grid place-items-center mb-4">
            <MS name="queue_music" className="text-[28px] text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">Nenhuma playlist ainda</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crie uma para começar a organizar suas músicas.
          </p>
        </div>
      ) : (
        <div className="px-10 pb-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {playlists.map((p, i) => (
            <Link
              key={p.id}
              to="/playlists/$playlistId"
              params={{ playlistId: p.id }}
              className="group cursor-pointer"
            >
              <div
                className="relative w-full aspect-square rounded-xl overflow-hidden border border-border grid place-items-center"
                style={{
                  background: p.cover_url
                    ? `url(${p.cover_url}) center/cover`
                    : `linear-gradient(${135 + i * 25}deg, oklch(0.${35 + (i % 5) * 4} 0.${10 + (i % 4) * 2} ${100 + ((i * 40) % 360)}), oklch(0.${20 + (i % 4) * 2} 0.${4 + (i % 3)} ${260 + ((i * 20) % 360)}))`,
                }}
              >
                {!p.cover_url && (
                  <MS name="queue_music" className="text-[44px] text-foreground/40" />
                )}
                <span className="absolute bottom-3 right-3 size-11 rounded-full bg-accent text-accent-foreground grid place-items-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-lg shadow-accent/30">
                  <MS name="play_arrow" className="text-[24px]" />
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-tight truncate">{p.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.tracks_count} {p.tracks_count === 1 ? "faixa" : "faixas"}
              </p>
            </Link>
          ))}
        </div>
      )}

      <CreatePlaylistDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function CreatePlaylistDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createFn = useServerFn(createPlaylist);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () =>
      createFn({ data: { name: name.trim(), description: description.trim() || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      toast.success(`Playlist "${name}" criada.`);
      setName("");
      setDescription("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[460px] max-w-[92vw] rounded-2xl bg-card border border-border p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold">Nova playlist</Dialog.Title>
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Minha playlist"
                className="mt-1.5 w-full h-10 px-3 rounded-md bg-secondary text-sm outline-none border border-transparent focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Descrição (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1.5 w-full px-3 py-2 rounded-md bg-secondary text-sm outline-none border border-transparent focus:border-accent resize-none"
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
              disabled={!name.trim() || mut.isPending}
              onClick={() => mut.mutate()}
              className="h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {mut.isPending ? "Criando…" : "Criar"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
