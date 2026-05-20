import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/layout/page-shell";

export const Route = createFileRoute("/_authenticated/radios")({
  head: () => ({ meta: [{ title: "Aethel — Radios" }] }),
  component: () => (
    <div>
      <PageHeader eyebrow="Live frequencies" title="Radios." subtitle="Infinite stations from around the world." />
      <ComingSoon stage="Etapa 3" note="Diretório de rádios via Radio Browser API." />
    </div>
  ),
});
