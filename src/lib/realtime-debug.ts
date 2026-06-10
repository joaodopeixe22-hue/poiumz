import { supabase } from "@/integrations/supabase/client";

/**
 * Dev-only sanity check for Supabase Realtime.
 *
 * Periodicamente inspeciona os canais ativos e avisa quando:
 *  - Existem canais duplicados (mesmo "topic" inscrito mais de uma vez)
 *  - Algum canal acumulou mais de 1 listener para o mesmo evento (potencial
 *    indicador de .on() chamado várias vezes ou listener "preso" após
 *    navegação entre páginas).
 *
 * Também expõe `window.__realtimeChannels()` para inspeção manual rápida no
 * console do navegador.
 */
export function installRealtimeDebug() {
  if (typeof window === "undefined") return;
  if (import.meta.env.PROD) return;
  // evita múltiplas instalações em HMR
  if ((window as unknown as { __realtimeDebugInstalled?: boolean }).__realtimeDebugInstalled)
    return;
  (window as unknown as { __realtimeDebugInstalled?: boolean }).__realtimeDebugInstalled = true;

  const snapshot = () => {
    const channels = supabase.getChannels();
    return channels.map((c) => {
      const bindings =
        (c as unknown as { bindings?: Record<string, unknown[]> }).bindings ?? {};
      const counts: Record<string, number> = {};
      for (const [type, list] of Object.entries(bindings)) {
        counts[type] = Array.isArray(list) ? list.length : 0;
      }
      return {
        topic: c.topic,
        state: c.state,
        bindings: counts,
      };
    });
  };

  (window as unknown as { __realtimeChannels?: () => unknown }).__realtimeChannels = snapshot;

  let lastWarnedKey = "";
  const check = () => {
    const snap = snapshot();

    // duplicatas por topic
    const byTopic = new Map<string, number>();
    for (const s of snap) byTopic.set(s.topic, (byTopic.get(s.topic) ?? 0) + 1);
    const dups = [...byTopic.entries()].filter(([, n]) => n > 1);

    // bindings excessivos no mesmo canal
    const heavy = snap.filter((s) =>
      Object.values(s.bindings).some((n) => (n as number) > 1),
    );

    if (dups.length === 0 && heavy.length === 0) return;
    const key = JSON.stringify({ dups, heavy });
    if (key === lastWarnedKey) return;
    lastWarnedKey = key;

    if (dups.length) {
      console.warn(
        "[realtime] canais duplicados detectados — provável vazamento após navegação:",
        dups,
      );
    }
    if (heavy.length) {
      console.warn(
        "[realtime] canais com listeners duplicados (.on() chamado mais de uma vez):",
        heavy,
      );
    }
  };

  // checa após navegações e periodicamente
  const id = window.setInterval(check, 4000);
  return () => window.clearInterval(id);
}
