import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Search, ShieldCheck, User } from "lucide-react";

type Row = {
  id: string;
  nome: string | null;
  role: "admin" | "operador";
  status: "pendente" | "aprovado" | "recusado";
  can_upload: boolean;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/dashboard/usuarios")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const { data: me } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", data.session.user.id)
      .maybeSingle();
    if (!me || me.role !== "admin" || me.status !== "aprovado") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: UsuariosPage,
});

function UsuariosPage() {
  const { profile } = useProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"todos" | Row["status"]>("todos");

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, role, status, can_upload, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("profiles-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterStatus !== "todos" && r.status !== filterStatus) return false;
      if (!q) return true;
      return (r.nome ?? "").toLowerCase().includes(q) || r.id.includes(q);
    });
  }, [rows, query, filterStatus]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      pendentes: rows.filter((r) => r.status === "pendente").length,
      aprovados: rows.filter((r) => r.status === "aprovado").length,
      admins: rows.filter((r) => r.role === "admin").length,
    }),
    [rows],
  );

  const updateRow = async (id: string, patch: Partial<Row>) => {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) {
      setRows(prev);
      toast.error(error.message);
    } else {
      toast.success("Atualizado.");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Aprove novos cadastros, defina cargos e libere upload.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Pendentes" value={stats.pendentes} tone="warning" />
        <StatCard label="Aprovados" value={stats.aprovados} tone="success" />
        <StatCard label="Admins" value={stats.admins} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="aprovado">Aprovados</SelectItem>
            <SelectItem value="recusado">Recusados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_120px_140px_120px_220px] px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
          <span>Usuário</span>
          <span>Status</span>
          <span>Cargo</span>
          <span>Upload</span>
          <span className="text-right">Ações</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </div>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              className="md:grid md:grid-cols-[1fr_120px_140px_120px_220px] md:items-center px-4 py-3 border-b border-border last:border-b-0 gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-full bg-secondary grid place-items-center shrink-0">
                  {r.role === "admin" ? (
                    <ShieldCheck className="size-4 text-primary" />
                  ) : (
                    <User className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {r.nome ?? "Sem nome"}
                    {r.id === profile?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate font-mono">{r.id}</p>
                </div>
              </div>

              <div className="mt-2 md:mt-0">
                <StatusBadge status={r.status} />
              </div>

              <div className="mt-2 md:mt-0">
                <Select
                  value={r.role}
                  onValueChange={(v) => updateRow(r.id, { role: v as Row["role"] })}
                  disabled={r.id === profile?.id}
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operador">Operador</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-2 md:mt-0 flex items-center gap-2">
                <Switch
                  checked={r.can_upload || r.role === "admin"}
                  disabled={r.role === "admin"}
                  onCheckedChange={(c) => updateRow(r.id, { can_upload: c })}
                />
                <span className="text-xs text-muted-foreground">
                  {r.role === "admin" ? "sempre" : r.can_upload ? "sim" : "não"}
                </span>
              </div>

              <div className="mt-3 md:mt-0 flex items-center justify-end gap-2">
                {r.status !== "aprovado" && (
                  <Button
                    size="sm"
                    onClick={() => updateRow(r.id, { status: "aprovado" })}
                  >
                    <CheckCircle2 className="size-4 mr-1" />
                    Aprovar
                  </Button>
                )}
                {r.status !== "recusado" && r.id !== profile?.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateRow(r.id, { status: "recusado" })}
                  >
                    <XCircle className="size-4 mr-1" />
                    Recusar
                  </Button>
                )}
                {r.status === "recusado" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateRow(r.id, { status: "pendente" })}
                  >
                    Reabrir
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p
        className={`text-2xl font-semibold mt-1 ${
          tone === "warning"
            ? "text-yellow-500"
            : tone === "success"
              ? "text-green-500"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: Row["status"] }) {
  if (status === "aprovado")
    return (
      <Badge className="bg-green-500/15 text-green-500 border-green-500/30 gap-1">
        <CheckCircle2 className="size-3" /> aprovado
      </Badge>
    );
  if (status === "pendente")
    return (
      <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30 gap-1">
        <Clock className="size-3" /> pendente
      </Badge>
    );
  return (
    <Badge className="bg-red-500/15 text-red-500 border-red-500/30 gap-1">
      <XCircle className="size-3" /> recusado
    </Badge>
  );
}
