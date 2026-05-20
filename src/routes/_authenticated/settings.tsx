import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/layout/page-shell";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Aethel — Settings" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader eyebrow="Your account" title="Settings." />
      <div className="px-12 pb-12 max-w-3xl space-y-10">
        <Section label="Profile">
          <Row k="Display name" v={profile?.display_name ?? "—"} />
          <Row k="Username" v={profile?.username ?? "—"} />
          <Row k="Email" v={user?.email ?? "—"} />
        </Section>
        <Section label="Devices">
          <p className="text-sm text-muted-foreground">Multi-device sync arrives na Etapa 5.</p>
        </Section>
        <Section label="Audio">
          <p className="text-sm text-muted-foreground">Equalizador e perfis de som na Etapa 6.</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-mono-caption text-muted-foreground border-b border-border pb-3">{label}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-border/50">
      <span className="font-mono-caption text-muted-foreground">{k}</span>
      <span className="text-sm">{v}</span>
    </div>
  );
}
