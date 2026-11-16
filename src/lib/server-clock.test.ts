import { afterEach, describe, expect, it, vi } from "vitest";
import {
  estimateOffsetMs,
  getServerOffsetMs,
  reportServerTime,
  resetServerClockForTests,
  serverNow,
} from "./server-clock";

afterEach(() => {
  resetServerClockForTests();
  vi.useRealTimers();
});

describe("hora do servidor", () => {
  it("ignora diferenças pequenas (relógio local certo)", () => {
    const local = 1_800_000_000_000;
    expect(estimateOffsetMs(local, local, local + 80)).toBe(0);
    expect(estimateOffsetMs(local - 1000, local, local + 80)).toBe(0);
    expect(estimateOffsetMs(local + 1400, local, local + 80)).toBe(0);
  });

  it("mede um relógio local 1 hora atrasado", () => {
    const server = 1_800_000_000_000; // cabeçalho Date, truncado em segundos
    const local = server - 3_660_000; // PC 1 h 01 min atrasado
    const offset = estimateOffsetMs(server, local, local + 120);
    expect(offset).toBeGreaterThan(3_659_000);
    expect(offset).toBeLessThan(3_661_500);
  });

  it("mede um relógio local adiantado", () => {
    const server = 1_800_000_000_000;
    const local = server + 600_000;
    const offset = estimateOffsetMs(server, local, local + 60);
    expect(offset).toBeLessThan(-599_000);
    expect(offset).toBeGreaterThan(-601_000);
  });

  it("devolve 0 para leituras inválidas", () => {
    expect(estimateOffsetMs(NaN, 1, 2)).toBe(0);
    expect(estimateOffsetMs(1, NaN, 2)).toBe(0);
  });

  it("serverNow soma a diferença ao relógio local", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T22:43:00Z")); // relógio local atrasado
    expect(serverNow()).toBe(Date.now());
    reportServerTime(Date.parse("2026-11-13T23:43:50Z"));
    expect(getServerOffsetMs()).toBe(3_650_000);
    expect(new Date(serverNow()).toISOString()).toBe("2026-11-13T23:43:50.000Z");
  });

  it("uma leitura direta próxima do relógio local zera a correção", () => {
    resetServerClockForTests(3_600_000);
    reportServerTime(Date.now() + 900);
    expect(getServerOffsetMs()).toBe(0);
    reportServerTime(NaN);
    expect(getServerOffsetMs()).toBe(0);
  });
});
