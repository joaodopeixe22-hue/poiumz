import { useUploadStore, uploadStats } from "@/stores/upload-store";
import { useBulkUpload } from "@/hooks/use-bulk-upload";
import { AnimatePresence, motion } from "framer-motion";

function MS({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols ${className}`} aria-hidden>
      {name}
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  queued: "na fila",
  hashing: "calculando hash",
  parsing: "analisando",
  uploading: "enviando",
  saving: "salvando",
  done: "concluído",
  error: "erro",
  skipped: "ignorado",
  cancelled: "cancelado",
};

export function UploadQueuePanel() {
  const items = useUploadStore((s) => s.items);
  const isPaused = useUploadStore((s) => s.isPaused);
  const isMinimized = useUploadStore((s) => s.isMinimized);
  const setPaused = useUploadStore((s) => s.setPaused);
  const setMinimized = useUploadStore((s) => s.setMinimized);
  const remove = useUploadStore((s) => s.remove);
  const clearDone = useUploadStore((s) => s.clearDone);
  const clearAll = useUploadStore((s) => s.clearAll);
  const { cancelItem, retryItem } = useBulkUpload();

  if (!items.length) return null;
  const stats = uploadStats(items);
  const allFinished = stats.active === 0 && stats.done + stats.failed === stats.total;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed right-6 bottom-28 z-40 w-[380px] bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {allFinished ? "Envio concluído" : isPaused ? "Pausado" : "Enviando"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {stats.done}/{stats.total} concluídos · {stats.failed} com falha
            </p>
          </div>
          {!allFinished && (
            <button
              onClick={() => setPaused(!isPaused)}
              className="size-7 grid place-items-center rounded-full hover:bg-secondary transition-colors text-muted-foreground"
              aria-label={isPaused ? "Retomar" : "Pausar"}
            >
              <MS name={isPaused ? "play_arrow" : "pause"} className="text-[18px]" />
            </button>
          )}
          <button
            onClick={() => setMinimized(!isMinimized)}
            className="size-7 grid place-items-center rounded-full hover:bg-secondary transition-colors text-muted-foreground"
            aria-label="Minimizar"
          >
            <MS name={isMinimized ? "expand_less" : "expand_more"} className="text-[18px]" />
          </button>
          <button
            onClick={() => (allFinished ? clearAll() : clearDone())}
            className="size-7 grid place-items-center rounded-full hover:bg-secondary transition-colors text-muted-foreground"
            aria-label="Limpar"
          >
            <MS name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="h-1 bg-border">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${stats.pct}%` }}
          />
        </div>

        {!isMinimized && (
          <ul className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {items.map((it) => {
              const isError = it.status === "error";
              const isDone = it.status === "done";
              const isSkipped = it.status === "skipped";
              const isCancelled = it.status === "cancelled";
              const active = ["hashing", "parsing", "uploading", "saving"].includes(it.status);
              return (
                <li key={it.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="size-7 rounded-md bg-secondary grid place-items-center shrink-0">
                    <MS
                      name={
                        isDone
                          ? "check_circle"
                          : isError
                            ? "error"
                            : isSkipped
                              ? "block"
                              : isCancelled
                                ? "cancel"
                                : "music_note"
                      }
                      className={`text-[16px] ${
                        isDone
                          ? "text-accent"
                          : isError
                            ? "text-destructive"
                            : isSkipped
                              ? "text-muted-foreground"
                              : "text-foreground/70"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate font-medium">{it.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-0.5 flex-1 bg-border rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-200 ${
                            isError ? "bg-destructive" : "bg-accent"
                          }`}
                          style={{ width: `${it.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {STATUS_LABEL[it.status] ?? it.status}
                      </span>
                    </div>
                    {it.error && (
                      <p className="text-[10px] text-destructive mt-0.5 truncate">{it.error}</p>
                    )}
                  </div>
                  {isError ? (
                    <button
                      onClick={() => retryItem(it.id)}
                      className="size-6 grid place-items-center rounded-full text-accent hover:bg-accent/15 transition-colors"
                      aria-label="Tentar novamente"
                    >
                      <MS name="refresh" className="text-[14px]" />
                    </button>
                  ) : active ? (
                    <button
                      onClick={() => cancelItem(it.id)}
                      className="size-6 grid place-items-center rounded-full text-muted-foreground hover:bg-secondary transition-colors"
                      aria-label="Cancelar"
                    >
                      <MS name="close" className="text-[14px]" />
                    </button>
                  ) : (
                    <button
                      onClick={() => remove(it.id)}
                      className="size-6 grid place-items-center rounded-full text-muted-foreground hover:bg-secondary transition-colors"
                      aria-label="Remover"
                    >
                      <MS name="close" className="text-[14px]" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
