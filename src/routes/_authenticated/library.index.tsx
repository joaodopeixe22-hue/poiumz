import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-shell";
import { TrackTable } from "@/components/library/track-table";
import { TrackEditSheet } from "@/components/library/track-edit-sheet";
import { useLibraryStore, type SortKey } from "@/stores/library-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function MS({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols ${className}`} aria-hidden>
      {name}
    </span>
  );
}

export const Route = createFileRoute("/_authenticated/library/")({
  head: () => ({ meta: [{ title: "Focus Audio — Library" }] }),
  component: LibraryPage,
});

function LibraryPage() {
  const navigate = useNavigate();
  const search = useLibraryStore((s) => s.search);
  const setSearch = useLibraryStore((s) => s.setSearch);
  const sort = useLibraryStore((s) => s.sort);
  const setSort = useLibraryStore((s) => s.setSort);
  const favoritesOnly = useLibraryStore((s) => s.favoritesOnly);
  const setFavoritesOnly = useLibraryStore((s) => s.setFavoritesOnly);

  const [editingId, setEditingId] = useState<string | undefined>();

  return (
    <div className="pb-10">
      <div className="flex items-start justify-between px-10 pt-10 pb-6 gap-6">
        <div>
          <p className="text-xs text-accent font-medium tracking-wide mb-2 uppercase">
            Your collection
          </p>
          <h1 className="font-display text-4xl">Library.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every track you uploaded — search, edit, organize.
          </p>
        </div>
        <Link
          to="/library/upload"
          className="flex items-center gap-2 h-10 px-5 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:scale-[1.02] transition-transform shadow-lg shadow-accent/20"
        >
          <MS name="upload" className="text-[18px]" /> Upload
        </Link>
      </div>

      <div className="px-10 pb-6 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px] relative">
          <MS
            name="search"
            className="text-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, artist, album…"
            className="w-full h-10 pl-10 pr-4 rounded-full bg-secondary/70 border border-transparent focus:border-border focus:bg-secondary text-sm placeholder:text-muted-foreground outline-none transition-colors"
          />
        </div>
        <button
          onClick={() => setFavoritesOnly(!favoritesOnly)}
          className={`h-10 px-4 rounded-full border text-sm transition-colors flex items-center gap-2 ${
            favoritesOnly
              ? "border-accent text-accent bg-accent/10"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <MS name="favorite" className="text-[16px]" /> Favorites
        </button>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-10 w-44 rounded-full bg-secondary/70 border-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">Recently added</SelectItem>
            <SelectItem value="title_asc">Title (A–Z)</SelectItem>
            <SelectItem value="artist_asc">Artist (A–Z)</SelectItem>
            <SelectItem value="duration_asc">Duration</SelectItem>
            <SelectItem value="plays_desc">Most played</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="px-4">
        <TrackTable onEdit={(id) => setEditingId(id)} />
      </div>

      <TrackEditSheet
        trackId={editingId}
        open={!!editingId}
        onClose={() => setEditingId(undefined)}
      />
    </div>
  );
}
