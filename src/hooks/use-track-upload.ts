import { useCallback } from "react";
import { useUploadStore, type UploadItem } from "@/stores/upload-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ACCEPTED_EXTS = ["mp3", "flac", "wav", "m4a", "aac"] as const;
const ACCEPTED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/flac",
  "audio/x-flac",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
]);
const MAX_SIZE = 60 * 1024 * 1024; // 60MB
const MAX_BATCH = 20;
const CONCURRENCY = 3;

function getExt(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
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

export function useTrackUpload() {
  const add = useUploadStore((s) => s.add);
  const update = useUploadStore((s) => s.update);

  const processOne = useCallback(
    async (item: UploadItem, userId: string) => {
      try {
        update(item.id, { status: "parsing", progress: 5 });
        const meta = await parseFile(item.file);

        const ext = getExt(item.file.name);
        const trackId = crypto.randomUUID();
        const filePath = `${userId}/${trackId}.${ext}`;
        const mime = item.file.type || "audio/mpeg";

        update(item.id, { status: "uploading", progress: 25 });
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

        update(item.id, { status: "saving", progress: 85 });
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
        });
        if (insErr) {
          await supabase.storage.from("tracks").remove([filePath]);
          throw new Error(insErr.message);
        }

        update(item.id, { status: "done", progress: 100, trackId });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha no envio";
        update(item.id, { status: "error", error: msg, progress: 0 });
      }
    },
    [update],
  );

  const upload = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Login necessário.");
        return;
      }
      const valid: File[] = [];
      for (const f of files.slice(0, MAX_BATCH)) {
        const ext = getExt(f.name);
        const okExt = (ACCEPTED_EXTS as readonly string[]).includes(ext);
        const okMime = !f.type || ACCEPTED_MIME.has(f.type);
        if (!okExt) {
          toast.error(`${f.name}: unsupported format`);
          continue;
        }
        if (!okMime) {
          toast.error(`${f.name}: invalid MIME type`);
          continue;
        }
        if (f.size > MAX_SIZE) {
          toast.error(`${f.name}: exceeds 60 MB`);
          continue;
        }
        valid.push(f);
      }
      if (!valid.length) return;
      const items = add(valid);

      // simple concurrency pool
      const queue = [...items];
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        while (queue.length) {
          const item = queue.shift();
          if (!item) return;
          await processOne(item, session.user.id);
        }
      });
      await Promise.all(workers);
    },
    [add, processOne],
  );

  return { upload };
}
