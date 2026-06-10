import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Focus Audio — Início" },
      { name: "description", content: "Seu espaço de áudio personalizado para foco profundo." },
    ],
  }),
  component: HomePage,
});

function MS({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols ${className}`} aria-hidden>
      {name}
    </span>
  );
}

function HomePage() {
  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? "Boa madrugada"
      : hour < 12
        ? "Bom dia"
        : hour < 18
          ? "Boa tarde"
          : "Boa noite";

  return (
    <div>
      <header className="px-10 pt-10 pb-6 animate-fade-in-up">
        <h1 className="font-display text-4xl">{greeting}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Seu espaço sonoro personalizado.</p>
      </header>

      <section className="px-10">
        <div
          className="relative rounded-2xl overflow-hidden border border-border p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10 animate-fade-in-up"
          style={{
            background:
              "radial-gradient(ellipse at 80% 20%, oklch(0.86 0.18 130 / 0.18), transparent 55%), radial-gradient(ellipse at 20% 80%, oklch(0.55 0.16 280 / 0.22), transparent 60%), oklch(0.20 0.008 260)",
          }}
        >
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] text-accent font-semibold tracking-wider uppercase bg-accent/10 px-2.5 py-1 rounded-full">
              <MS name="bolt" className="text-[12px]" /> Foco Profundo
            </span>
            <h2 className="font-display text-4xl md:text-5xl mt-4 leading-tight text-balance">
              Batidas Binaurais & Ondas Alfa
            </h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-xl text-pretty">
              2 horas de frequências ambientes ininterruptas, criadas para potencializar o fluxo
              cognitivo e silenciar distrações.
            </p>
            <button className="mt-6 inline-flex items-center gap-2 bg-accent text-accent-foreground rounded-full pl-2 pr-5 py-2 text-sm font-semibold hover:scale-[1.02] transition-transform shadow-lg shadow-accent/20">
              <span className="size-7 rounded-full bg-accent-foreground/10 grid place-items-center">
                <MS name="play_arrow" className="text-[20px]" />
              </span>
              Tocar agora
            </button>
          </div>
          <div
            className="shrink-0 hidden md:grid size-44 rounded-xl border border-border/60 place-items-center"
            style={{
              background:
                "conic-gradient(from 90deg at 50% 50%, oklch(0.86 0.18 130 / 0.4), oklch(0.55 0.16 280 / 0.4), oklch(0.86 0.18 130 / 0.4))",
            }}
          >
            <MS name="graphic_eq" className="text-[64px] text-foreground/70" />
          </div>
        </div>
      </section>

      <section className="px-10 mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {quickRow.map((q, i) => (
          <div
            key={q.title}
            className="group flex items-center gap-4 bg-card/60 hover:bg-card border border-border rounded-xl p-3 pr-5 cursor-pointer transition-colors animate-fade-in-up"
            style={{ animationDelay: `${100 + i * 60}ms` }}
          >
            <div
              className="size-14 rounded-md shrink-0 grid place-items-center"
              style={{
                background: `linear-gradient(135deg, oklch(0.${35 + i * 5} 0.${8 + i * 2} ${130 + i * 60}), oklch(0.${22 + i * 3} 0.${4 + i} ${220 + i * 30}))`,
              }}
            >
              <MS name="music_note" className="text-[22px] text-foreground/80" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{q.title}</p>
              <p className="text-xs text-muted-foreground truncate">{q.subtitle}</p>
            </div>
            <button
              aria-label="Tocar"
              className="size-9 rounded-full bg-accent text-accent-foreground grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MS name="play_arrow" className="text-[20px]" />
            </button>
          </div>
        ))}
      </section>

      <section className="px-10 mt-12 pb-10">
        <div className="flex justify-between items-end mb-5">
          <div>
            <p className="text-xs text-accent font-medium tracking-wide mb-1 uppercase">
              Curadoria
            </p>
            <h2 className="font-display text-2xl">Feito para você</h2>
          </div>
          <a className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
            Ver tudo
          </a>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 animate-fade-in-up">
          {curated.map((c, i) => (
            <div key={c.title} className="group cursor-pointer">
              <div
                className="relative w-full aspect-square rounded-xl overflow-hidden border border-border grid place-items-center"
                style={{
                  background: `linear-gradient(${135 + i * 30}deg, oklch(0.${35 + i * 4} 0.${10 + i * 2} ${100 + i * 40}), oklch(0.${20 + i * 2} 0.${4 + i} ${260 + i * 20}))`,
                }}
              >
                <MS name="album" className="text-[44px] text-foreground/40" />
                <button
                  aria-label="Tocar"
                  className="absolute bottom-3 right-3 size-11 rounded-full bg-accent text-accent-foreground grid place-items-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-lg shadow-accent/30"
                >
                  <MS name="play_arrow" className="text-[24px]" />
                </button>
              </div>
              <p className="mt-3 text-sm font-semibold leading-tight">{c.title}</p>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.subtitle}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const quickRow = [
  { title: "Silêncio Estrutural", subtitle: "Techno Minimalista" },
  { title: "Direção Noturna", subtitle: "Foco Synthwave" },
  { title: "Ritual Matinal", subtitle: "Neoclássico" },
];

const curated = [
  { title: "Ambiente Matinal", subtitle: "Comece suave, mantenha o foco." },
  { title: "Estado de Fluxo", subtitle: "Batidas eletrônicas para trabalho profundo." },
  { title: "Sonata para Estudo", subtitle: "Mix clássico para concentração." },
  { title: "Paisagens Cinematográficas", subtitle: "Texturas épicas de fundo." },
];
