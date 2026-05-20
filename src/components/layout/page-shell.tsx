interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

export function PageHeader({ eyebrow, title, subtitle }: PageHeaderProps) {
  return (
    <header className="p-12 pb-8 animate-fade-in-up">
      {eyebrow && <p className="font-mono-caption text-muted-foreground mb-3">{eyebrow}</p>}
      <h1 className="font-display italic text-5xl text-balance">{title}</h1>
      {subtitle && <p className="mt-3 text-sm text-muted-foreground max-w-xl">{subtitle}</p>}
    </header>
  );
}

export function ComingSoon({ stage, note }: { stage: string; note: string }) {
  return (
    <div className="px-12 pb-12">
      <div className="rounded-sm border border-border bg-card/40 p-8 max-w-xl">
        <p className="font-mono-caption text-accent mb-3">{stage}</p>
        <p className="text-sm text-muted-foreground text-pretty">{note}</p>
      </div>
    </div>
  );
}
