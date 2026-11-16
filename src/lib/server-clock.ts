/**
 * Hora do servidor.
 *
 * O relógio de cada computador pode estar errado (já vimos um PC de loja 1 hora
 * atrasado). Tudo o que compara "agora" com um horário gravado pelo servidor —
 * validade do login, posição da faixa, fim da faixa — deve usar `serverNow()`.
 *
 * A diferença é medida pelo cabeçalho `Date` de um arquivo estático do próprio
 * site (mesma origem, sem login). Diferenças pequenas são ignoradas: o cabeçalho
 * só tem precisão de 1 segundo e um relógio certo não precisa de correção.
 */

/** Abaixo disso o relógio local é considerado certo. */
export const IGNORE_BELOW_MS = 2000;
const RESYNC_MS = 30 * 60 * 1000;
const RETRY_MS = 60 * 1000;
const CLOCK_URL = "/manifest.webmanifest";

let offsetMs = 0;
let lastAttempt = 0; // em performance.now(): não depende do relógio do sistema
let synced = false;
let pending: Promise<number> | null = null;

/**
 * Diferença (servidor − local) a partir de uma resposta HTTP.
 * `sentAt` e `receivedAt` são leituras locais de Date.now() em volta do pedido.
 */
export function estimateOffsetMs(serverDateMs: number, sentAt: number, receivedAt: number): number {
  if (!Number.isFinite(serverDateMs) || !Number.isFinite(sentAt) || !Number.isFinite(receivedAt))
    return 0;
  // O cabeçalho Date vem truncado em segundos: assume o meio do segundo.
  const raw = serverDateMs + 500 - (sentAt + receivedAt) / 2;
  return Math.abs(raw) < IGNORE_BELOW_MS ? 0 : Math.round(raw);
}

/** Agora, na hora do servidor (ms desde 1970). */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function getServerOffsetMs(): number {
  return offsetMs;
}

/**
 * Informa uma leitura direta da hora do servidor (ex.: resposta de renovação de
 * login, emitida naquele instante). Usa a mesma tolerância da medição normal.
 */
export function reportServerTime(serverMs: number, localMs: number = Date.now()): number {
  if (!Number.isFinite(serverMs)) return offsetMs;
  const raw = serverMs - localMs;
  offsetMs = Math.abs(raw) < IGNORE_BELOW_MS ? 0 : Math.round(raw);
  synced = true;
  return offsetMs;
}

/** Só para testes. */
export function resetServerClockForTests(offset = 0): void {
  offsetMs = offset;
  lastAttempt = 0;
  synced = false;
  pending = null;
}

const monotonic = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

async function measure(): Promise<number> {
  const sentAt = Date.now();
  const response = await fetch(
    `${CLOCK_URL}?clock=${sentAt}-${Math.random().toString(36).slice(2)}`,
    {
      method: "HEAD",
      cache: "no-store",
      credentials: "omit",
    },
  );
  const receivedAt = Date.now();
  const header = response.headers.get("date");
  const serverDateMs = header ? Date.parse(header) : NaN;
  if (!Number.isFinite(serverDateMs)) throw new Error("Resposta sem cabeçalho Date.");
  offsetMs = estimateOffsetMs(serverDateMs, sentAt, receivedAt);
  synced = true;
  return offsetMs;
}

/**
 * Mede (ou reaproveita) a diferença para o servidor. Nunca rejeita: se a medição
 * falhar, mantém o valor anterior. Chamadas repetidas são baratas — só mede de
 * novo a cada 30 min, ou a cada 1 min enquanto ainda não conseguiu.
 */
export function syncServerClock(force = false): Promise<number> {
  if (typeof window === "undefined" || typeof fetch !== "function")
    return Promise.resolve(offsetMs);
  if (pending) return pending;
  const elapsed = monotonic() - lastAttempt;
  if (!force && lastAttempt > 0 && elapsed < (synced ? RESYNC_MS : RETRY_MS))
    return Promise.resolve(offsetMs);
  lastAttempt = monotonic();
  pending = measure()
    .catch(() => offsetMs)
    .finally(() => {
      pending = null;
    });
  return pending;
}
