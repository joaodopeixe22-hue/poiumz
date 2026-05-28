import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-shell";
import { UploadDropzone } from "@/components/library/upload-dropzone";

export const Route = createFileRoute("/_authenticated/library/upload")({
  head: () => ({ meta: [{ title: "Focus Audio — Upload" }] }),
  component: UploadPage,
});

function UploadPage() {
  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Local files"
        title="Upload your music."
        subtitle="MP3, FLAC, WAV, M4A or AAC. Metadata and cover art are extracted automatically."
      />
      <div className="px-10 max-w-4xl">
        <UploadDropzone />
        <div className="mt-6">
          <Link
            to="/library"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to library
          </Link>
        </div>
      </div>
    </div>
  );
}
