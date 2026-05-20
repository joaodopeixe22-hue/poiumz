import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/layout/page-shell";

export const Route = createFileRoute("/_authenticated/downloads")({
  head: () => ({ meta: [{ title: "Aethel — Downloads" }] }),
  component: () => (
    <div>
      <PageHeader eyebrow="Local" title="Downloads." subtitle="Upload your own MP3, FLAC, WAV." />
      <ComingSoon stage="Etapa 7" note="Upload direto para o cofre seguro, metadata extraída automaticamente." />
    </div>
  ),
});
