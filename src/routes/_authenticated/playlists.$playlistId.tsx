import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlaylist, removeTracksFromPlaylist, deletePlaylist, reorderPlaylistTracks } from "@/lib/playlists.functions";
import { getTrackSignedUrl } from "@/lib/library.functions";
import { usePlayerStore, type Track } from "@/stores/player-store";
import { CoverImage } from "@/components/library/cover-image";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect } from "react";
import { toast } from "sonner";

function MS({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols ${className}`} aria-hidden>{name}</span>;
}

function fmt(s?: number | null) {
  if (!s || !isFinite(s)) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function fmtTotal(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
}

export const Route = createFileRoute("/_authenticated/playlists/$playlistId")({
  head: () => ({ meta: [{ title: "Focus Audio — Playlist" }] }),
  component: PlaylistDetail,
});

type PT = { position: number; track: {
  id: string; title: string; artist: string | null; album: string | null;
  duration: number | null; cover_url: string | null;
} | null };

function PlaylistDetail() {
  const { playlistId } = Route.useParams();
  const getFn = useServerFn(getPlaylist);
  const signFn = useServerFn(getTrackSignedUrl);
  const removeFn = useServerFn(removeTracksFromPlaylist);
  const deleteFn = useServerFn(deletePlaylist);
  const reorderFn = useServerFn(reorderPlaylistTracks);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["playlist", playlistId],
    queryFn: () => getFn({ data: { id: playlistId } }),
  });

  const [order, setOrder] = useState<PT[]>([]);
  useEffect(() => {
    if (data?.tracks) {
      const list = data.tracks as unknown;
      setOrder(list as PT[]);
    }
  }, [data?.tracks]);

  const setCurrent = usePlayerStore((s) => s.setCurrentTrack);
  const play = usePlayerStore((s) => s.play);
  const enqueue = usePlayerStore((s) => s.enqueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);

  const playFrom = async (index: number) => {
    const item = order[index];
    if (!item?.track) return;
    try {
      const { url } = await signFn({ data: { id: item.track.id } });
      clearQueue();
      setCurrent({
        id: item.track.id,
        title: item.track.title,
        artist: item.track.artist ?? "Unknown",
        album: item.track.album ?? undefined,
        duration: item.track.duration ?? undefined,
        cover_url: item.track.cover_url ?? undefined,
        src: url,
      });
      play();
      const rest: Track[] = order.slice(index + 1).filter((r) => r.track).map((r) => ({
        id: r.track!.id,
        title: r.track!.title,
        artist: r.track!.artist ?? "Unknown",
        album: r.track!.album ?? undefined,
        duration: r.track!.duration ?? undefined,
        cover_url: r.track!.cover_url ?? undefined,
      }));
      if (rest.length) enqueue(rest);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to play");
    }
  };

  const removeMut = useMutation({
    mutationFn: (trackId: string) => removeFn({ data: { playlistId, trackIds: [trackId] } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlist", playlistId] });
      qc.invalidateQueries({ queryKey: ["playlists"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteFn({ data: { id: playlistId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Playlist deleted.");
      navigate({ to: "/playlists" });
    },
  });

  const reorderMut = useMutation({
    mutationFn: (orderedTrackIds: string[]) => reorderFn({ data: { playlistId, orderedTrackIds } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlist", playlistId] }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.findIndex((x) => x.track?.id === active.id);
    const newIdx = order.findIndex((x) => x.track?.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(order, oldIdx, newIdx);
    setOrder(next);
    reorderMut.mutate(next.map((x) => x.track!.id));
  };

  if (isLoading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-10 text-sm">Playlist not found.</div>;

  const pl = data.playlist;

  return (
    <div>
      <section
        className="px-10 pt-10 pb-8 relative overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 0% 0%, oklch(0.86 0.18 130 / 0.18), transparent 50%), radial-gradient(ellipse at 80% 30%, oklch(0.55 0.16 280 / 0.20), transparent 60%)",
        }}
      >
        <div className="flex flex-col md:flex-row gap-8 items-start md:items-end">
          <div
            className="size-48 md:size-56 rounded-xl border border-border shrink-0 grid place-items-center shadow-2xl overflow-hidden"
            style={
              pl.cover_url
                ? { background: `url(${pl.cover_url}) center/cover` }
                : {
                    background:
                      "conic-gradient(from 45deg at 50% 50%, oklch(0.86 0.18 130 / 0.5), oklch(0.55 0.16 280 / 0.5), oklch(0.86 0.18 130 / 0.5))",
                  }
            }
          >
            {!pl.cover_url && <MS name="queue_music" className="text-[64px] text-foreground/70" />}
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-block text-[10px] text-accent font-semibold tracking-wider uppercase bg-accent/10 px-2.5 py-1 rounded-full">
              Playlist
            </span>
            <h1 className="font-display text-5xl md:text-6xl mt-3 leading-[1.02] text-balance">{pl.name}</h1>
            {pl.description && (
              <p className="mt-3 text-sm text-muted-foreground max-w-2xl text-pretty">{pl.description}</p>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              {pl.tracks_count} tracks · {fmtTotal(Number(pl.duration_total) || 0)}
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={() => playFrom(0)}
            disabled={!order.length}
            className="size-14 rounded-full bg-accent text-accent-foreground grid place-items-center hover:scale-105 transition-transform shadow-lg shadow-accent/30 disabled:opacity-50"
          >
            <MS name="play_arrow" className="text-[30px]" />
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete playlist "${pl.name}"?`)) deleteMut.mutate();
            }}
            className="size-11 rounded-full border border-border text-muted-foreground hover:text-destructive hover:border-destructive grid place-items-center transition-colors"
            aria-label="Delete playlist"
          >
            <MS name="delete" className="text-[20px]" />
          </button>
        </div>
      </section>

      <section className="px-10 pb-12">
        {order.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No tracks yet. Select tracks in your library and add them here.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[2rem_2.5rem_1fr_1fr_3rem_2rem] gap-4 px-4 py-3 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
              <span className="text-center">#</span>
              <span></span>
              <span>Title</span>
              <span className="hidden md:block">Album</span>
              <span className="text-right">
                <MS name="schedule" className="text-[14px] inline-block" />
              </span>
              <span></span>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={order.filter((o) => o.track).map((o) => o.track!.id)} strategy={verticalListSortingStrategy}>
                <ul>
                  {order.map((t, i) =>
                    t.track ? (
                      <SortableRow
                        key={t.track.id}
                        index={i}
                        track={t.track}
                        onPlay={() => playFrom(i)}
                        onRemove={() => removeMut.mutate(t.track!.id)}
                      />
                    ) : null
                  )}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        )}
      </section>
    </div>
  );
}

