import { useCallback, useRef, useState } from "react";
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { InstitutionalType } from "@/hooks/use-institutional";
import { toast } from "sonner";

const ACCEPT = "audio/*";
const MAX_BYTES = 25 * 1024 * 1024;

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

export function InstitutionalUploadDialog({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete?: () => void;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<InstitutionalType>("vinheta");
  const [frequencia, setFrequencia] = useState<string>("");
  const [horario, setHorario] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setTitulo("");
    setTipo("vinheta");
    setFrequencia("");
    setHorario("");
    setStatus("idle");
    setProgress(0);
    setError(null);
  };

  const handleFile = (f: File | null) => {
    setError(null);
    if (!f) return;
    if (!(f.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|flac)$/i.test(f.name))) {
      setError("Selecione um arquivo de áudio.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("Arquivo maior que 25MB.");
      return;
    }
    setFile(f);
    if (!titulo) setTitulo(f.name.replace(/\.[^.]+$/, ""));
  };

  const submit = useCallback(async () => {
    if (!user || !file || !titulo.trim()) return;
    setStatus("uploading");
    setProgress(15);
    setError(null);
    try {
      const duracao = await readDuration(file);
      setProgress(35);
      const path = `${user.id}/${crypto.randomUUID()}-${sanitize(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from("institutional")
        .upload(path, file, {
          contentType: file.type || "audio/mpeg",
          upsert: false,
        });
      if (upErr) throw upErr;
      setProgress(80);
      const freq = frequencia.trim() ? Number(frequencia) : null;
      const hora = horario.trim() ? `${horario}:00` : null;
      const { error: insErr } = await supabase.from("institutional_contents").insert({
        tipo,
        titulo: titulo.trim(),
        storage_path: path,
        duracao_segundos: duracao,
        ativo: true,
        frequencia_musicas: freq && freq > 0 ? freq : null,
        horario: hora,
        created_by: user.id,
      });
      if (insErr) {
        await supabase.storage.from("institutional").remove([path]);
        throw insErr;
      }
      setProgress(100);
      setStatus("done");
      toast.success("Conteúdo enviado.");
      onComplete?.();
      setTimeout(() => {
        reset();
        onOpenChange(false);
      }, 600);
    } catch (e: unknown) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Falha ao enviar.");
    }
  }, [user, file, titulo, tipo, frequencia, horario, onOpenChange, onComplete]);

  const close = () => {
    if (status === "uploading") return;
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo conteúdo institucional</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as InstitutionalType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vinheta">Vinheta</SelectItem>
                  <SelectItem value="aviso">Aviso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins-titulo">Título</Label>
              <Input
                id="ins-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Vinheta institucional"
              />
            </div>
          </div>

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-colors"
          >
            <Upload className="size-6 mx-auto mb-2 text-muted-foreground" />
            {file ? (
              <p className="text-sm font-medium truncate">{file.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium">Selecionar arquivo de áudio</p>
                <p className="text-xs text-muted-foreground mt-1">MP3, WAV, M4A, OGG · até 25MB</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ins-freq">A cada N músicas</Label>
              <Input
                id="ins-freq"
                type="number"
                min={1}
                placeholder="Ex: 5"
                value={frequencia}
                onChange={(e) => setFrequencia(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins-hora">Horário fixo (opcional)</Label>
              <Input
                id="ins-hora"
                type="time"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Preencha pelo menos um dos dois (frequência ou horário). Pode usar os dois juntos.
          </p>

          {status !== "idle" && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 border border-border">
              <div className="flex-1">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      status === "error"
                        ? "bg-red-500"
                        : status === "done"
                          ? "bg-green-500"
                          : "bg-primary"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
              </div>
              {status === "uploading" && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {status === "done" && <CheckCircle2 className="size-4 text-green-500" />}
              {status === "error" && <AlertCircle className="size-4 text-red-500" />}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={close} disabled={status === "uploading"}>
            <X className="size-4 mr-1" /> Fechar
          </Button>
          <Button
            onClick={submit}
            disabled={
              !file ||
              !titulo.trim() ||
              status === "uploading" ||
              (!frequencia.trim() && !horario.trim())
            }
          >
            {status === "uploading" ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
