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
          {isDragActive ? "Drop to upload" : "Drag audio files here, or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5">
          MP3 · FLAC · WAV · M4A · AAC · up to 50 MB · up to 500 per batch
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          className="flex items-center gap-2 px-4 h-9 rounded-full bg-secondary text-xs font-medium hover:bg-secondary/70 transition-colors"
        >
          <MS name="folder" className="text-[16px]" />
          Import folder
        </button>
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error non-standard but widely supported
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
          <span className="text-muted-foreground">Duplicates:</span>
          <select
            value={duplicatePolicy}
            onChange={(e) => setDuplicatePolicy(e.target.value as typeof duplicatePolicy)}
            className="h-8 px-2 rounded-md bg-secondary border border-transparent focus:border-accent outline-none text-xs"
          >
            <option value="ask">Skip duplicates</option>
            <option value="skip">Skip</option>
            <option value="replace">Replace</option>
            <option value="keep_both">Keep both</option>
          </select>
        </div>
      </div>
    </div>
  );
}
