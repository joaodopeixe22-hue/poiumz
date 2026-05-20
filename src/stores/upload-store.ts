import { create } from "zustand";

export type UploadStatus =
  | "queued"
  | "hashing"
  | "parsing"
  | "uploading"
  | "saving"
  | "done"
  | "error"
  | "skipped"
  | "cancelled";

export type DuplicatePolicy = "ask" | "skip" | "replace" | "keep_both";

export interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: UploadStatus;
  progress: number;
  error?: string;
  trackId?: string;
  hash?: string;
  attempts: number;
  bytesUploaded: number;
  startedAt?: number;
}

interface UploadState {
  items: UploadItem[];
  sessionId: string | null;
  isPaused: boolean;
  isMinimized: boolean;
  concurrency: number;
  duplicatePolicy: DuplicatePolicy;
  add: (files: File[]) => UploadItem[];
  update: (id: string, patch: Partial<UploadItem>) => void;
  remove: (id: string) => void;
  clearDone: () => void;
  clearAll: () => void;
  setSession: (id: string | null) => void;
  setPaused: (v: boolean) => void;
  setMinimized: (v: boolean) => void;
  setConcurrency: (n: number) => void;
  setDuplicatePolicy: (p: DuplicatePolicy) => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  items: [],
  sessionId: null,
  isPaused: false,
  isMinimized: false,
  concurrency: 3,
  duplicatePolicy: "ask",
  add: (files) => {
    const items: UploadItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      size: f.size,
      status: "queued",
      progress: 0,
      attempts: 0,
      bytesUploaded: 0,
    }));
    set((s) => ({ items: [...items, ...s.items] }));
    return items;
  },
  update: (id, patch) =>
    set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
  clearDone: () =>
    set((s) => ({ items: s.items.filter((it) => it.status !== "done" && it.status !== "skipped") })),
  clearAll: () => set({ items: [], sessionId: null }),
  setSession: (sessionId) => set({ sessionId }),
  setPaused: (isPaused) => set({ isPaused }),
  setMinimized: (isMinimized) => set({ isMinimized }),
  setConcurrency: (n) => set({ concurrency: Math.max(1, Math.min(6, n)) }),
  setDuplicatePolicy: (duplicatePolicy) => set({ duplicatePolicy }),
}));

export function uploadStats(items: UploadItem[]) {
  const total = items.length;
  if (!total) return { total: 0, done: 0, failed: 0, active: 0, pct: 0 };
  const done = items.filter((i) => i.status === "done" || i.status === "skipped").length;
  const failed = items.filter((i) => i.status === "error").length;
  const active = items.filter((i) =>
    ["hashing", "parsing", "uploading", "saving"].includes(i.status)
  ).length;
  const pct = Math.round((done / total) * 100);
  return { total, done, failed, active, pct };
}
