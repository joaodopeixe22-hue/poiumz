import { useDropzone } from "react-dropzone";
import { useTrackUpload } from "@/hooks/use-track-upload";
import { useUploadStore } from "@/stores/upload-store";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

function MS({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols ${className}`} aria-hidden>{name}</span>;
}

export function UploadDropzone() {
  const { upload } = useTrackUpload();
  const items = useUploadStore((s) => s.items);
  const remove = useUploadStore((s) => s.remove);
  const clearDone = useUploadStore((s) => s.clearDone);
  const qc = useQueryClient();

  const doneCount = items.filter((i) => i.status === "done").length;
  useEffect(() => {
    if (doneCount > 0) qc.invalidateQueries({ queryKey: ["tracks"] });
  }, [doneCount, qc]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: upload,
    accept: {
      "audio/mpeg": [".mp3"],
      "audio/flac": [".flac"],
      "audio/wav": [".wav"],
      "audio/mp4": [".m4a"],
      "audio/aac": [".aac"],
    },
    multiple: true,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`rounded-2xl border-2 border-dashed transition-colors cursor-pointer p-12 text-center ${
          isDragActive ? "border-accent bg-accent/5" : "border-border hover:border-accent/50 bg-card/40"
        }`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto size-14 rounded-full bg-secondary grid place-items-center mb-4">
          <MS name="upload" className="text-[28px] text-accent" />
        </div>
        <p className="text-base font-semibold">
          {isDragActive ? "Drop to upload" : "Drag audio files here, or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5">
          MP3 · FLAC · WAV · M4A · AAC · up to 60 MB · up to 20 per batch
        </p>
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border border-border bg-card/60 divide-y divide-border">
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Queue · {items.length}
            </p>
            <button
              onClick={clearDone}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear completed
            </button>
          </div>
          <ul className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {items.map((it) => (
              <li key={it.id} className="px-4 py-3 flex items-center gap-3">
                <div className="size-9 rounded-md bg-secondary grid place-items-center shrink-0">
                  <MS
                    name={
                      it.status === "done" ? "check_circle"
                      : it.status === "error" ? "error"
                      : "music_note"
                    }
                    className={`text-[18px] ${
                      it.status === "done" ? "text-accent"
                      : it.status === "error" ? "text-destructive"
                      : "text-muted-foreground"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{it.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1 flex-1 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          it.status === "error" ? "bg-destructive" : "bg-accent"
                        }`}
                        style={{ width: `${it.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-20 text-right">
                      {it.status === "error" ? "failed" : `${it.status} ${it.progress}%`}
                    </span>
                  </div>
                  {it.error && <p className="text-[10px] text-destructive mt-1 truncate">{it.error}</p>}
                </div>
                <button
                  onClick={() => remove(it.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Remove"
                >
                  <MS name="close" className="text-[18px]" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
