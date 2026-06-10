import { useCallback, useRef, useState } from "react";
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Item = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

const ACCEPT = "audio/*";
const MAX_BYTES = 50 * 1024 * 1024;
const PARALLEL = 3;

function sanitize(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]+/g, "_")
    .slice(0, 120);
}

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = url;
    const cleanup = () => URL.revokeObjectURL(url);
    audio.onloadedmetadata = () => {
      const d = Number.isFinite(audio.duration) ? Math.round(audio.duration) : null;
      cleanup();
      resolve(d);
    };
    audio.onerror = () => {
      cleanup();
      resolve(null);
    };
  });
}

export function UploadDialog({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete?: () => void;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|flac)$/i.test(f.name));
    if (arr.length === 0) {
      toast.error("Selecione arquivos de áudio.");
      return;
    }
    const next: Item[] = arr.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      status: f.size > MAX_BYTES ? "error" : "queued",
      progress: 0,
      error: f.size > MAX_BYTES ? "Arquivo maior que 50MB" : undefined,
    }));
    setItems((prev) => [...prev, ...next]);
  };

  const removeItem = (id: string) => setItems((p) => p.filter((i) => i.id !== id));

  const uploadOne = useCallback(
    async (item: Item) => {
      if (!user) throw new Error("Sem usuário");
      setItems((p) => p.map((i) => (i.id === item.id ? { ...i, status: "uploading", progress: 10 } : i)));
      try {
        const duracao = await readDuration(item.file);
        setItems((p) => p.map((i) => (i.id === item.id ? { ...i, progress: 30 } : i)));
        const path = `${user.id}/${crypto.randomUUID()}-${sanitize(item.file.name)}`;
        const { error: upErr } = await supabase.storage
          .from("songs")
          .upload(path, item.file, { contentType: item.file.type || "audio/mpeg", upsert: false });
        if (upErr) throw upErr;
        setItems((p) => p.map((i) => (i.id === item.id ? { ...i, progress: 80 } : i)));
        const titulo = item.file.name.replace(/\.[^.]+$/, "");
        const { error: insErr } = await supabase.from("songs").insert({
          titulo,
          artista: null,
          duracao_segundos: duracao,
          storage_path: path,
          uploaded_by: user.id,
        });
        if (insErr) {
          await supabase.storage.from("songs").remove([path]);
          throw insErr;
        }
        setItems((p) => p.map((i) => (i.id === item.id ? { ...i, status: "done", progress: 100 } : i)));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro";
        setItems((p) => p.map((i) => (i.id === item.id ? { ...i, status: "error", error: msg } : i)));
      }
    },
    [user],
  );

  const startUploads = async () => {
    setRunning(true);
    const queue = items.filter((i) => i.status === "queued");
    // simple pool
    let idx = 0;
    const workers = Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
      while (idx < queue.length) {
        const current = queue[idx++];
        if (current) await uploadOne(current);
      }
    });
    await Promise.all(workers);
    setRunning(false);
    onComplete?.();
    const errors = items.filter((i) => i.status === "error").length;
    if (errors === 0) toast.success("Upload concluído.");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const close = () => {
    if (running) return;
    setItems([]);
    onOpenChange(false);
  };

  const hasQueued = items.some((i) => i.status === "queued");

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enviar músicas</DialogTitle>
        </DialogHeader>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-colors"
        >
          <Upload className="size-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">Arraste arquivos ou clique para selecionar</p>
          <p className="text-xs text-muted-foreground mt-1">MP3, WAV, M4A, OGG · até 50MB cada</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {items.length > 0 && (
          <div className="max-h-72 overflow-y-auto space-y-2 mt-2">
            {items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{i.file.name}</p>
                  <div className="h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        i.status === "error" ? "bg-red-500" : i.status === "done" ? "bg-green-500" : "bg-primary"
                      }`}
                      style={{ width: `${i.progress}%` }}
                    />
                  </div>
                  {i.error && <p className="text-xs text-red-500 mt-1">{i.error}</p>}
                </div>
                <div className="shrink-0">
                  {i.status === "uploading" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                  {i.status === "done" && <CheckCircle2 className="size-4 text-green-500" />}
                  {i.status === "error" && <AlertCircle className="size-4 text-red-500" />}
                  {i.status === "queued" && !running && (
                    <button onClick={() => removeItem(i.id)} aria-label="Remover">
                      <X className="size-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={close} disabled={running}>
            Fechar
          </Button>
          <Button onClick={startUploads} disabled={!hasQueued || running}>
            {running ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
