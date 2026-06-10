import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Music,
  ListMusic,
  Megaphone,
  Radio,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";

type NavItemDef = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  soon?: boolean;
  adminOnly?: boolean;
};

const nav: NavItemDef[] = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/dashboard/musicas", label: "Músicas", icon: Music },
  { to: "/dashboard/playlists", label: "Playlists", icon: ListMusic },
  { to: "/dashboard/institucional", label: "Institucional", icon: Megaphone },
  { to: "/dashboard/programacao", label: "Programação", icon: Radio },
  { to: "/dashboard/usuarios", label: "Usuários", icon: Users, soon: true, adminOnly: true },
  { to: "/dashboard/configuracoes", label: "Configurações", icon: Settings, soon: true },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { profile } = useProfile();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada.");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card shrink-0">
        <div className="h-16 px-6 flex items-center border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary grid place-items-center">
              <span className="text-primary-foreground font-bold text-sm">RD</span>
            </div>
            <span className="font-semibold tracking-tight">Rádio RD</span>
          </Link>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-1">
            {nav.map((item) => {
              if (item.adminOnly && profile?.role !== "admin") return null;
              const active =
                item.to === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <NavItem item={item} active={active} />
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium truncate">{profile?.nome ?? "—"}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {profile?.role ?? "—"} ·{" "}
              <span
                className={
                  profile?.status === "aprovado"
                    ? "text-green-500"
                    : profile?.status === "pendente"
                      ? "text-yellow-500"
                      : "text-red-500"
                }
              >
                {profile?.status ?? "—"}
              </span>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Sidebar mobile */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)}>
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-16 px-6 flex items-center justify-between border-b border-border">
              <Link to="/" className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary grid place-items-center">
                  <span className="text-primary-foreground font-bold text-sm">RD</span>
                </div>
                <span className="font-semibold tracking-tight">Rádio RD</span>
              </Link>
              <button onClick={() => setOpen(false)} aria-label="Fechar">
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 p-3">
              <ul className="space-y-1">
                {nav.map((item) => {
                  if (item.adminOnly && profile?.role !== "admin") return null;
                  const active =
                    item.to === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.to);
                  return (
                    <li key={item.to}>
                      <NavItem item={item} active={active} onClick={() => setOpen(false)} />
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="p-3 border-t border-border">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <LogOut className="size-4" />
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center px-6 gap-4 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="size-5" />
          </button>
          <span className="font-semibold">Rádio RD</span>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function NavItem({
  item,
  active,
  onClick,
}: {
  item: { to: string; label: string; icon: typeof LayoutDashboard; soon?: boolean };
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  if (item.soon) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground/50 cursor-not-allowed">
        <Icon className="size-4" />
        <span className="flex-1">{item.label}</span>
        <span className="text-[10px] font-mono uppercase tracking-wider">em breve</span>
      </div>
    );
  }
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
    >
      <Icon className="size-4" />
      {item.label}
    </Link>
  );
}
