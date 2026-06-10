import { describe, expect, it } from "vitest";
import {
  appendToQueue,
  clearManual,
  insertAfterCurrent,
  insertAsNext,
  insertMultipleAfterCurrent,
  moveItem,
  removeAt,
  removeById,
  type QueueState,
  type QueueTrack,
} from "@/lib/playback-queue";

const t = (id: string, extra: Partial<QueueTrack> = {}): QueueTrack => ({
  id,
  titulo: `Track ${id}`,
  artista: null,
  duracao_segundos: 100,
  ...extra,
});

const state = (ids: string[], index = 0): QueueState => ({
  queue: ids.map((id) => t(id)),
  index,
});

const ids = (s: QueueState) => s.queue.map((x) => x.id);

describe("playback-queue", () => {
  // TEST 1: Adicionar música de outra playlist
  it("[1] inserts a new track right after the current one", () => {
    const s = state(["A", "B", "C", "D"], 1); // playing B
    const r = insertAfterCurrent(s, t("X"));
    expect(ids(r)).toEqual(["A", "B", "X", "C", "D"]);
    expect(r.index).toBe(1); // still on B
    expect(r.queue[2].manuallyQueued).toBe(true);
  });

  // TEST 2: Tocar em seguida — executada imediatamente após a atual
  it("[2] addNext makes the track the very next one", () => {
    const s = state(["A", "B", "C"], 0); // playing A
    const r = insertAsNext(s, t("X"));
    expect(ids(r)).toEqual(["A", "X", "B", "C"]);
    expect(r.queue[r.index + 1].id).toBe("X");
  });

  // TEST 3: Múltiplas músicas, ordem preservada
  it("[3] inserts multiple tracks preserving their order", () => {
    const s = state(["A", "B", "C", "D"], 1);
    const r = insertMultipleAfterCurrent(s, [t("X"), t("Y"), t("Z")]);
    expect(ids(r)).toEqual(["A", "B", "X", "Y", "Z", "C", "D"]);
    expect(r.queue.slice(2, 5).every((x) => x.manuallyQueued)).toBe(true);
  });

  // TEST 4: Remover da fila não afeta playlist original
  it("[4] removing from the queue does not touch the source list", () => {
    const playlist = ["A", "B", "C", "D"];
    const s = state(playlist, 0);
    const r = removeById(s, "C");
    expect(ids(r)).toEqual(["A", "B", "D"]);
    // source array unchanged
    expect(playlist).toEqual(["A", "B", "C", "D"]);
  });

  // TEST 5: Avanço automático segue a fila modificada
  it("[5] advancing index walks through inserted tracks", () => {
    let s = state(["A", "B", "C", "D"], 1);
    s = insertMultipleAfterCurrent(s, [t("X"), t("Y"), t("Z")]);
    // simulate advance: B -> X -> Y -> Z -> C -> D
    const seq: string[] = [];
    let i = s.index;
    while (i < s.queue.length) {
      seq.push(s.queue[i].id);
      i++;
    }
    expect(seq).toEqual(["B", "X", "Y", "Z", "C", "D"]);
  });

  // TEST 6: Serialização / recuperação (JSON round-trip)
  it("[6] queue state survives JSON serialization", () => {
    const s = state(["A", "B"], 0);
    const s2 = insertAfterCurrent(s, t("X"));
    const round = JSON.parse(JSON.stringify(s2)) as QueueState;
    expect(ids(round)).toEqual(["A", "X", "B"]);
    expect(round.index).toBe(0);
    expect(round.queue[1].manuallyQueued).toBe(true);
  });

  // TEST 9: Fila vazia
  it("[9] inserting into an empty queue starts it cleanly", () => {
    const empty: QueueState = { queue: [], index: 0 };
    const r = insertAfterCurrent(empty, t("X"));
    expect(ids(r)).toEqual(["X"]);
    expect(r.index).toBe(0);
  });

  // TEST 10: Inserção durante reprodução não desloca a faixa atual
  it("[10] insertion never moves the currently-playing track", () => {
    const s = state(["A", "B", "C"], 1);
    const currentId = s.queue[s.index].id;
    const r = insertMultipleAfterCurrent(s, [t("X"), t("Y")]);
    expect(r.queue[r.index].id).toBe(currentId);
  });

  // Extra coverage: removeAt guards
  it("removeAt refuses to remove the currently-playing track", () => {
    const s = state(["A", "B", "C"], 1);
    const r = removeAt(s, 1);
    expect(r).toBe(s); // unchanged reference
  });

  it("removeAt before current decreases index", () => {
    const s = state(["A", "B", "C"], 2);
    const r = removeAt(s, 0);
    expect(ids(r)).toEqual(["B", "C"]);
    expect(r.index).toBe(1);
  });

  // moveItem
  it("moveItem reorders without losing the current track", () => {
    const s = state(["A", "B", "C", "D"], 0);
    const r = moveItem(s, 3, 1); // move D to index 1
    expect(ids(r)).toEqual(["A", "D", "B", "C"]);
    expect(r.queue[r.index].id).toBe("A");
  });

  it("moveItem refuses to move the currently-playing track", () => {
    const s = state(["A", "B", "C"], 1);
    expect(moveItem(s, 1, 2)).toBe(s);
    expect(moveItem(s, 0, 1)).toBe(s); // moving over current is also blocked
  });

  // appendToQueue
  it("appendToQueue tags the track as manual", () => {
    const s = state(["A"], 0);
    const r = appendToQueue(s, t("B"));
    expect(ids(r)).toEqual(["A", "B"]);
    expect(r.queue[1].manuallyQueued).toBe(true);
  });

  // clearManual
  it("clearManual removes only manual entries and keeps current track", () => {
    let s = state(["A", "B", "C"], 1); // playing B (from playlist)
    s = insertMultipleAfterCurrent(s, [t("X"), t("Y")]);
    expect(ids(s)).toEqual(["A", "B", "X", "Y", "C"]);
    const r = clearManual(s);
    expect(ids(r)).toEqual(["A", "B", "C"]);
    expect(r.queue[r.index].id).toBe("B");
  });

  it("clearManual preserves the current track even if it was manual", () => {
    // current is X (manual). It must stay because it's playing now.
    const s: QueueState = {
      queue: [
        t("A"),
        t("X", { manuallyQueued: true }),
        t("Y", { manuallyQueued: true }),
        t("B"),
      ],
      index: 1,
    };
    const r = clearManual(s);
    expect(ids(r)).toEqual(["A", "X", "B"]);
    expect(r.queue[r.index].id).toBe("X");
  });
});
