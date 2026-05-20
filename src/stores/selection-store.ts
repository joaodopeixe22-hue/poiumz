import { create } from "zustand";

interface SelectionState {
  selected: Set<string>;
  lastSelectedId: string | null;
  toggle: (id: string) => void;
  setRange: (ids: string[]) => void;
  selectOnly: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selected: new Set(),
  lastSelectedId: null,
  toggle: (id) =>
    set((s) => {
      const next = new Set(s.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selected: next, lastSelectedId: id };
    }),
  setRange: (ids) =>
    set((s) => {
      const next = new Set(s.selected);
      ids.forEach((x) => next.add(x));
      return { selected: next, lastSelectedId: ids[ids.length - 1] ?? s.lastSelectedId };
    }),
  selectOnly: (id) => set({ selected: new Set([id]), lastSelectedId: id }),
  selectAll: (ids) => set({ selected: new Set(ids), lastSelectedId: ids[ids.length - 1] ?? null }),
  clear: () => set({ selected: new Set(), lastSelectedId: null }),
  isSelected: (id) => get().selected.has(id),
}));
