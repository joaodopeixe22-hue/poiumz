import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTracks, updateTrack, setTrackTags, listTags } from "@/lib/library.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function TrackEditSheet({
  trackId, open, onClose,
}: { trackId?: string; open: boolean; onClose: () => void }) {
  const listFn = useServerFn(listTracks);
  const updateFn = useServerFn(updateTrack);
  const tagsFn = useServerFn(setTrackTags);
  const listTagsFn = useServerFn(listTags);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["tracks-edit"],
    queryFn: () => listFn({ data: { limit: 1000 } }),
    enabled: open,
  });
  const track = data?.tracks.find((t) => t.id === trackId);

  const { data: tagsData } = useQuery({
    queryKey: ["all-tags"],
    queryFn: () => listTagsFn({}),
    enabled: open,
  });

  const [form, setForm] = useState({
    title: "", artist: "", album: "", genre: "", year: "", track_number: "",
  });
  const [tags, setTags] = useState<string>("");

  useEffect(() => {
    if (track) {
      setForm({
        title: track.title ?? "",
        artist: track.artist ?? "",
        album: track.album ?? "",
        genre: track.genre ?? "",
        year: track.year?.toString() ?? "",
        track_number: track.track_number?.toString() ?? "",
      });
      const tt = (tagsData?.tags ?? []).filter((x) => x.track_id === track.id).map((x) => x.tag);
      setTags(tt.join(", "));
    }
  }, [track, tagsData]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!track) return;
      await updateFn({
        data: {
          id: track.id,
          title: form.title.trim() || track.title,
          artist: form.artist.trim() || null,
          album: form.album.trim() || null,
          genre: form.genre.trim() || null,
          year: form.year ? parseInt(form.year, 10) : null,
          track_number: form.track_number ? parseInt(form.track_number, 10) : null,
        },
      });
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);
      await tagsFn({ data: { trackId: track.id, tags: tagList } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracks"] });
      qc.invalidateQueries({ queryKey: ["all-tags"] });
      qc.invalidateQueries({ queryKey: ["tracks-edit"] });
      toast.success("Saved.");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit metadata</SheetTitle>
        </SheetHeader>
        {track && (
          <div className="mt-6 space-y-4">
            <Field label="Title" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
            <Field label="Artist" value={form.artist} onChange={(v) => setForm((f) => ({ ...f, artist: v }))} />
            <Field label="Album" value={form.album} onChange={(v) => setForm((f) => ({ ...f, album: v }))} />
            <Field label="Genre" value={form.genre} onChange={(v) => setForm((f) => ({ ...f, genre: v }))} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Year" value={form.year} onChange={(v) => setForm((f) => ({ ...f, year: v }))} />
              <Field label="Track #" value={form.track_number} onChange={(v) => setForm((f) => ({ ...f, track_number: v }))} />
            </div>
            <Field label="Tags (comma-separated)" value={tags} onChange={setTags} placeholder="focus, study, evening" />
            <div className="flex gap-2 pt-4">
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1">
                {saveMut.isPending ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
