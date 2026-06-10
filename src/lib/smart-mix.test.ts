import { describe, it, expect } from "vitest";
import {
  shouldCrossfade,
  normalizeSettings,
  equalPowerGains,
  DEFAULT_SMART_MIX,
} from "./smart-mix";

describe("smart-mix.shouldCrossfade", () => {
  const enabled = { enabled: true, durationSec: 4 };
  const disabled = { enabled: false, durationSec: 4 };

  it("music → music crossfades when enabled", () => {
    expect(shouldCrossfade("music", "music", enabled)).toBe(true);
  });

  it("music → jingle does NOT crossfade", () => {
    expect(shouldCrossfade("music", "jingle", enabled)).toBe(false);
  });

  it("jingle → music does NOT crossfade", () => {
    expect(shouldCrossfade("jingle", "music", enabled)).toBe(false);
  });

  it("jingle → jingle does NOT crossfade", () => {
    expect(shouldCrossfade("jingle", "jingle", enabled)).toBe(false);
  });

  it("music → promo does NOT crossfade", () => {
    expect(shouldCrossfade("music", "promo", enabled)).toBe(false);
  });

  it("promo → music does NOT crossfade", () => {
    expect(shouldCrossfade("promo", "music", enabled)).toBe(false);
  });

  it("never crossfades when disabled", () => {
    expect(shouldCrossfade("music", "music", disabled)).toBe(false);
  });

  it("undefined kinds default to music (crossfade)", () => {
    expect(shouldCrossfade(undefined, undefined, enabled)).toBe(true);
  });

  it("manually-queued next forces hard cut", () => {
    expect(
      shouldCrossfade("music", "music", enabled, { nextIsManual: true }),
    ).toBe(false);
  });

  it("zero duration disables crossfade", () => {
    expect(shouldCrossfade("music", "music", { enabled: true, durationSec: 0 })).toBe(
      false,
    );
  });
});

describe("smart-mix.normalizeSettings", () => {
  it("clamps duration to [1,12]", () => {
    expect(normalizeSettings({ enabled: true, durationSec: 0 }).durationSec).toBe(1);
    expect(normalizeSettings({ enabled: true, durationSec: 99 }).durationSec).toBe(12);
    expect(normalizeSettings({ enabled: true, durationSec: 3.6 }).durationSec).toBe(4);
  });

  it("falls back to defaults on missing fields", () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SMART_MIX);
  });
});

describe("smart-mix.equalPowerGains", () => {
  it("starts with full out, zero in", () => {
    const g = equalPowerGains(0);
    expect(g.out).toBeCloseTo(1);
    expect(g.in).toBeCloseTo(0);
  });
  it("ends with zero out, full in", () => {
    const g = equalPowerGains(1);
    expect(g.out).toBeCloseTo(0);
    expect(g.in).toBeCloseTo(1);
  });
  it("constant power at midpoint (~sqrt(2)/2 each)", () => {
    const g = equalPowerGains(0.5);
    expect(g.out).toBeCloseTo(Math.SQRT1_2, 3);
    expect(g.in).toBeCloseTo(Math.SQRT1_2, 3);
    expect(g.out ** 2 + g.in ** 2).toBeCloseTo(1);
  });
});
