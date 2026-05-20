import { create } from "zustand";

export type SortKey = "created_desc" | "title_asc" | "artist_asc" | "duration_asc" | "plays_desc";

interface LibraryState {
  search: string;
  sort: SortKey;
  favoritesOnly: boolean;
  genre?: string;
  folderId?: string;
  selected: Set<string>;
  setSearch: (v: string) => void;
  setSort: (v: SortKey) => void;
  setFavoritesOnly: (v: boolean) => void;
  setGenre: (v?: string) => void;
  setFolderId: (v?: string) => void;
  toggleSelect: (id: string, shiftRange?: string[]) => void;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  search: "",
  sort: "created_desc",
  favoritesOnly: false,
  selected: new Set(),
  setSearch: (search) => set({ search }),
  setSort: (sort) => set({ sort }),
  setFavoritesOnly: (favoritesOnly) => set({ favoritesOnly }),
  setGenre: (genre) => set({ genre }),
  setFolderId: (folderId) => set({ folderId }),
  toggleSelect: (id, shiftRange) =>
    set((s) => {
      const next = new Set(s.selected);
      if (shiftRange && shiftRange.length) {
        const allSelected = shiftRange.every((x) => next.has(x));
        shiftRange.forEach((x) => (allSelected ? next.delete(x) : next.add(x)));
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return { selected: next };
    }),
  clearSelection: () => set({ selected: new Set() }),
  selectAll: (ids) => set({ selected: new Set(ids) }),
}));
