import { createFileRoute, Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { RadioPlayer } from "@/components/radio/radio-player";
import { QueueList } from "@/components/radio/queue-list";
import { HistoryList } from "@/components/radio/history-list";
import { HomeRadioControls } from "@/components/radio/home-radio-controls";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rádio Corporativa — RD Saúde" },
      {
        name: "description",
        content:
          "Rádio corporativa da RD Saúde — ouça a programação ao vivo, acompanhe a próxima música e o histórico de reproduções.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Topbar */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary grid place-items-center">
              <span className="text-primary-foreground font-bold text-sm">RD</span>
            </div>
            <span className="font-semibold tracking-tight">Rádio RD Saúde</span>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogIn className="size-4" />
            Acessar painel
          </Link>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-6xl mx-auto px-6 py-10 md:py-16">
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <RadioPlayer />
          </div>
          <div className="space-y-6">
            <QueueList />
            <HistoryList />
          </div>
        </div>
      </main>

      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} RD Saúde — Plataforma interna de rádio corporativa
        </div>
      </footer>
    </div>
  );
}
