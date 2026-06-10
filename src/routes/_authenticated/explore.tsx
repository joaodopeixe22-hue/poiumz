import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/layout/page-shell";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({ meta: [{ title: "Aethel — Explorar" }] }),
  component: () => (
    <div>
      <PageHeader
        eyebrow="Descobrir"
        title="Explorar."
        subtitle="SoundCloud, Spotify, YouTube — tudo em um só lugar."
      />
      <ComingSoon
        stage="Etapa 8"
        note="Conteúdos externos serão integrados na próxima fase do roadmap."
      />
    </div>
  ),
});
