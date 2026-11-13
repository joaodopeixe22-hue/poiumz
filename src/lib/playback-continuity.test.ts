import { describe, expect, it } from "vitest";
import { boundedAudioPosition, effectiveEnd, hasPlaybackFinished, nextQueueIndex, playbackInstance } from "./playback-continuity";

const state = { is_playing: true, current_song_id: "a", current_institutional_id: null, started_at: "2026-10-24T22:00:00Z", position_seconds: 0 };
describe("continuidade", () => {
  it("avança somente no fim da duração", () => {
    expect(hasPlaybackFinished(state, 207, Date.parse("2026-10-24T22:03:26Z"))).toBe(false);
    expect(hasPlaybackFinished(state, 207, Date.parse("2026-10-24T22:03:27Z"))).toBe(true);
  });
  it("não avança rádio pausada", () => {
    expect(hasPlaybackFinished({ ...state, is_playing: false }, 207, Date.parse("2026-10-24T23:00:00Z"))).toBe(false);
  });
  it("não avança com duração desconhecida", () => {
    expect(hasPlaybackFinished(state, 0, Date.parse("2026-10-24T23:00:00Z"))).toBe(false);
  });
  it("distingue reinício da mesma música", () => {
    expect(playbackInstance(state)).not.toBe(playbackInstance({ ...state, started_at: "2026-10-24T22:04:00Z" }));
  });
  it("limita posição à duração real", () => {
    expect(boundedAudioPosition(1438, 191)).toBe(191);
    expect(boundedAudioPosition(-1, 191)).toBe(0);
  });
  it("avança na ordem ativa", () => { expect(nextQueueIndex(0, 3, "off")).toBe(1); });
  it("reinicia fila com repetição total", () => { expect(nextQueueIndex(2, 3, "all")).toBe(0); });
  it("para sem repetição", () => { expect(nextQueueIndex(2, 3, "off")).toBeNull(); });
  it("repete a atual no modo uma", () => { expect(nextQueueIndex(1, 3, "one")).toBe(1); });
  it("usa o fim cortado quando existe, senão a duração", () => {
    expect(effectiveEnd({ duracao_segundos: 200, fim_segundos: 187.4 })).toBe(187.4);
    expect(effectiveEnd({ duracao_segundos: 200, fim_segundos: null })).toBe(200);
    expect(effectiveEnd({ duracao_segundos: 200 })).toBe(200);
    expect(effectiveEnd({ duracao_segundos: null, fim_segundos: 0 })).toBe(0);
    expect(effectiveEnd(null)).toBe(0);
  });
});