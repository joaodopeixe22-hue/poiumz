import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ListMusic } from "lucide-react";
import { formatTime } from "@/lib/format";

type QueueItem = {
  id: string;
  posicao: number;
  songs: {
    id: string;
    titulo: string;
    artista: string | null;
    duracao_segundos: number | null;
  } | null;
};

export function QueueList() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("queue")
      .select("id, posicao, songs ( id, titulo, artista, duracao_segundos )")
      .order("posicao", { ascending: true })
      .limit(10);
    setItems((data as unknown as QueueItem[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("queue-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <ListMusic className="size-4 text-primary" />
        <h2 className="text-sm font-mono uppercase tracking-widest">A seguir</h2>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma música na fila.</p>
      ) : (
        <ol className="space-y-3">
          {items.map((it, idx) => (
            <li key={it.id} className="flex items-center gap-3 group">
              <span className="size-7 grid place-items-center rounded-full bg-secondary text-xs font-mono text-muted-foreground shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {it.songs?.titulo ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {it.songs?.artista ?? "—"}
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">
                {formatTime(it.songs?.duracao_segundos)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
