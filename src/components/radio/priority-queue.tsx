import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ListPlus,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatTime } from "@/lib/format";
import { useSongs } from "@/hooks/use-songs";

type QueueItem = {
  id: string;
  posicao: number;
  song_id: string;
  song: {
    id: string;
    titulo: string;
    artista: string | null;
    duracao_segundos: number | null;
  } | null;
};

export function PriorityQueue({ disabled }: { disabled?: boolean }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const { songs } = useSongs();

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("queue")
      .select("id, posicao, song_id, song:songs(id, titulo, artista, duracao_segundos)")
      .order("posicao", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data as unknown as QueueItem[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("priority-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const filteredSongs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inQueue = new Set(items.map((i) => i.song_id));
    return songs
      .filter((s) => !inQueue.has(s.id))
      .filter(
        (s) =>
          !q ||
          s.titulo.toLowerCase().includes(q) ||
          (s.artista ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [songs, items, search]);

  const totalDuration = items.reduce(
    (acc, i) => acc + (i.song?.duracao_segundos ?? 0),
    0,
  );

  const addToQueue = async (songId: string) => {
    const { data: pos } = await supabase.rpc(
      "next_queue_position" as never,
    );
    const { error } = await supabase.from("queue").insert({
      song_id: songId,
      posicao: (pos as number) ?? 1,
    });
    if (error) toast.error(error.message);
    else {
      setSearch("");
      setAdding(false);
    }
  };

  const move = async (item: QueueItem, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === item.id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const target = items[newIdx];
    const { error } = await supabase.rpc("reorder_queue" as never, {
      p_item_id: item.id,
      p_new_position: target.posicao,
    } as never);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("queue").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ListPlus className="size-4 text-primary" />
          <h2 className="text-sm font-mono uppercase tracking-widest">
            Fila prioritária
          </h2>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground font-mono">
              · {items.length} {items.length === 1 ? "item" : "itens"} ·{" "}
              {formatTime(totalDuration)}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setAdding((v) => !v)}
          disabled={disabled}
          className="gap-1"
        >
          <Plus className="size-4" />
          {adding ? "Fechar" : "Adicionar"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Tocam <strong>antes</strong> da playlist no ar. Cada música é removida da
        fila quando termina.
      </p>

      {adding && (
        <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar música por título ou artista…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredSongs.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 text-center">
                {songs.length === 0
                  ? "Nenhuma música cadastrada ainda."
                  : "Nenhuma música encontrada."}
              </p>
            ) : (
              filteredSongs.map((s) => (
                <button
                  key={s.id}
                  onClick={() => addToQueue(s.id)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-secondary text-left transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.titulo}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.artista ?? "—"}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {formatTime(s.duracao_segundos)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          Fila vazia. A transmissão segue pela playlist no ar.
        </div>
      ) : (
        <ol className="space-y-2">
          {items.map((it, idx) => (
            <li
              key={it.id}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 group"
            >
              <GripVertical className="size-4 text-muted-foreground/40 shrink-0" />
              <span className="size-6 grid place-items-center rounded-full bg-secondary text-xs font-mono text-muted-foreground shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {it.song?.titulo ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {it.song?.artista ?? "—"}
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0 mr-1">
                {formatTime(it.song?.duracao_segundos)}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => move(it, -1)}
                  disabled={disabled || idx === 0}
                  aria-label="Subir"
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => move(it, 1)}
                  disabled={disabled || idx === items.length - 1}
                  aria-label="Descer"
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-red-500 hover:text-red-400"
                  onClick={() => remove(it.id)}
                  disabled={disabled}
                  aria-label="Remover"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
