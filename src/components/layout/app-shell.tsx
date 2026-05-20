import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Compass,
  Radio,
  ListMusic,
  Library,
  Download,
  Settings,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  ListOrdered,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/player-store";
import { toast } from "sonner";

const navPrimary = [
  { to: "/", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/radios", label: "Radios", icon: Radio },
] as const;

const navCollection = [
  { to: "/playlists", label: "Playlists", icon: ListMusic },
  { to: "/library", label: "Library", icon: Library },
  { to: "/downloads", label: "Downloads", icon: Download },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full bg-atmosphere overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-y-auto pb-28">{children}</main>
        <GlobalPlayer />
      </div>
    </div>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out.");
    navigate({ to: "/login" });
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="h-full border-r border-border flex flex-col bg-sidebar z-20 shrink-0"
    >
      <div className="p-6 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <div className="size-6 bg-accent rounded-full shrink-0" />
          {!collapsed && (
            <span className="font-mono text-xs uppercase tracking-[0.25em] truncate">Aethel</span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-8 overflow-y-auto">
        <NavGroup label="Navigation" items={navPrimary} pathname={pathname} collapsed={collapsed} />
        <NavGroup label="Collection" items={navCollection} pathname={pathname} collapsed={collapsed} />
      </nav>

      <div className="p-4 border-t border-border space-y-1">
        <NavLink
          to="/settings"
          icon={Settings}
          label="Settings"
          active={pathname.startsWith("/settings")}
          collapsed={collapsed}
        />
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-sm text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </motion.aside>
  );
}

function NavGroup({
  label,
  items,
  pathname,
  collapsed,
}: {
  label: string;
  items: ReadonlyArray<{ to: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <div className="space-y-2">
      {!collapsed && <p className="font-mono-caption text-muted-foreground px-3">{label}</p>}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              icon={item.icon}
              label={item.label}
              active={item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)}
              collapsed={collapsed}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function NavLink({
  to,
  icon: Icon,
  label,
  active,
  collapsed,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors ${
        active
          ? "text-accent bg-accent/5"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function GlobalPlayer() {
  const track = usePlayerStore((s) => s.currentTrack);
  const playbackState = usePlayerStore((s) => s.playbackState);
  const volume = usePlayerStore((s) => s.volume);
  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const isPlaying = playbackState === "playing";

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-24 bg-background/85 backdrop-blur-xl border-t border-border px-8 flex items-center justify-between z-30">
      <div className="flex items-center gap-4 w-1/4 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={track?.id ?? "empty"}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="size-14 bg-secondary rounded-sm shrink-0 grid place-items-center overflow-hidden"
          >
            {track?.cover_url ? (
              <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="font-mono-caption text-muted-foreground">—</span>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{track?.title ?? "Nothing playing"}</p>
          <p className="font-mono-caption text-muted-foreground truncate">
            {track?.artist ?? "Pick a track to begin"}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center gap-3 max-w-2xl">
        <div className="flex items-center gap-8">
          <button onClick={prev} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Previous">
            <SkipBack className="size-4" />
          </button>
          <button
            onClick={toggle}
            className="size-10 rounded-full border border-accent flex items-center justify-center text-accent hover:bg-accent hover:text-accent-foreground transition-all"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
          </button>
          <button onClick={next} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Next">
            <SkipForward className="size-4" />
          </button>
        </div>
        <div className="w-full max-w-xl flex items-center gap-4">
          <span className="font-mono text-[9px] text-muted-foreground tabular-nums">0:00</span>
          <div className="h-px flex-1 bg-border relative">
            <div className="absolute inset-y-0 left-0 w-0 bg-accent" />
          </div>
          <span className="font-mono text-[9px] text-muted-foreground tabular-nums">
            {track?.duration ? formatTime(track.duration) : "—:—"}
          </span>
        </div>
      </div>

      <div className="w-1/4 flex justify-end items-center gap-6">
        <button className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-2">
          <ListOrdered className="size-3.5" />
          <span className="hidden sm:inline">Queue</span>
        </button>
        <div className="flex items-center gap-3 w-28">
          <Volume2 className="size-3.5 text-muted-foreground shrink-0" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 accent-accent h-px"
            aria-label="Volume"
          />
        </div>
      </div>
    </footer>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}
