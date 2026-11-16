/**
 * Guardião do login.
 *
 * A biblioteca de login renova a sessão olhando o relógio do computador e para
 * de renovar quando a aba fica em segundo plano. Num PC com o relógio atrasado,
 * o servidor passa a recusar o login antes de o navegador perceber — as listas
 * somem e o nome do usuário desaparece, até a renovação tardia.
 *
 * Aqui a renovação segue a hora do servidor e roda mesmo com a aba escondida.
 * Como rede de segurança, de tempos em tempos perguntamos ao próprio servidor
 * se o login ainda vale, o que não depende de relógio nenhum.
 */
import { supabase } from "@/integrations/supabase/client";
import { reportServerTime, serverNow, syncServerClock } from "@/lib/server-clock";

/** Renova quando faltar isto para o login vencer (pela hora do servidor). */
export const REFRESH_BEFORE_MS = 5 * 60 * 1000;
const CHECK_MS = 30 * 1000;
const PROBE_MS = 4 * 60 * 1000;

export function needsRefresh(
  expiresAtSeconds: number | null | undefined,
  nowMs: number,
  marginMs: number = REFRESH_BEFORE_MS,
): boolean {
  const expiresAt = Number(expiresAtSeconds);
  if (expiresAtSeconds == null || !Number.isFinite(expiresAt) || expiresAt <= 0) return false;
  return expiresAt * 1000 - nowMs <= marginMs;
}

/** O servidor recusou o login apresentado (vencido ou inválido)? */
export function isRejectedLogin(error: { status?: number } | null | undefined): boolean {
  return error?.status === 401 || error?.status === 403;
}

const monotonic = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export function startSessionKeeper(): () => void {
  if (typeof window === "undefined") return () => {};
  let stopped = false;
  let busy = false;
  let lastProbe = -Infinity;

  const refresh = async () => {
    const { data, error } = await supabase.auth.refreshSession();
    const session = data?.session;
    if (error || !session) return;
    // A resposta acabou de sair do servidor: serve para conferir o relógio.
    if (session.expires_at && session.expires_in) {
      reportServerTime((session.expires_at - session.expires_in) * 1000);
    }
  };

  const check = async (resumed: boolean) => {
    if (stopped || busy) return;
    busy = true;
    try {
      await syncServerClock(resumed);
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session || stopped) return;

      if (needsRefresh(session.expires_at, serverNow())) {
        await refresh();
        return;
      }

      if (resumed || monotonic() - lastProbe >= PROBE_MS) {
        lastProbe = monotonic();
        const { error } = await supabase.auth.getUser();
        if (!stopped && isRejectedLogin(error)) await refresh();
      }
    } catch {
      /* sem rede ou navegador ocupado: tenta de novo no próximo ciclo */
    } finally {
      busy = false;
    }
  };

  const onResume = () => {
    if (document.visibilityState === "visible") void check(true);
  };
  const onOnline = () => void check(true);

  void check(true);
  const timer = window.setInterval(() => void check(false), CHECK_MS);
  document.addEventListener("visibilitychange", onResume);
  window.addEventListener("focus", onResume);
  window.addEventListener("online", onOnline);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onResume);
    window.removeEventListener("focus", onResume);
    window.removeEventListener("online", onOnline);
  };
}
