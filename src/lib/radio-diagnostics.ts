import { supabase } from "@/integrations/supabase/client";

export type RadioDiagEvent =
  | "playback_state_received"
  | "url_resolved"
  | "url_resolution_failed"
  | "src_applied"
  | "play_attempt"
  | "play_success"
  | "play_blocked"
  | "play_failed"
  | "audio_error"
  | "loaded_metadata"
  | "buffering"
  | "manual_play";

export type RadioDiagPayload = {
  event: RadioDiagEvent;
  ts: string;
  // Contexto livre — qualquer chave relevante (track_id, url, error, etc.)
  [key: string]: unknown;
};

// Persistência opcional: se a tabela `radio_diagnostics` existir no banco,
// os eventos são gravados; caso contrário, falham silenciosamente.
// Para habilitar no futuro, criar:
//   create table public.radio_diagnostics (
//     id uuid primary key default gen_random_uuid(),
//     payload jsonb not null,
//     created_at timestamptz not null default now()
//   );
// + RLS adequada (insert para anon, select para admin).
let remoteEnabled = true;

export function logRadio(event: RadioDiagEvent, data: Record<string, unknown> = {}) {
  const payload: RadioDiagPayload = {
    event,
    ts: new Date().toISOString(),
    ...sanitize(data),
  };

  // Console — sempre. Prefixo único facilita filtrar em DevTools.
  // eslint-disable-next-line no-console
  console.log(`[radio-diag] ${event}`, payload);

  // Remoto — best-effort.
  if (!remoteEnabled) return;
  void supabase
    .from("radio_diagnostics" as never)
    .insert({ payload } as never)
    .then(({ error }) => {
      if (!error) return;
      // Desabilita após 1ª falha para não inundar a rede em loops de evento.
      const msg = error.message ?? "";
      if (
        msg.includes("does not exist") ||
        msg.includes("not found") ||
        msg.includes("permission") ||
        msg.includes("relation")
      ) {
        remoteEnabled = false;
      }
    });
}

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Error) {
      out[k] = { name: v.name, message: v.message };
    } else if (typeof v === "string" && v.length > 800) {
      out[k] = v.slice(0, 800) + "…";
    } else {
      out[k] = v;
    }
  }
  return out;
}
