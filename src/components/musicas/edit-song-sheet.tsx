import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Song } from "@/hooks/use-songs";

export function EditSongSheet({
  song,
  open,
  onOpenChange,
  onSaved,
}: {
  song: Song | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [artista, setArtista] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (song) {
      setTitulo(song.titulo);
      setArtista(song.artista ?? "");
    }
  }, [song]);

  const save = async () => {
    if (!song) return;
    setSaving(true);
    const { error } = await supabase
      .from("songs")
      .update({ titulo: titulo.trim(), artista: artista.trim() || null })
      .eq("id", song.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Música atualizada.");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Editar música</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="artista">Artista</Label>
            <Input id="artista" value={artista} onChange={(e) => setArtista(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving || !titulo.trim()}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
