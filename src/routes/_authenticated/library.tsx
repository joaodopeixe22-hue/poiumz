import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/layout/page-shell";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({ meta: [{ title: "Aethel — Library" }] }),
  component: () => (
    <div>
      <PageHeader eyebrow="Your collection" title="Library." subtitle="Every track you've added, filtered." />
      <ComingSoon stage="Etapa 4 / 7" note="Biblioteca inteligente com busca dinâmica e uploads MP3." />
    </div>
  ),
});
