import { useDropzone } from "react-dropzone";
import { useBulkUpload } from "@/hooks/use-bulk-upload";
import { useUploadStore } from "@/stores/upload-store";
import { useRef } from "react";

function MS({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols ${className}`} aria-hidden>
      {name}
    </span>
  );
}

export function UploadDropzone() {
  const { upload } = useBulkUpload();
  const duplicatePolicy = useUploadStore((s) => s.duplicatePolicy);
  const setDuplicatePolicy = useUploadStore((s) => s.setDuplicatePolicy);
  const folderInputRef = useRef<HTMLInputElement>(null);

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
    maxFiles: 500,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`rounded-2xl border-2 border-dashed transition-colors cursor-pointer p-12 text-center ${
          isDragActive
            ? "border-accent bg-accent/5"
            : "border-border hover:border-accent/50 bg-card/40"
        }`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto size-14 rounded-full bg-secondary grid place-items-center mb-4">
          <MS name="upload" className="text-[28px] text-accent" />
        </div>
        <p className="text-base font-semibold">
          {isDragActive
            ? "Solte para enviar"
            : "Arraste arquivos de áudio aqui, ou clique para selecionar"}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5">
          MP3 · FLAC · WAV · M4A · AAC · até 50 MB · até 500 por lote
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          className="flex items-center gap-2 px-4 h-9 rounded-full bg-secondary text-xs font-medium hover:bg-secondary/70 transition-colors"
        >
          <MS name="folder" className="text-[16px]" />
          Importar pasta
        </button>
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error non-standard mas amplamente suportado
          webkitdirectory=""
          directory=""
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) upload(files);
            e.target.value = "";
          }}
        />

        <div className="flex items-center gap-2 ml-auto text-xs">
          <span className="text-muted-foreground">Duplicados:</span>
          <select
            value={duplicatePolicy}
            onChange={(e) => setDuplicatePolicy(e.target.value as typeof duplicatePolicy)}
            className="h-8 px-2 rounded-md bg-secondary border border-transparent focus:border-accent outline-none text-xs"
          >
            <option value="ask">Ignorar duplicados</option>
            <option value="skip">Ignorar</option>
            <option value="replace">Substituir</option>
            <option value="keep_both">Manter ambos</option>
          </select>
        </div>
      </div>
    </div>
  );
}
