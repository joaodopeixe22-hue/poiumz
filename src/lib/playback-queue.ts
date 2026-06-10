// Pure helpers for the in-memory playback queue.
// No DOM, no Supabase — safe to unit-test.

export type QueueTrack = {
  id: string;
  titulo: string;
  artista: string | null;
  duracao_segundos: number | null;
  storage_path?: string;
  url?: string;
  sourcePlaylistId?: string | null;
  manuallyQueued?: boolean;
};

export type QueueState = {
  queue: QueueTrack[];
  index: number;
};

/** Insert one track immediately after the currently-playing track. */
export function insertAfterCurrent(
  state: QueueState,
  track: QueueTrack,
): QueueState {
  const { queue, index } = state;
  if (queue.length === 0) {
    return { queue: [{ ...track, manuallyQueued: true }], index: 0 };
  }
  const insertAt = Math.min(queue.length, index + 1);
  const next = queue.slice();
  next.splice(insertAt, 0, { ...track, manuallyQueued: true });
  return { queue: next, index };
}

/**
 * Insert multiple tracks immediately after the currently-playing track,
 * preserving the given order.
 */
export function insertMultipleAfterCurrent(
  state: QueueState,
  tracks: QueueTrack[],
): QueueState {
  const { queue, index } = state;
  if (tracks.length === 0) return state;
  const tagged = tracks.map((t) => ({ ...t, manuallyQueued: true }));
  if (queue.length === 0) return { queue: tagged, index: 0 };
  const insertAt = Math.min(queue.length, index + 1);
  const next = queue.slice();
  next.splice(insertAt, 0, ...tagged);
  return { queue: next, index };
}

/**
 * "Play next" — insert at index+1, BEFORE any other manual inserts queued
 * after the current track. Same as insertAfterCurrent for our model.
 */
export function insertAsNext(
  state: QueueState,
  track: QueueTrack,
): QueueState {
  return insertAfterCurrent(state, track);
}

/** Append at the end of the queue. */
export function appendToQueue(
  state: QueueState,
  track: QueueTrack,
): QueueState {
  const { queue, index } = state;
  if (queue.length === 0) {
    return { queue: [{ ...track, manuallyQueued: true }], index: 0 };
  }
  return {
    queue: [...queue, { ...track, manuallyQueued: true }],
    index,
  };
}

/** Remove an item at a position (cannot remove the currently-playing one). */
export function removeAt(state: QueueState, at: number): QueueState {
  const { queue, index } = state;
  if (at < 0 || at >= queue.length) return state;
  if (at === index) return state;
  const next = queue.slice(0, at).concat(queue.slice(at + 1));
  const newIndex = at < index ? index - 1 : index;
  return { queue: next, index: newIndex };
}

/** Remove by id (first match). */
export function removeById(state: QueueState, id: string): QueueState {
  const at = state.queue.findIndex((t) => t.id === id);
  if (at === -1) return state;
  return removeAt(state, at);
}

/** Move a queue item, never moving or displacing the currently-playing one. */
export function moveItem(
  state: QueueState,
  from: number,
  to: number,
): QueueState {
  const { queue, index } = state;
  if (from === to) return state;
  if (from < 0 || from >= queue.length) return state;
  if (to < 0 || to >= queue.length) return state;
  if (from === index || to === index) return state;
  const next = queue.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  let newIndex = index;
  if (from < index && to >= index) newIndex = index - 1;
  else if (from > index && to <= index) newIndex = index + 1;
  return { queue: next, index: newIndex };
}

/** Remove all manually-queued tracks except the currently-playing one. */
export function clearManual(state: QueueState): QueueState {
  const { queue, index } = state;
  const currentId = queue[index]?.id;
  const filtered = queue.filter(
    (t, i) => i === index || !t.manuallyQueued,
  );
  const newIndex = currentId
    ? Math.max(0, filtered.findIndex((t) => t.id === currentId))
    : 0;
  return { queue: filtered, index: newIndex };
}
