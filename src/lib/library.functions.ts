import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ListSchema = z.object({
  search: z.string().max(200).optional(),
  sort: z.enum(["created_desc", "title_asc", "artist_asc", "duration_asc", "plays_desc"]).default("created_desc"),
  favoritesOnly: z.boolean().optional(),
  genre: z.string().max(80).optional(),
  folderId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(1000).default(500),
});

export const listTracks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let trackIds: string[] | null = null;

    if (data.folderId) {
      const { data: rows, error } = await supabase
        .from("track_folders")
        .select("track_id")
        .eq("folder_id", data.folderId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      trackIds = rows.map((r) => r.track_id);
      if (trackIds.length === 0) return { tracks: [] };
    }

    let q = supabase.from("tracks").select("*").eq("user_id", userId).limit(data.limit);

    if (trackIds) q = q.in("id", trackIds);
    if (data.favoritesOnly) q = q.eq("is_favorite", true);
    if (data.genre) q = q.eq("genre", data.genre);
    if (data.search) {
      const s = `%${data.search.replace(/[%_]/g, "")}%`;
      q = q.or(`title.ilike.${s},artist.ilike.${s},album.ilike.${s}`);
    }

    switch (data.sort) {
      case "title_asc": q = q.order("title", { ascending: true }); break;
      case "artist_asc": q = q.order("artist", { ascending: true, nullsFirst: false }); break;
      case "duration_asc": q = q.order("duration", { ascending: true, nullsFirst: false }); break;
      case "plays_desc": q = q.order("play_count", { ascending: false }); break;
      default: q = q.order("created_at", { ascending: false });
    }

    const { data: tracks, error } = await q;
    if (error) throw new Error(error.message);
    return { tracks: tracks ?? [] };
  });

const IdSchema = z.object({ id: z.string().uuid() });

export const getTrackSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: track, error: tErr } = await supabase
      .from("tracks").select("file_path,user_id").eq("id", data.id).single();
    if (tErr || !track) throw new Error("Track not found");
    if (track.user_id !== userId) throw new Error("Forbidden");
    const { data: signed, error } = await supabase.storage
      .from("tracks").createSignedUrl(track.file_path, 3600);
    if (error || !signed) throw new Error(error?.message ?? "Failed to sign URL");
    return { url: signed.signedUrl };
  });

const UpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(300).optional(),
  artist: z.string().max(200).nullable().optional(),
  album: z.string().max(200).nullable().optional(),
  genre: z.string().max(80).nullable().optional(),
  year: z.number().int().min(0).max(3000).nullable().optional(),
  track_number: z.number().int().min(0).max(9999).nullable().optional(),
  cover_url: z.string().url().nullable().optional(),
});

export const updateTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const { error } = await supabase.from("tracks").update(patch).eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: rErr } = await supabase
      .from("tracks").select("is_favorite").eq("id", data.id).eq("user_id", userId).single();
    if (rErr || !row) throw new Error("Track not found");
    const { error } = await supabase.from("tracks")
      .update({ is_favorite: !row.is_favorite }).eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { is_favorite: !row.is_favorite };
  });

const DeleteSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });

export const deleteTracks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeleteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error: rErr } = await supabase
      .from("tracks").select("id,file_path,cover_url").in("id", data.ids).eq("user_id", userId);
    if (rErr) throw new Error(rErr.message);
    if (!rows || rows.length === 0) return { ok: true, deleted: 0 };

    const filePaths = rows.map((r) => r.file_path).filter(Boolean) as string[];
    if (filePaths.length) await supabase.storage.from("tracks").remove(filePaths);

    const coverPaths = rows
      .map((r) => {
        if (!r.cover_url) return null;
        const m = r.cover_url.match(/\/covers\/(.+)$/);
        return m ? m[1] : null;
      })
      .filter(Boolean) as string[];
    if (coverPaths.length) await supabase.storage.from("covers").remove(coverPaths);

    const { error } = await supabase.from("tracks").delete().in("id", rows.map((r) => r.id)).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: rows.length };
  });

export const incrementPlayCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("tracks")
      .select("play_count").eq("id", data.id).eq("user_id", userId).single();
    const next = (row?.play_count ?? 0) + 1;
    await supabase.from("tracks")
      .update({ play_count: next, last_played_at: new Date().toISOString() })
      .eq("id", data.id).eq("user_id", userId);
    return { play_count: next };
  });

export const listFolders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("folders").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { folders: data ?? [] };
  });

const FolderCreateSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

export const createFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => FolderCreateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: folder, error } = await supabase
      .from("folders").insert({ user_id: userId, name: data.name, color: data.color ?? null })
      .select().single();
    if (error) throw new Error(error.message);
    return { folder };
  });

export const deleteFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("folders").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const FolderMembershipSchema = z.object({
  folderId: z.string().uuid(),
  trackIds: z.array(z.string().uuid()).min(1).max(200),
});

export const addTracksToFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => FolderMembershipSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rows = data.trackIds.map((tid) => ({
      track_id: tid, folder_id: data.folderId, user_id: userId,
    }));
    const { error } = await supabase.from("track_folders").upsert(rows, { onConflict: "track_id,folder_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("track_tags").select("tag,track_id").eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { tags: data ?? [] };
  });

const TagWriteSchema = z.object({
  trackId: z.string().uuid(),
  tags: z.array(z.string().min(1).max(40)).max(20),
});

export const setTrackTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TagWriteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("track_tags").delete().eq("track_id", data.trackId).eq("user_id", userId);
    if (data.tags.length) {
      const rows = data.tags.map((tag) => ({ track_id: data.trackId, user_id: userId, tag: tag.toLowerCase() }));
      const { error } = await supabase.from("track_tags").upsert(rows, { onConflict: "track_id,tag" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
