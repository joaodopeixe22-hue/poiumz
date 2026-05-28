import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/player-store";
import { toast } from "sonner";

function MS({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols ${className}`} aria-hidden>
      {name}
    </span>
  );
}

const navPrimary = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/explore", label: "Search", icon: "search" },
  { to: "/library", label: "Library", icon: "library_music" },
  { to: "/playlists", label: "Playlists", icon: "featured_play_list" },
  { to: "/radios", label: "Radios", icon: "radio" },
  { to: "/downloads", label: "Downloads", icon: "download" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full bg-atmosphere overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
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
      animate={{ width: collapsed ? 76 : 248 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="h-full border-r border-sidebar-border flex flex-col bg-sidebar z-20 shrink-0"
    >
      <div className="p-5 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-lg bg-accent grid place-items-center shrink-0">
            <MS name="graphic_eq" className="text-[20px] text-accent-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">Focus Audio</p>
              <p className="text-[10px] text-accent font-medium tracking-wide truncate">
                Premium Focus
              </p>
            </div>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle sidebar"
        >
          <MS name={collapsed ? "chevron_right" : "chevron_left"} className="text-[18px]" />
        </button>
      </div>

      <nav className="flex-1 px-3 mt-4 overflow-y-auto">
        <ul className="space-y-1">
          {navPrimary.map((item) => (
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
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        <NavLink
          to="/settings"
          icon="settings"
          label="Settings"
          active={pathname.startsWith("/settings")}
          collapsed={collapsed}
        />
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        >
          <MS name="logout" className="text-[20px] shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </motion.aside>
  );
}

function NavLink({
  to,
  icon,
  label,
  active,
  collapsed,
}: {
  to: string;
  icon: string;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
        active
          ? "text-accent-foreground bg-accent font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
      }`}
    >
      <MS name={icon} className="text-[20px] shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function TopBar() {
  return (
    <header className="h-16 border-b border-border bg-background/60 backdrop-blur-xl flex items-center px-8 gap-6 shrink-0 z-10">
      <div className="flex items-center gap-2 text-muted-foreground">
        <button className="size-8 grid place-items-center rounded-full hover:bg-secondary transition-colors">
          <MS name="chevron_left" className="text-[20px]" />
        </button>
        <button className="size-8 grid place-items-center rounded-full hover:bg-secondary transition-colors">
          <MS name="chevron_right" className="text-[20px]" />
        </button>
      </div>
      <div className="flex-1 max-w-xl relative">
        <MS
          name="search"
          className="text-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          placeholder="Search tracks, artists, playlists..."
          className="w-full h-10 pl-10 pr-4 rounded-full bg-secondary/70 border border-transparent focus:border-border focus:bg-secondary text-sm placeholder:text-muted-foreground outline-none transition-colors"
        />
      </div>
      <div className="flex items-center gap-2 ml-auto text-muted-foreground">
        <button className="size-9 grid place-items-center rounded-full hover:bg-secondary hover:text-foreground transition-colors">
          <MS name="notifications" className="text-[20px]" />
        </button>
        <button className="size-9 grid place-items-center rounded-full hover:bg-secondary hover:text-foreground transition-colors">
          <MS name="account_circle" className="text-[22px]" />
        </button>
      </div>
    </header>
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
    <footer className="fixed bottom-0 left-0 right-0 h-24 bg-card/95 backdrop-blur-xl border-t border-border px-6 flex items-center justify-between z-30">
      <div className="flex items-center gap-4 w-[28%] min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={track?.id ?? "empty"}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="size-14 bg-secondary rounded-md shrink-0 grid place-items-center overflow-hidden"
          >
            {track?.cover_url ? (
              <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <MS name="graphic_eq" className="text-[22px] text-muted-foreground" />
            )}
          </motion.div>
        </AnimatePresence>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{track?.title ?? "Alpha Waves 432Hz"}</p>
          <p className="text-xs text-muted-foreground truncate">
            {track?.artist ?? "Focus Audio Originals"}
          </p>
        </div>
        <button className="ml-3 text-muted-foreground hover:text-accent transition-colors shrink-0">
          <MS name="favorite" className="text-[20px]" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center gap-2 max-w-2xl">
        <div className="flex items-center gap-5">
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Shuffle"
          >
            <MS name="shuffle" className="text-[20px]" />
          </button>
          <button
            onClick={prev}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Previous"
          >
            <MS name="skip_previous" className="text-[26px]" />
          </button>
          <button
            onClick={toggle}
            className="size-11 rounded-full bg-accent text-accent-foreground grid place-items-center hover:scale-105 transition-transform shadow-lg shadow-accent/20"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <MS name={isPlaying ? "pause" : "play_arrow"} className="text-[26px]" />
          </button>
          <button
            onClick={next}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Next"
          >
            <MS name="skip_next" className="text-[26px]" />
          </button>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Repeat"
          >
            <MS name="repeat" className="text-[20px]" />
          </button>
        </div>
        <div className="w-full max-w-xl flex items-center gap-3">
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums">12:34</span>
          <div className="h-1 flex-1 bg-border rounded-full relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-[20%] bg-accent rounded-full" />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
            {track?.duration ? formatTime(track.duration) : "-1:47:26"}
          </span>
        </div>
      </div>

      <div className="w-[28%] flex justify-end items-center gap-3 text-muted-foreground">
        <button
          className="size-8 grid place-items-center rounded-full hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Lyrics"
        >
          <MS name="mic" className="text-[18px]" />
        </button>
        <button
          className="size-8 grid place-items-center rounded-full hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Queue"
        >
          <MS name="queue_music" className="text-[20px]" />
        </button>
        <button
          className="size-8 grid place-items-center rounded-full hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Devices"
        >
          <MS name="devices" className="text-[18px]" />
        </button>
        <div className="flex items-center gap-2 w-28 ml-1">
          <MS name="volume_up" className="text-[18px] shrink-0" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 accent-accent h-1"
            aria-label="Volume"
          />
        </div>
      </div>
    </footer>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${sec}`;
}
