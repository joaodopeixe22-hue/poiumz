import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IdSchema = z.object({ id: z.string().uuid() });

export const listPlaylists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("playlists")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { playlists: data ?? [] };
  });

export const getPlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pl, error: pErr } = await supabase
      .from("playlists")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (pErr || !pl) throw new Error("Playlist not found");
    const { data: rows, error: rErr } = await supabase
      .from("playlist_tracks")
      .select("position, added_at, track:tracks(*)")
      .eq("playlist_id", data.id)
      .eq("user_id", userId)
      .order("position", { ascending: true });
    if (rErr) throw new Error(rErr.message);
    return { playlist: pl, tracks: rows ?? [] };
  });

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  trackIds: z.array(z.string().uuid()).max(500).optional(),
});

export const createPlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pl, error } = await supabase
      .from("playlists")
      .insert({ user_id: userId, name: data.name, description: data.description ?? null })
      .select()
      .single();
    if (error || !pl) throw new Error(error?.message ?? "Failed to create");
    if (data.trackIds?.length) {
      const rows = data.trackIds.map((tid, i) => ({
        playlist_id: pl.id,
        track_id: tid,
        user_id: userId,
        position: i,
      }));
      const { error: ptErr } = await supabase.from("playlist_tracks").insert(rows);
      if (ptErr) throw new Error(ptErr.message);
    }
    return { playlist: pl };
  });

const UpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  cover_url: z.string().url().nullable().optional(),
  is_public: z.boolean().optional(),
});

export const updatePlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const { error } = await supabase
      .from("playlists")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("playlist_tracks")
      .delete()
      .eq("playlist_id", data.id)
      .eq("user_id", userId);
    const { error } = await supabase
      .from("playlists")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const AddSchema = z.object({
  playlistId: z.string().uuid(),
  trackIds: z.array(z.string().uuid()).min(1).max(500),
  mode: z.enum(["append", "prepend", "afterCurrent"]).default("append"),
  afterPosition: z.number().int().optional(),
});

export const addTracksToPlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AddSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("playlist_tracks")
      .select("track_id, position")
      .eq("playlist_id", data.playlistId)
      .eq("user_id", userId)
      .order("position", { ascending: true });
    const present = new Set((existing ?? []).map((r) => r.track_id));
    const newIds = data.trackIds.filter((id) => !present.has(id));
    if (!newIds.length) return { added: 0, skipped: data.trackIds.length };

    const maxPos = existing && existing.length ? existing[existing.length - 1].position : -1;
    let positions: number[];
    if (data.mode === "append") {
      positions = newIds.map((_, i) => maxPos + 1 + i);
    } else if (data.mode === "prepend") {
      const shift = newIds.length;
      if (existing?.length) {
        for (const r of existing) {
          await supabase
            .from("playlist_tracks")
            .update({ position: r.position + shift })
            .eq("playlist_id", data.playlistId)
            .eq("track_id", r.track_id)
            .eq("user_id", userId);
        }
      }
      positions = newIds.map((_, i) => i);
    } else {
      const anchor = data.afterPosition ?? maxPos;
      const toShift = (existing ?? []).filter((r) => r.position > anchor);
      const shift = newIds.length;
      for (const r of toShift) {
        await supabase
          .from("playlist_tracks")
          .update({ position: r.position + shift })
          .eq("playlist_id", data.playlistId)
          .eq("track_id", r.track_id)
          .eq("user_id", userId);
      }
      positions = newIds.map((_, i) => anchor + 1 + i);
    }

    const rows = newIds.map((tid, i) => ({
      playlist_id: data.playlistId,
      track_id: tid,
      user_id: userId,
      position: positions[i],
    }));
    const { error } = await supabase.from("playlist_tracks").insert(rows);
    if (error) throw new Error(error.message);
    return { added: rows.length, skipped: data.trackIds.length - rows.length };
  });

const RemoveSchema = z.object({
  playlistId: z.string().uuid(),
  trackIds: z.array(z.string().uuid()).min(1).max(500),
});

export const removeTracksFromPlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RemoveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("playlist_tracks")
      .delete()
      .eq("playlist_id", data.playlistId)
      .eq("user_id", userId)
      .in("track_id", data.trackIds);
    if (error) throw new Error(error.message);
    return { removed: data.trackIds.length };
  });

const ReorderSchema = z.object({
  playlistId: z.string().uuid(),
  orderedTrackIds: z.array(z.string().uuid()).min(1).max(2000),
});

export const reorderPlaylistTracks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ReorderSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    for (let i = 0; i < data.orderedTrackIds.length; i++) {
      await supabase
        .from("playlist_tracks")
        .update({ position: i })
        .eq("playlist_id", data.playlistId)
        .eq("track_id", data.orderedTrackIds[i])
        .eq("user_id", userId);
    }
    return { ok: true };
  });
