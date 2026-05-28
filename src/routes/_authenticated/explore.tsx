import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/layout/page-shell";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({ meta: [{ title: "Aethel — Explore" }] }),
  component: () => (
    <div>
      <PageHeader
        eyebrow="Discover"
        title="Explore."
        subtitle="SoundCloud, Spotify, YouTube — all in one frame."
      />
      <ComingSoon
        stage="Etapa 8"
        note="Embeds externos serão integrados na próxima fase do roadmap."
      />
    </div>
  ),
});
