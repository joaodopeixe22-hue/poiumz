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
      // 1. Fila prioritária
      const { data: queueData } = await supabase
        .from("queue")
        .select("id, posicao, song:songs(id, titulo, artista, duracao_segundos)")
        .order("posicao", { ascending: true })
        .limit(8);
      const queueItems = ((queueData as unknown as Item[]) ?? []).map((q) => ({
        ...q,
        id: `q-${q.id}`,
      }));

      // 2. Playlist no ar
      let playlistNext: Item[] = [];
      if (playback?.active_playlist_id) {
        const { data } = await supabase
          .from("playlist_songs")
          .select("id, posicao, song:songs(id, titulo, artista, duracao_segundos)")
          .eq("playlist_id", playback.active_playlist_id)
          .order("posicao", { ascending: true });
        const all = (data as unknown as Item[]) ?? [];
        if (all.length > 0) {
          const startIdx = ((playback.loop_index ?? 0) + 1) % all.length;
          const remaining = Math.max(0, 8 - queueItems.length);
          for (let i = 0; i < Math.min(remaining, all.length); i++) {
            playlistNext.push(all[(startIdx + i) % all.length]);
          }
        }
      }

      if (cancelled) return;
      setItems([...queueItems, ...playlistNext]);
      setLoading(false);
    };
    load();
    let debounceId: number | null = null;
    const scheduleReload = () => {
      if (debounceId !== null) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        debounceId = null;
        load();
      }, 150);
    };
    const ch = supabase
      .channel(`queue-list-watch-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "playlist_songs" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue" },
        scheduleReload,
      )
      .subscribe();
    return () => {
      cancelled = true;
      if (debounceId !== null) window.clearTimeout(debounceId);
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
