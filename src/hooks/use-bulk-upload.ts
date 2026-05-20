import { useCallback, useRef } from "react";
import { useUploadStore, type UploadItem } from "@/stores/upload-store";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { findDuplicatesByHash, createUploadSession, updateUploadSession } from "@/lib/bulk.functions";
import { deleteTracks } from "@/lib/library.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const ACCEPTED_EXTS = ["mp3", "flac", "wav", "m4a", "aac"] as const;
const ACCEPTED_MIME = new Set([
  "audio/mpeg", "audio/mp3", "audio/flac", "audio/x-flac",
  "audio/wav", "audio/wave", "audio/x-wav",
  "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac",
]);
const MAX_SIZE = 50 * 1024 * 1024;
const MAX_BATCH = 500;
const MAX_ATTEMPTS = 3;

function getExt(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function parseFile(file: File) {
  const mm = await import("music-metadata-browser");
  const meta = await mm.parseBlob(file);
  const c = meta.common;
  let coverBlob: Blob | undefined;
  if (c.picture && c.picture[0]) {
    const pic = c.picture[0];
    coverBlob = new Blob([new Uint8Array(pic.data)], { type: pic.format || "image/jpeg" });
  }
  return {
    title: c.title?.toString().trim() || file.name.replace(/\.[^.]+$/, ""),
    artist: c.artist?.toString().trim() || null,
    album: c.album?.toString().trim() || null,
    genre: c.genre?.[0]?.toString().trim() || null,
    year: c.year ?? null,
    track_number: c.track?.no ?? null,
    duration: meta.format.duration ?? null,
    bitrate: meta.format.bitrate ? Math.round(meta.format.bitrate / 1000) : null,
    coverBlob,
  };
}

export function useBulkUpload() {
  const add = useUploadStore((s) => s.add);
  const update = useUploadStore((s) => s.update);
  const setSession = useUploadStore((s) => s.setSession);
  const setMinimized = useUploadStore((s) => s.setMinimized);
  const createSessionFn = useServerFn(createUploadSession);
  const updateSessionFn = useServerFn(updateUploadSession);
  const dupFn = useServerFn(findDuplicatesByHash);
  const delFn = useServerFn(deleteTracks);
  const qc = useQueryClient();

  const cancelledRef = useRef<Set<string>>(new Set());

  const processOne = useCallback(
    async (item: UploadItem, userId: string, sessionId: string) => {
      const policy = useUploadStore.getState().duplicatePolicy;
      try {
        if (cancelledRef.current.has(item.id)) {
          update(item.id, { status: "cancelled" });
          return;
        }
        // wait if paused
        while (useUploadStore.getState().isPaused) {
          await new Promise((r) => setTimeout(r, 300));
          if (cancelledRef.current.has(item.id)) {
            update(item.id, { status: "cancelled" });
            return;
          }
        }
        update(item.id, { status: "hashing", progress: 4, attempts: item.attempts + 1, startedAt: Date.now() });
        const hash = await sha256Hex(item.file);
        update(item.id, { hash, progress: 10 });

        // duplicate check
        const dupRes = await dupFn({ data: { hashes: [hash] } });
        const existing = dupRes.duplicates[hash];
        if (existing) {
          const effectivePolicy = policy === "ask" ? "skip" : policy;
          if (effectivePolicy === "skip") {
            update(item.id, { status: "skipped", progress: 100, error: `Duplicate of "${existing.title}"`, trackId: existing.id });
            return;
          }
          if (effectivePolicy === "replace") {
            await delFn({ data: { ids: [existing.id] } });
          }
        }

        update(item.id, { status: "parsing", progress: 18 });
        const meta = await parseFile(item.file);

        const ext = getExt(item.file.name);
        const trackId = crypto.randomUUID();
        const filePath = `${userId}/${trackId}.${ext}`;
        const mime = item.file.type || "audio/mpeg";

        update(item.id, { status: "uploading", progress: 30 });
        const { error: upErr } = await supabase.storage
          .from("tracks")
          .upload(filePath, item.file, { contentType: mime, upsert: false });
        if (upErr) throw new Error(upErr.message);

        let coverUrl: string | null = null;
        if (meta.coverBlob) {
          const coverPath = `${userId}/${trackId}.jpg`;
          const { error: covErr } = await supabase.storage
            .from("covers")
            .upload(coverPath, meta.coverBlob, {
              contentType: meta.coverBlob.type || "image/jpeg",
              upsert: true,
            });
          if (!covErr) {
            const { data } = supabase.storage.from("covers").getPublicUrl(coverPath);
            coverUrl = data.publicUrl;
          }
        }

        update(item.id, { status: "saving", progress: 88 });
        const insertContentHash = existing && policy === "keep_both" ? null : hash;
        const { error: insErr } = await supabase.from("tracks").insert({
          id: trackId,
          user_id: userId,
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          genre: meta.genre,
          year: meta.year,
          duration: meta.duration,
          bitrate: meta.bitrate,
          track_number: meta.track_number,
          cover_url: coverUrl,
          file_path: filePath,
          file_size: item.file.size,
          mime_type: mime,
          content_hash: insertContentHash,
        });
        if (insErr) {
          await supabase.storage.from("tracks").remove([filePath]);
          throw new Error(insErr.message);
        }

        update(item.id, { status: "done", progress: 100, trackId });
        updateSessionFn({ data: { sessionId, completedDelta: 1 } }).catch(() => {});
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        const attempts = useUploadStore.getState().items.find((x) => x.id === item.id)?.attempts ?? 1;
        if (attempts < MAX_ATTEMPTS && !cancelledRef.current.has(item.id)) {
          const backoff = Math.pow(3, attempts) * 1000;
          update(item.id, { status: "queued", progress: 0, error: `${msg} (retry in ${backoff / 1000}s)` });
          setTimeout(() => {
            const it = useUploadStore.getState().items.find((x) => x.id === item.id);
            if (it && it.status === "queued") processOne(it, userId, sessionId);
          }, backoff);
        } else {
          update(item.id, { status: "error", error: msg });
          updateSessionFn({ data: { sessionId, failedDelta: 1 } }).catch(() => {});
        }
      }
    },
    [update, dupFn, delFn, updateSessionFn]
  );

  const upload = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sign in required.");
        return;
      }
      const valid: File[] = [];
      for (const f of files.slice(0, MAX_BATCH)) {
        const ext = getExt(f.name);
        const okExt = (ACCEPTED_EXTS as readonly string[]).includes(ext);
        const okMime = !f.type || ACCEPTED_MIME.has(f.type);
        if (!okExt) { toast.error(`${f.name}: unsupported format`); continue; }
        if (!okMime) { toast.error(`${f.name}: invalid MIME type`); continue; }
        if (f.size > MAX_SIZE) { toast.error(`${f.name}: exceeds 50 MB`); continue; }
        valid.push(f);
      }
      if (!valid.length) return;

      let sessionId: string;
      try {
        const r = await createSessionFn({ data: { totalFiles: valid.length } });
        sessionId = r.sessionId;
        setSession(sessionId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to start session");
        return;
      }

      const items = add(valid);
      setMinimized(false);

      const queue = [...items];
      const concurrency = useUploadStore.getState().concurrency;
      const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length) {
          const it = queue.shift();
          if (!it) return;
          await processOne(it, session.user.id, sessionId);
        }
      });
      await Promise.all(workers);
      qc.invalidateQueries({ queryKey: ["tracks"] });
      updateSessionFn({ data: { sessionId, status: "done" } }).catch(() => {});
    },
    [add, processOne, setSession, setMinimized, createSessionFn, updateSessionFn, qc]
  );

  const cancelItem = useCallback(
    (id: string) => {
      cancelledRef.current.add(id);
      update(id, { status: "cancelled", error: "Cancelled" });
    },
    [update]
  );

  const retryItem = useCallback(
    async (id: string) => {
      const it = useUploadStore.getState().items.find((x) => x.id === id);
      if (!it) return;
      const sessionId = useUploadStore.getState().sessionId;
      if (!sessionId) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      cancelledRef.current.delete(id);
      update(id, { status: "queued", progress: 0, error: undefined, attempts: 0 });
      const fresh = useUploadStore.getState().items.find((x) => x.id === id)!;
      processOne(fresh, session.user.id, sessionId);
    },
    [update, processOne]
  );

  return { upload, cancelItem, retryItem };
}
