import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-shell";
import { UploadDropzone } from "@/components/library/upload-dropzone";

export const Route = createFileRoute("/_authenticated/downloads")({
  head: () => ({ meta: [{ title: "Focus Audio — Downloads" }] }),
  component: DownloadsPage,
});

function DownloadsPage() {
  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Local files"
        title="Downloads."
        subtitle="Upload local audio to your private library."
      />
      <div className="px-10 max-w-4xl">
        <UploadDropzone />
        <p className="mt-6 text-xs text-muted-foreground">
          Already uploaded?{" "}
          <Link to="/library" className="text-accent hover:underline">Open library →</Link>
        </p>
      </div>
    </div>
  );
}
