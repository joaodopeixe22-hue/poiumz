import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { analysisColumns, tryAnalyzeAudio } from "@/lib/audio-analysis-browser";

/**
 * Mede o volume e o silêncio das faixas que ainda não foram analisadas
 * ("Som de loja"). Roda no navegador do admin, uma faixa por vez, e pode ser
 * interrompido e retomado: cada faixa pronta é gravada na hora.
 */

const SOURCES = [
  { table: "songs", bucket: "songs" },
  { table: "institutional_contents", bucket: "institutional" },
] as const;
const BATCH = 25;
const FIRST_ID = "00000000-0000-0000-0000-000000000000";

type Row = { id: string; titulo: string; storage_path: string };

function formatRemaining(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `cerca de ${minutes} min restantes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `cerca de ${h} h${m ? ` ${m} min` : ""} restantes`;
}

export function AnalyzeLibraryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [pending, setPending] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [target, setTarget] = useState(0);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const stopRef = useRef(false);

  const loadPending = useCallback(async () => {
    const [songs, institutional] = await Promise.all([
      supabase.from("songs").select("id", { count: "exact", head: true }).is("analisado_em", null),
      supabase
        .from("institutional_contents")
        .select("id", { count: "exact", head: true })
        .is("analisado_em", null),
    ]);
    const total = (songs.count ?? 0) + (institutional.count ?? 0);
    setPending(total);
    return total;
  }, []);

  useEffect(() => {
    if (open && !running) void loadPending();
  }, [open, running, loadPending]);

  // Fechar a página ou desmontar o diálogo interrompe o trabalho com segurança.
  useEffect(
    () => () => {
      stopRef.current = true;
    },
    [],
  );

  const analyzeRow = async (
    source: (typeof SOURCES)[number],
    row: Row,
  ): Promise<"ok" | "sem-medida" | "falhou"> => {
    try {
      const { data: pub } = supabase.storage.from(source.bucket).getPublicUrl(row.storage_path);
      const response = await fetch(pub.publicUrl);
      // Arquivo inacessível: não marca como analisado, para tentar de novo depois.
      if (!response.ok) return "falhou";
      const buffer = await response.arrayBuffer();
      const analysis = await tryAnalyzeAudio(buffer);
      // As duas tabelas têm as mesmas colunas de análise.
      const { error: updateError } = await supabase
        .from(source.table as "songs")
        .update(analysisColumns(analysis))
        .eq("id", row.id);
      if (updateError) return "falhou";
      return analysis ? "ok" : "sem-medida";
    } catch {
      return "falhou";
    }
  };

  const run = async () => {
    stopRef.current = false;
    setError(null);
    setDone(0);
    setFailed(0);
    setSkipped(0);
    setRunning(true);
    setStartedAt(Date.now());
    try {
      setTarget(await loadPending());
      for (const source of SOURCES) {
        let lastId = FIRST_ID;
        while (!stopRef.current) {
          const { data, error: listError } = await supabase
            .from(source.table as "songs")
            .select("id, titulo, storage_path")
            .is("analisado_em", null)
            .gt("id", lastId)
            .order("id", { ascending: true })
            .limit(BATCH);
          if (listError) throw new Error(listError.message);
          const rows = (data as Row[] | null) ?? [];
          if (rows.length === 0) break;
          for (const row of rows) {
            if (stopRef.current) break;
            setCurrentTitle(row.titulo);
            const result = await analyzeRow(source, row);
            if (result === "ok") setDone((n) => n + 1);
            else if (result === "sem-medida") setSkipped((n) => n + 1);
            else setFailed((n) => n + 1);
            lastId = row.id;
          }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao analisar a biblioteca.");
    } finally {
      setRunning(false);
      setCurrentTitle(null);
      void loadPending();
    }
  };

  const stop = () => {
    stopRef.current = true;
  };

  const processed = done + failed + skipped;
  const percent = target > 0 ? Math.min(100, Math.round((processed / target) * 100)) : 0;
  const remaining =
    running && startedAt && processed >= 3
      ? formatRemaining(
          ((Date.now() - startedAt) / 1000 / processed) * Math.max(0, target - processed),
        )
      : "";
  const finished = !running && startedAt !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => (running && !v ? undefined : onOpenChange(v))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AudioLines className="size-5 text-primary" />
            Nivelar volume da biblioteca
          </DialogTitle>
          <DialogDescription>
            Mede o volume de cada faixa e onde o som começa e termina. Depois disso a rádio toca
            todas no mesmo volume e sem silêncio entre elas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {pending === null ? (
            <p className="text-sm text-muted-foreground">Conferindo a biblioteca…</p>
          ) : pending === 0 && !running ? (
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-green-500" />
              Todas as faixas já foram analisadas.
            </p>
          ) : (
            !running && (
              <p className="text-sm">
                <strong>{pending}</strong> {pending === 1 ? "faixa aguarda" : "faixas aguardam"}{" "}
                análise.
              </p>
            )
          )}

          {(running || finished) && (
            <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {running && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                  {processed} de {target}
                </span>
                <span className="text-xs text-muted-foreground">{remaining}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              {running && currentTitle && (
                <p className="text-xs text-muted-foreground truncate">Analisando: {currentTitle}</p>
              )}
              {(failed > 0 || skipped > 0) && (
                <p className="text-xs text-muted-foreground">
                  {skipped > 0 &&
                    `${skipped} sem medida (arquivo que o navegador não decodifica). `}
                  {failed > 0 &&
                    `${failed} com falha de acesso; rode de novo para tentar outra vez.`}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <p className="text-xs text-muted-foreground">
            Cada faixa é baixada uma vez para ser medida. Mantenha esta aba aberta; você pode parar
            e continuar depois sem perder o que já foi feito.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {running ? (
            <Button variant="outline" onClick={stop}>
              Parar
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button onClick={run} disabled={!pending}>
                {finished && pending ? "Continuar" : "Começar"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
