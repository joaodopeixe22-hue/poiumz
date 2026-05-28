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
        <div className="absolute inset-0 pointer-events-none opacity-70">
          <div
            className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-3xl"
            style={{
              background: "radial-gradient(circle, oklch(0.86 0.18 130 / 0.18), transparent 70%)",
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-3xl"
            style={{
              background: "radial-gradient(circle, oklch(0.60 0.14 220 / 0.18), transparent 70%)",
            }}
          />
        </div>

        <Link to="/" className="relative flex items-center gap-3 z-10">
          <div className="size-9 rounded-lg bg-accent grid place-items-center">
            <span className="material-symbols text-[20px] text-accent-foreground" aria-hidden>
              graphic_eq
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Focus Audio</p>
            <p className="text-[10px] text-accent font-medium tracking-wide">Premium Focus</p>
          </div>
        </Link>

        <div className="relative z-10 max-w-md">
          <p className="text-xs text-accent font-medium tracking-wide mb-4 uppercase">A note</p>
          <p className="font-display text-3xl xl:text-4xl leading-tight text-balance">
            Premium audio for deep focus. Curated frequencies, considered design, your sound —
            uninterrupted.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">— Focus Audio Studio</p>
        </div>

        <div className="relative z-10 text-xs text-muted-foreground tracking-wide">
          Vol. 01 — Issue 0001
        </div>
      </aside>

      {/* Right — form column */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden flex items-center gap-3 mb-10">
            <div className="size-8 rounded-lg bg-accent grid place-items-center">
              <span className="material-symbols text-[18px] text-accent-foreground" aria-hidden>
                graphic_eq
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Focus Audio</p>
              <p className="text-[10px] text-accent font-medium tracking-wide">Premium Focus</p>
            </div>
          </Link>
          <p className="text-xs text-accent font-medium tracking-wide mb-3 uppercase">{eyebrow}</p>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.05] text-balance">{title}</h1>
          {subtitle && <p className="mt-3 text-sm text-muted-foreground text-pretty">{subtitle}</p>}
          <div className="mt-10">{children}</div>
        </div>
      </main>
    </div>
  );
}
