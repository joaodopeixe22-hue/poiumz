import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/layout/page-shell";

export const Route = createFileRoute("/_authenticated/playlists")({
  head: () => ({ meta: [{ title: "Aethel — Playlists" }] }),
  component: () => (
    <div>
      <PageHeader eyebrow="Your selections" title="Playlists." subtitle="Folders, tags, smart shuffle." />
      <ComingSoon stage="Etapa 4" note="CRUD de playlists, pastas e tags personalizadas." />
    </div>
  ),
});
