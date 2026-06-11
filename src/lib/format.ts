export function formatTime(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  return `há ${days} d`;
}

export function formatPlaylistDuration(
  songsCount: number | null | undefined,
  totalDurationSeconds: number | null | undefined,
): string {
  const count = Number(songsCount ?? 0);
  if (count <= 0) return "0 músicas";
  const label = `${count} ${count === 1 ? "música" : "músicas"}`;
  const secs = Number(totalDurationSeconds ?? 0);
  if (!secs || secs <= 0) return label;
  const totalMin = Math.max(1, Math.round(secs / 60));
  if (totalMin < 60) return `${label} · cerca de ${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const dur = m === 0 ? `${h}h` : `${h}h ${m}min`;
  return `${label} · cerca de ${dur}`;
}
