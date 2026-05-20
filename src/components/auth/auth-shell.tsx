import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthShell({ eyebrow, title, subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-screen flex bg-atmosphere">
      {/* Left — editorial column */}
      <aside className="hidden lg:flex flex-col justify-between w-[44%] xl:w-[40%] p-12 border-r border-border relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-60">
          <div
            className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, oklch(0.78 0.10 80 / 0.18), transparent 70%)" }}
          />
          <div
            className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, oklch(0.45 0.10 30 / 0.18), transparent 70%)" }}
          />
        </div>

        <Link to="/" className="relative flex items-center gap-3 z-10">
          <div className="size-7 rounded-full bg-accent" />
          <span className="font-mono text-xs uppercase tracking-[0.25em]">Aethel</span>
        </Link>

        <div className="relative z-10 max-w-md">
          <p className="font-mono-caption text-muted-foreground mb-6">A note</p>
          <p className="font-display italic text-3xl xl:text-4xl leading-tight text-balance">
            "Music has its own dignity. Aethel is built to honor it — the room, the moment, the listener."
          </p>
          <p className="mt-6 text-sm text-muted-foreground">— Studio Manifesto</p>
        </div>

        <div className="relative z-10 font-mono-caption text-muted-foreground">
          Vol. 01 — Issue 0001
        </div>
      </aside>

      {/* Right — form column */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden flex items-center gap-3 mb-10">
            <div className="size-6 rounded-full bg-accent" />
            <span className="font-mono text-xs uppercase tracking-[0.25em]">Aethel</span>
          </Link>
          <p className="font-mono-caption text-muted-foreground mb-3">{eyebrow}</p>
          <h1 className="font-display italic text-4xl md:text-5xl leading-[1.05] text-balance">{title}</h1>
          {subtitle && <p className="mt-3 text-sm text-muted-foreground text-pretty">{subtitle}</p>}
          <div className="mt-10">{children}</div>
        </div>
      </main>
    </div>
  );
}
