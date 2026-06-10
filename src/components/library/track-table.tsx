import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listTracks,
  getTrackSignedUrl,
  toggleFavorite,
  deleteTracks,
  incrementPlayCount,
} from "@/lib/library.functions";
import { useLibraryStore } from "@/stores/library-store";
import { useSelectionStore } from "@/stores/selection-store";
import { usePlayerStore, type Track } from "@/stores/player-store";
import { CoverImage } from "./cover-image";
import { toast } from "sonner";

function MS({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols ${className}`} aria-hidden>
      {name}
    </span>
  );
}

function fmtDuration(s?: number | null) {
  if (!s || !isFinite(s)) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${sec}`;
}

export type TrackRow = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  genre: string | null;
  duration: number | null;
  cover_url: string | null;
  is_favorite: boolean;
  play_count: number;
  bitrate: number | null;
  year: number | null;
};

export function TrackTable({ onEdit }: { onEdit?: (id: string) => void }) {
  const { search, sort, favoritesOnly, genre, folderId } = useLibraryStore();
  const selected = useSelectionStore((s) => s.selected);
  const toggle = useSelectionStore((s) => s.toggle);
  const selectAll = useSelectionStore((s) => s.selectAll);
  const clearSelection = useSelectionStore((s) => s.clear);

  const listFn = useServerFn(listTracks);
  const signFn = useServerFn(getTrackSignedUrl);
  const favFn = useServerFn(toggleFavorite);
  const delFn = useServerFn(deleteTracks);
  const playCountFn = useServerFn(incrementPlayCount);

  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["tracks", { search, sort, favoritesOnly, genre, folderId }],
    queryFn: () => listFn({ data: { search, sort, favoritesOnly, genre, folderId } }),
  });

  const tracks: TrackRow[] = (data?.tracks ?? []) as TrackRow[];

  const favMut = useMutation({
    mutationFn: (id: string) => favFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracks"] }),
  });

  const delMut = useMutation({
    mutationFn: (ids: string[]) => delFn({ data: { ids } }),
    onSuccess: (r) => {
      clearSelection();
      qc.invalidateQueries({ queryKey: ["tracks"] });
      toast.success(`${r.deleted} removida(s).`);
    },
  });

  const setCurrent = usePlayerStore((s) => s.setCurrentTrack);
  const play = usePlayerStore((s) => s.play);
  const enqueue = usePlayerStore((s) => s.enqueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);

  const playedRef = useRef<Set<string>>(new Set());

  const playTrack = async (t: TrackRow, queueRest?: TrackRow[]) => {
    try {
      const { url } = await signFn({ data: { id: t.id } });
      const pt: Track = {
        id: t.id,
        title: t.title,
        artist: t.artist ?? "Desconhecido",
        album: t.album ?? undefined,
        duration: t.duration ?? undefined,
        cover_url: t.cover_url ?? undefined,
        src: url,
      };
      clearQueue();
      setCurrent(pt);
      play();
      if (queueRest && queueRest.length) {
        enqueue(
          queueRest.map((r) => ({
            id: r.id,
            title: r.title,
            artist: r.artist ?? "Desconhecido",
            album: r.album ?? undefined,
            duration: r.duration ?? undefined,
            cover_url: r.cover_url ?? undefined,
          })),
        );
      }
      if (!playedRef.current.has(t.id)) {
        playedRef.current.add(t.id);
        playCountFn({ data: { id: t.id } }).catch(() => {});
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reproduzir");
    }
  };

  const parentRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  const allIds = useMemo(() => tracks.map((t) => t.id), [tracks]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  useEffect(() => () => clearSelection(), [clearSelection]);

  if (isLoading) {
    return (
      <div className="px-10 py-12 text-sm text-muted-foreground">Carregando biblioteca…</div>
    );
  }

  if (!tracks.length) {
    return (
      <div className="px-10 py-20 text-center">
        <div className="mx-auto size-14 rounded-full bg-secondary grid place-items-center mb-4">
          <MS name="library_music" className="text-[28px] text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold">Nenhuma faixa ainda</p>
        <p className="text-xs text-muted-foreground mt-1">Envie um MP3 para começar.</p>
      </div>
    );
  }

  return (
    <div className="px-6">
      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        <div className="grid grid-cols-[40px_42px_1fr_220px_120px_80px_60px] gap-3 items-center px-4 h-10 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          <input
            type="checkbox"
            aria-label="Selecionar todas"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={(e) => (e.target.checked ? selectAll(allIds) : clearSelection())}
            className="size-3.5 accent-accent"
          />
          <span>#</span>
          <span>Título</span>
          <span>Álbum</span>
          <span>Gênero</span>
          <span className="text-right">
            <MS name="schedule" className="text-[14px] inline-block" />
          </span>
          <span></span>
        </div>
        <div ref={parentRef} className="max-h-[calc(100vh-340px)] overflow-y-auto">
          <div style={{ height: virt.getTotalSize(), position: "relative" }}>
            {virt.getVirtualItems().map((vi) => {
              const t = tracks[vi.index];
              const isSel = selected.has(t.id);
              return (
                <div
                  key={t.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${vi.start}px)`,
                    height: vi.size,
                  }}
                  className={`grid grid-cols-[40px_42px_1fr_220px_120px_80px_60px] gap-3 items-center px-4 group hover:bg-secondary/40 transition-colors ${
                    isSel ? "bg-secondary/60" : ""
                  }`}
                  onDoubleClick={() => playTrack(t, tracks.slice(vi.index + 1))}
                >
                  <input
                    type="checkbox"
                    aria-label="Selecionar faixa"
                    checked={isSel}
                    onChange={() => toggle(t.id)}
                    className="size-3.5 accent-accent"
                  />
                  <button
                    onClick={() => playTrack(t, tracks.slice(vi.index + 1))}
                    className="size-9 rounded-md overflow-hidden bg-secondary grid place-items-center text-muted-foreground hover:text-foreground transition-colors relative"
                    aria-label="Tocar"
                  >
                    <CoverImage
                      src={t.cover_url}
                      seed={t.id}
                      className="w-full h-full absolute inset-0"
                    />
                    <MS
                      name="play_arrow"
                      className="text-[18px] opacity-0 group-hover:opacity-100 transition-opacity relative z-10 bg-black/40 rounded-full"
                    />
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.artist ?? "Desconhecido"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t.album ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.genre ?? "—"}</p>
                  <p className="text-xs font-mono text-muted-foreground tabular-nums text-right">
                    {fmtDuration(t.duration)}
                  </p>
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => favMut.mutate(t.id)}
                      className={`size-7 grid place-items-center rounded-full hover:bg-secondary transition-colors ${
                        t.is_favorite ? "text-accent" : "text-muted-foreground"
                      }`}
                      aria-label="Favoritar"
                    >
                      <MS name="favorite" className="text-[16px]" />
                    </button>
                    <button
                      onClick={() => onEdit?.(t.id)}
                      className="size-7 grid place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      aria-label="Editar"
                    >
                      <MS name="edit" className="text-[16px]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <SelectionToolbar
          count={selected.size}
          onClear={clearSelection}
          onDelete={() => {
            if (
              !confirm(
                `Excluir ${selected.size} faixa(s)? Esta ação não pode ser desfeita.`,
              )
            )
              return;
            delMut.mutate(Array.from(selected));
          }}
        />
      )}
    </div>
  );
}

function SelectionToolbar({
  count,
  onClear,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-card border border-border shadow-xl px-3 py-2">
      <span className="text-xs text-muted-foreground px-2">{count} selecionada(s)</span>
      <button
        onClick={onDelete}
        className="text-xs px-3 py-1.5 rounded-full bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors flex items-center gap-1.5"
      >
        <MS name="delete" className="text-[14px]" /> Excluir
      </button>
      <button
        onClick={onClear}
        className="size-7 grid place-items-center rounded-full text-muted-foreground hover:bg-secondary transition-colors"
        aria-label="Limpar"
      >
        <MS name="close" className="text-[16px]" />
      </button>
    </div>
  );
}