function SortableRow({
  index, track, onPlay, onRemove,
}: {
  index: number;
  track: { id: string; title: string; artist: string | null; album: string | null; duration: number | null; cover_url: string | null };
  onPlay: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[2rem_2.5rem_1fr_1fr_3rem_2rem] gap-4 px-4 h-14 items-center hover:bg-secondary/40 group rounded-md transition-colors"
    >
      <span className="text-center text-xs text-muted-foreground tabular-nums">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Drag to reorder"
        >
          <MS name="drag_indicator" className="text-[16px] text-muted-foreground" />
        </button>
        <span className="group-hover:hidden">{index + 1}</span>
      </span>
      <button
        onClick={onPlay}
        className="size-9 rounded-md overflow-hidden bg-secondary grid place-items-center relative"
      >
        <CoverImage src={track.cover_url} seed={track.id} className="w-full h-full absolute inset-0" />
        <MS name="play_arrow" className="text-[18px] opacity-0 group-hover:opacity-100 transition-opacity relative z-10 bg-black/40 rounded-full text-white" />
      </button>
      <div className="min-w-0">
        <p className="text-sm truncate">{track.title}</p>
        <p className="text-xs text-muted-foreground truncate">{track.artist ?? "Unknown"}</p>
      </div>
      <p className="text-xs text-muted-foreground truncate hidden md:block">{track.album ?? "—"}</p>
      <p className="text-xs font-mono text-muted-foreground tabular-nums text-right">{fmt(track.duration)}</p>
      <button
        onClick={onRemove}
        className="size-7 grid place-items-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove"
      >
        <MS name="close" className="text-[16px]" />
      </button>
    </li>
  );
}
