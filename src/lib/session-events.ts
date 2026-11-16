/**
 * Aviso interno: o login foi renovado. As listas que podem ter falhado com o
 * login vencido (músicas, playlists, institucional) se recarregam ao ouvir isto.
 */
export const SESSION_REFRESHED_EVENT = "radio:session-refreshed";

export function announceSessionRefreshed(): void {
  if (typeof window === "undefined") return;
  // Adiado: quem ouve faz pedidos ao servidor, e isso não deve acontecer dentro
  // do aviso de mudança de sessão da biblioteca de login.
  window.setTimeout(() => window.dispatchEvent(new Event(SESSION_REFRESHED_EVENT)), 0);
}

export function onSessionRefreshed(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener();
  window.addEventListener(SESSION_REFRESHED_EVENT, handler);
  return () => window.removeEventListener(SESSION_REFRESHED_EVENT, handler);
}
