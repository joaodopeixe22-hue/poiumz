import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ListMusic } from "lucide-react";
import { formatTime } from "@/lib/format";
import { usePlayback } from "@/hooks/use-playback";

type Item = {
  id: string;
  posicao: number;
  song: {
    id: string;
    titulo: string;
    artista: string | null;
    duracao_segundos: number | null;
  } | null;
};

export function QueueList() {
  const { playback } = usePlayback();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!playback?.active_playlist_id) {
        setItems([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("playlist_songs")
        .select(
          "id, posicao, song:songs(id, titulo, artista, duracao_segundos)",
        )
        .eq("playlist_id", playback.active_playlist_id)
        .order("posicao", { ascending: true });
      if (cancelled) return;
      const all = (data as unknown as Item[]) ?? [];
      const startIdx = ((playback.loop_index ?? 0) + 1) % Math.max(1, all.length);
      // mostra os próximos 8 itens em ordem circular
      const next: Item[] = [];
      for (let i = 0; i < Math.min(8, all.length); i++) {
        next.push(all[(startIdx + i) % all.length]);
      }
      setItems(next);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("queue-list-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "playlist_songs" },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [playback?.active_playlist_id, playback?.loop_index]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <ListMusic className="size-4 text-primary" />
        <h2 className="text-sm font-mono uppercase tracking-widest">A seguir</h2>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !playback?.active_playlist_id ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma playlist no ar no momento.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          A playlist no ar está vazia.
        </p>
      ) : (
        <ol className="space-y-3">
          {items.map((it, idx) => (
            <li key={`${it.id}-${idx}`} className="flex items-center gap-3 group">
              <span className="size-7 grid place-items-center rounded-full bg-secondary text-xs font-mono text-muted-foreground shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{it.song?.titulo ?? "—"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {it.song?.artista ?? "—"}
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">
                {formatTime(it.song?.duracao_segundos)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
