interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

export function PageHeader({ eyebrow, title, subtitle }: PageHeaderProps) {
  return (
    <header className="px-10 pt-10 pb-6 animate-fade-in-up">
      {eyebrow && (
        <p className="text-xs text-accent font-medium tracking-wide mb-2 uppercase">{eyebrow}</p>
      )}
      <h1 className="font-display text-4xl text-balance">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted-foreground max-w-xl">{subtitle}</p>}
    </header>
  );
}

export function ComingSoon({ stage, note }: { stage: string; note: string }) {
  return (
    <div className="px-10 pb-12">
      <div className="rounded-xl border border-border bg-card/60 p-6 max-w-xl">
        <p className="text-xs text-accent font-medium tracking-wide mb-2 uppercase">{stage}</p>
        <p className="text-sm text-muted-foreground text-pretty">{note}</p>
      </div>
    </div>
  );
}
