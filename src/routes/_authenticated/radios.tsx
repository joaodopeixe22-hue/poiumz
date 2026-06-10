import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/layout/page-shell";

export const Route = createFileRoute("/_authenticated/radios")({
  head: () => ({ meta: [{ title: "Aethel — Rádios" }] }),
  component: () => (
    <div>
      <PageHeader
        eyebrow="Frequências ao vivo"
        title="Rádios."
        subtitle="Estações infinitas de todo o mundo."
      />
      <ComingSoon stage="Etapa 3" note="Diretório de rádios via Radio Browser API." />
    </div>
  ),
});
