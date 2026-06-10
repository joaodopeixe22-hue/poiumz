import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-shell";
import { UploadDropzone } from "@/components/library/upload-dropzone";

export const Route = createFileRoute("/_authenticated/downloads")({
  head: () => ({ meta: [{ title: "Focus Audio — Baixados" }] }),
  component: DownloadsPage,
});

function DownloadsPage() {
  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Arquivos locais"
        title="Baixados."
        subtitle="Envie áudios locais para sua biblioteca privada."
      />
      <div className="px-10 max-w-4xl">
        <UploadDropzone />
        <p className="mt-6 text-xs text-muted-foreground">
          Já enviou?{" "}
          <Link to="/library" className="text-accent hover:underline">
            Abrir biblioteca →
          </Link>
        </p>
      </div>
    </div>
  );
}
