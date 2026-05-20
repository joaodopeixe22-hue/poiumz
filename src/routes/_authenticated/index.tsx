import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Aethel — Home" },
      { name: "description", content: "Your daily rotation, curated picks, and recently played." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Late night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <header className="p-12 pb-6 flex justify-between items-end">
        <h1 className="font-display italic text-5xl text-balance animate-fade-in-up">{greeting}.</h1>
        <div className="font-mono-caption text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" })} // {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </div>
      </header>

      <section className="p-12 pt-6 grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 group relative animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <div className="w-full aspect-[2/1] rounded-sm overflow-hidden ring-1 ring-border group-hover:ring-accent/30 transition-all relative">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at 30% 40%, oklch(0.45 0.10 30 / 0.6), transparent 60%), radial-gradient(ellipse at 80% 60%, oklch(0.30 0.06 80 / 0.6), transparent 70%), oklch(0.18 0.008 60)",
              }}
            />
            <div className="absolute inset-0 grid place-items-end p-8">
              <div>
                <p className="font-mono-caption text-accent mb-2">Heavy Rotation // Archive 01</p>
                <h2 className="font-display italic text-3xl">Selected Works for Dusk</h2>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-between items-baseline">
            <h3 className="font-display italic text-2xl">Pick up where you left off</h3>
            <span className="font-mono text-xs text-accent cursor-pointer hover:underline">Play Now</span>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <p className="font-mono-caption text-muted-foreground mb-5">Recently Played</p>
          <ul className="space-y-4">
            {recentPlaceholders.map((t) => (
              <li key={t.title} className="flex items-center gap-4 group cursor-pointer">
                <div className="size-12 bg-secondary shrink-0 rounded-sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-accent transition-colors">{t.title}</p>
                  <p className="font-mono-caption text-muted-foreground truncate">{t.artist}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="p-12 pt-0 space-y-8">
        <div className="flex justify-between items-center border-b border-border pb-4">
          <h2 className="font-mono-caption text-foreground">Curated for you</h2>
          <a className="font-mono-caption text-muted-foreground hover:text-foreground cursor-pointer">View All</a>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          {curated.map((c, i) => (
            <div key={c.title} className="space-y-3 cursor-pointer group">
              <div className="w-full aspect-square rounded-sm overflow-hidden ring-1 ring-border group-hover:ring-accent/40 transition-all grid place-items-center"
                style={{
                  background: `linear-gradient(135deg, oklch(0.${30 + i * 5} 0.${4 + i} ${30 + i * 30}), oklch(0.${20 + i * 3} 0.${2 + i} ${10 + i * 20}))`,
                }}
              >
                <span className="font-mono-caption text-foreground/40">00{i + 1}</span>
              </div>
              <p className="text-xs font-medium leading-tight">{c.title}</p>
              <p className="font-mono-caption text-muted-foreground">{c.genre}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const recentPlaceholders = [
  { title: "Solace in Minor", artist: "The Highline Quartet" },
  { title: "Concrete Echoes", artist: "Elias Thorne" },
  { title: "Midnight Theory", artist: "Vespera" },
];

const curated = [
  { title: "Spatial Discipline", genre: "Techno / Ambient" },
  { title: "Morning Ritual", genre: "Neo-Classical" },
  { title: "The Editor's Choice", genre: "Soul / Jazz" },
  { title: "Night Drive", genre: "Synthwave" },
  { title: "Structure & Form", genre: "Deep House" },
];
