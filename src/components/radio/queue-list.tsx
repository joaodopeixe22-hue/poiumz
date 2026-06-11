import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ListMusic, Play } from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "@/lib/format";
import { usePlayback } from "@/hooks/use-playback";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";

type Item = {
  id: string;
  posicao: number;
  source: "queue" | "playlist";
  rawId: string;
  song: {
    id: string;
    titulo: string;
    artista: string | null;
    duracao_segundos: number | null;
  } | null;
};


export function QueueList() {
  const { playback } = usePlayback();
  const { profile } = useProfile();
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [jumping, setJumping] = useState<string | null>(null);

  const canControl =
    !!profile &&
    profile.status === "aprovado" &&
    (profile.role === "admin" || profile.role === "operador") &&
    !(playback?.is_locked && profile.role !== "admin");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: queueData } = await supabase
        .from("queue")
        .select("id, posicao, song:songs(id, titulo, artista, duracao_segundos)")
        .order("posicao", { ascending: true })
        .limit(5);
      const queueItems = ((queueData as unknown as Omit<Item, "source" | "rawId">[]) ?? []).map(
        (q) => ({
          ...q,
          rawId: q.id,
          source: "queue" as const,
          id: `q-${q.id}`,
        }),
      );

      let playlistNext: Item[] = [];
      if (playback?.active_playlist_id) {
        const { data } = await supabase
          .from("playlist_songs")
          .select("id, posicao, song:songs(id, titulo, artista, duracao_segundos)")
          .eq("playlist_id", playback.active_playlist_id)
          .order("posicao", { ascending: true });
        const all = ((data as unknown as Omit<Item, "source" | "rawId">[]) ?? []).map((p) => ({
          ...p,
          rawId: p.id,
          source: "playlist" as const,
        }));
        if (all.length > 0) {
          const startIdx = ((playback.loop_index ?? 0) + 1) % all.length;
          const remaining = Math.max(0, 5 - queueItems.length);
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

  const jumpTo = async (it: Item) => {
    if (!canControl || !it.song) return;
    setJumping(it.id);
    try {
      const { error } = await supabase
        .from("playback_state")
        .update({
          current_song_id: it.song.id,
          current_institutional_id: null,
          loop_index: it.source === "playlist" ? it.posicao : (playback?.loop_index ?? 0),
          position_seconds: 0,
          started_at: new Date().toISOString(),
          is_playing: true,
          controlled_by: user?.id ?? null,
        } as never)
        .eq("id", true);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (it.source === "queue") {
        await supabase.from("queue").delete().eq("id", it.rawId);
      }
    } finally {
      setJumping(null);
    }
  };

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
              {canControl && it.song && (
                <button
                  onClick={() => jumpTo(it)}
                  disabled={jumping === it.id}
                  className="size-7 rounded-full grid place-items-center text-muted-foreground hover:text-primary-foreground hover:bg-primary transition-colors disabled:opacity-50"
                  aria-label={`Pular para ${it.song.titulo}`}
                  title="Pular para esta faixa"
                >
                  <Play className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
