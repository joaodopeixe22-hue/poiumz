import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  patch: z.object({
    genre: z.string().max(80).nullable().optional(),
    is_favorite: z.boolean().optional(),
  }),
});

export const bulkUpdateTracks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BulkUpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (Object.keys(data.patch).length === 0) return { updated: 0 };
    const { error } = await supabase
      .from("tracks")
      .update(data.patch)
      .in("id", data.ids)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { updated: data.ids.length };
  });

const TagsBulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  addTags: z.array(z.string().min(1).max(40)).max(20).optional(),
  removeTags: z.array(z.string().min(1).max(40)).max(20).optional(),
});

export const bulkUpdateTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TagsBulkSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.removeTags?.length) {
      for (const tag of data.removeTags) {
        await supabase
          .from("track_tags")
          .delete()
          .eq("user_id", userId)
          .eq("tag", tag.toLowerCase())
          .in("track_id", data.ids);
      }
    }
    if (data.addTags?.length) {
      const rows = data.ids.flatMap((tid) =>
        data.addTags!.map((tag) => ({ track_id: tid, user_id: userId, tag: tag.toLowerCase() })),
      );
      const { error } = await supabase
        .from("track_tags")
        .upsert(rows, { onConflict: "track_id,tag" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const HashSchema = z.object({ hashes: z.array(z.string().min(64).max(64)).min(1).max(200) });

export const findDuplicatesByHash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => HashSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("tracks")
      .select("id, content_hash, title, artist")
      .eq("user_id", userId)
      .in("content_hash", data.hashes);
    if (error) throw new Error(error.message);
    const map: Record<string, { id: string; title: string; artist: string | null }> = {};
    for (const r of rows ?? []) {
      if (r.content_hash) map[r.content_hash] = { id: r.id, title: r.title, artist: r.artist };
    }
    return { duplicates: map };
  });

const SessionCreateSchema = z.object({ totalFiles: z.number().int().min(1).max(2000) });

export const createUploadSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SessionCreateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // rate limit: max 5 active sessions
    const { count } = await supabase
      .from("upload_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active");
    if ((count ?? 0) >= 5) throw new Error("Too many active upload sessions");
    const { data: row, error } = await supabase
      .from("upload_sessions")
      .insert({ user_id: userId, total_files: data.totalFiles })
      .select()
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed");
    return { sessionId: row.id };
  });

const SessionUpdateSchema = z.object({
  sessionId: z.string().uuid(),
  completedDelta: z.number().int().optional(),
  failedDelta: z.number().int().optional(),
  status: z.enum(["active", "done", "cancelled"]).optional(),
});

export const updateUploadSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SessionUpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cur } = await supabase
      .from("upload_sessions")
      .select("completed_files, failed_files")
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .single();
    if (!cur) return { ok: false };
    const patch: { completed_files?: number; failed_files?: number; status?: string } = {};
    if (data.completedDelta)
      patch.completed_files = (cur.completed_files ?? 0) + data.completedDelta;
    if (data.failedDelta) patch.failed_files = (cur.failed_files ?? 0) + data.failedDelta;
    if (data.status) patch.status = data.status;
    if (Object.keys(patch).length === 0) return { ok: true };
    await supabase
      .from("upload_sessions")
      .update(patch)
      .eq("id", data.sessionId)
      .eq("user_id", userId);
    return { ok: true };
  });
