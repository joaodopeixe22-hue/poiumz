import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Music, ListMusic, Users, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => pageHead("Painel", "Acompanhe a programação e o acervo da Rádio RD Saúde."),
  component: DashboardPage,
});

type Metrics = {
  songs: number;
  playlists: number;
  pendingUsers: number;
  isLive: boolean;
};

function DashboardPage() {
  const { profile, loading } = useProfile();
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const load = async () => {
      const [songs, playlists, pending, playback] = await Promise.all([
        supabase.from("songs").select("id", { count: "exact", head: true }),
        supabase.from("playlists").select("id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendente"),
        supabase.from("playback_state").select("is_playing").eq("id", true).maybeSingle(),
      ]);
      setMetrics({
        songs: songs.count ?? 0,
        playlists: playlists.count ?? 0,
        pendingUsers: pending.count ?? 0,
        isLive: !!playback.data?.is_playing,
      });
    };
    load();
  }, []);

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }

  if (profile?.status === "pendente") {
    return (
      <div className="p-6 md:p-10">
        <div className="max-w-xl mx-auto rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Cadastro pendente</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta foi criada e está aguardando aprovação de um administrador. Você será
            notificado por e-mail quando o acesso for liberado.
          </p>
        </div>
      </div>
    );
  }

  if (profile?.status === "recusado") {
    return (
      <div className="p-6 md:p-10">
        <div className="max-w-xl mx-auto rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Acesso negado</h1>
          <p className="text-sm text-muted-foreground">
            Seu cadastro foi recusado pelo administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-8">
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
          Painel
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Olá, {profile?.nome?.split(" ")[0] ?? "operador"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral da rádio corporativa.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Radio}
          label="Status da rádio"
          value={metrics?.isLive ? "No ar" : "Fora do ar"}
          tone={metrics?.isLive ? "live" : "off"}
        />
        <MetricCard
          icon={Music}
          label="Músicas"
          value={metrics?.songs ?? 0}
        />
        <MetricCard
          icon={ListMusic}
          label="Playlists"
          value={metrics?.playlists ?? 0}
        />
        <MetricCard
          icon={Users}
          label="Cadastros pendentes"
          value={metrics?.pendingUsers ?? 0}
          tone={metrics && metrics.pendingUsers > 0 ? "warning" : undefined}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Próximos passos
        </h2>
        <ul className="space-y-2 text-sm">
          <li>• Upload de músicas (Etapa 2)</li>
          <li>• Gerenciamento de playlists (Etapa 3)</li>
          <li>• Conteúdos institucionais (Etapa 4)</li>
          <li>• Player profissional com programação (Etapa 5)</li>
        </ul>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Music;
  label: string;
  value: string | number;
  tone?: "live" | "off" | "warning";
}) {
  const toneClass =
    tone === "live"
      ? "text-red-500"
      : tone === "warning"
        ? "text-yellow-500"
        : tone === "off"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}
