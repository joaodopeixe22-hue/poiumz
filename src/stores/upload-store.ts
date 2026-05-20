import { create } from "zustand";

export type UploadStatus = "queued" | "parsing" | "uploading" | "saving" | "done" | "error";

export interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: UploadStatus;
  progress: number; // 0..100
  error?: string;
  trackId?: string;
}

interface UploadState {
  items: UploadItem[];
  add: (files: File[]) => UploadItem[];
  update: (id: string, patch: Partial<UploadItem>) => void;
  remove: (id: string) => void;
  clearDone: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  items: [],
  add: (files) => {
    const items: UploadItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      size: f.size,
      status: "queued",
      progress: 0,
    }));
    set((s) => ({ items: [...items, ...s.items] }));
    return items;
  },
  update: (id, patch) =>
    set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
  clearDone: () => set((s) => ({ items: s.items.filter((it) => it.status !== "done") })),
}));
