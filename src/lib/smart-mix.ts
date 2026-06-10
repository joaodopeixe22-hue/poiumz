// Smart Mix — pure logic + settings storage.
// No DOM here, safe to unit-test.

export type TrackKind = "music" | "jingle" | "promo";

export type SmartMixSettings = {
  enabled: boolean;
  /** Crossfade duration in seconds. Clamped to [1, 12]. */
  durationSec: number;
};

export const DEFAULT_SMART_MIX: SmartMixSettings = {
  enabled: true,
  durationSec: 4,
};

const STORAGE_KEY = "global-player-smartmix";

export function loadSmartMixSettings(): SmartMixSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SMART_MIX };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SMART_MIX };
    const parsed = JSON.parse(raw) as Partial<SmartMixSettings>;
    return normalizeSettings(parsed);
  } catch {
    return { ...DEFAULT_SMART_MIX };
  }
}

export function saveSmartMixSettings(s: SmartMixSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(s)));
  } catch {
    /* quota — ignore */
  }
}

export function normalizeSettings(s: Partial<SmartMixSettings>): SmartMixSettings {
  const enabled = typeof s.enabled === "boolean" ? s.enabled : DEFAULT_SMART_MIX.enabled;
  const raw = typeof s.durationSec === "number" && Number.isFinite(s.durationSec)
    ? s.durationSec
    : DEFAULT_SMART_MIX.durationSec;
  const durationSec = Math.max(1, Math.min(12, Math.round(raw)));
  return { enabled, durationSec };
}

/**
 * Smart Mix rule:
 *   - music → music  : crossfade
 *   - everything else: hard cut (no fade)
 *
 * Tracks that were inserted manually into the queue (e.g. a jingle played
 * "on demand") also force a hard cut, even if both sides are music.
 */
export function shouldCrossfade(
  prevKind: TrackKind | undefined,
  nextKind: TrackKind | undefined,
  settings: SmartMixSettings,
  opts?: { nextIsManual?: boolean },
): boolean {
  if (!settings.enabled) return false;
  if (settings.durationSec <= 0) return false;
  const a = prevKind ?? "music";
  const b = nextKind ?? "music";
  if (a !== "music" || b !== "music") return false;
  if (opts?.nextIsManual) return false;
  return true;
}

/** Equal-power crossfade gains at progress t in [0..1]. */
export function equalPowerGains(t: number): { out: number; in: number } {
  const x = Math.max(0, Math.min(1, t));
  return {
    out: Math.cos((x * Math.PI) / 2),
    in: Math.sin((x * Math.PI) / 2),
  };
}
