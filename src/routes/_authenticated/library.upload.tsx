import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-shell";
import { UploadDropzone } from "@/components/library/upload-dropzone";

export const Route = createFileRoute("/_authenticated/library/upload")({
  head: () => ({ meta: [{ title: "Focus Audio — Enviar" }] }),
  component: UploadPage,
});

function UploadPage() {
  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Arquivos locais"
        title="Envie sua música."
        subtitle="MP3, FLAC, WAV, M4A ou AAC. Metadados e capa são extraídos automaticamente."
      />
      <div className="px-10 max-w-4xl">
        <UploadDropzone />
        <div className="mt-6">
          <Link
            to="/library"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Voltar para a biblioteca
          </Link>
        </div>
      </div>
    </div>
  );
}
