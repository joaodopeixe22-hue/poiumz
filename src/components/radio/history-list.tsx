import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History } from "lucide-react";
import { formatRelative } from "@/lib/format";

type HistoryItem = {
  id: string;
  titulo: string;
  artista: string | null;
  created_at: string;
};

/**
 * Etapa 1: enquanto não há tabela de histórico de reprodução real,
 * mostramos as últimas músicas cadastradas (mais recentes).
 * Será substituído por log real em etapas seguintes.
 */
export function HistoryList() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("songs")
      .select("id, titulo, artista, created_at")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setItems((data as HistoryItem[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <History className="size-4 text-primary" />
        <h2 className="text-sm font-mono uppercase tracking-widest">Recentes</h2>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sem músicas cadastradas. Faça upload pelo painel.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{it.titulo}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {it.artista ?? "—"}
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground shrink-0">
                {formatRelative(it.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
