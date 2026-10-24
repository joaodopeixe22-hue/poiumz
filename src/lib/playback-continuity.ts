export type ContinuityState = {
  is_playing: boolean;
  current_song_id: string | null;
  current_institutional_id: string | null;
  started_at: string | null;
  position_seconds: number;
};

export function playbackInstance(state: ContinuityState): string {
  return JSON.stringify([state.current_song_id, state.current_institutional_id, state.started_at, state.position_seconds]);
}

export function hasPlaybackFinished(state: ContinuityState, duration: number, now = Date.now()): boolean {
  if (!state.is_playing || !state.started_at || !(duration > 0) || !Number.isFinite(duration)) return false;
  const started = Date.parse(state.started_at);
  if (!Number.isFinite(started)) return false;
  return state.position_seconds + Math.max(0, (now - started) / 1000) >= duration;
}

export function boundedAudioPosition(position: number, duration: number): number {
  const safe = Number.isFinite(position) ? Math.max(0, position) : 0;
  return Number.isFinite(duration) && duration > 0 ? Math.min(safe, duration) : safe;
}

export function nextQueueIndex(index: number, length: number, repeat: "off" | "all" | "one"): number | null {
  if (length <= 0) return null;
  if (repeat === "one") return index;
  if (index + 1 < length) return index + 1;
  return repeat === "all" ? 0 : null;
}