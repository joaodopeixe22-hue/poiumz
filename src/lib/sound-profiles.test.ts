import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_ID,
  SOUND_PROFILES,
  getProfile,
  readSoundEnabled,
  FOLLOW_RADIO,
  clampVolume,
  readDeviceProfileChoice,
  resolveProfileId,
  storeDeviceProfileChoice,
  storeSoundEnabled,
} from "./sound-profiles";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}
const brokenStore = {
  getItem: () => {
    throw new Error("bloqueado");
  },
  setItem: () => {
    throw new Error("bloqueado");
  },
};

describe("perfis de ambiente", () => {
  it("tem ids únicos e valores dentro de faixas seguras", () => {
    expect(new Set(SOUND_PROFILES.map((p) => p.id)).size).toBe(SOUND_PROFILES.length);
    for (const p of SOUND_PROFILES) {
      expect(p.highpassHz).toBeGreaterThanOrEqual(20);
      expect(p.highpassHz).toBeLessThanOrEqual(150);
      for (const g of [p.lowShelf.gainDb, p.presence.gainDb, p.highShelf.gainDb]) {
        expect(Math.abs(g)).toBeLessThanOrEqual(4);
      }
      expect(p.compressor.ratio).toBeGreaterThanOrEqual(1);
      expect(p.compressor.ratio).toBeLessThanOrEqual(4);
      expect(p.outputDb).toBeLessThanOrEqual(2);
    }
  });

  it("cai no perfil padrão para id desconhecido", () => {
    expect(getProfile("nao-existe").id).toBe(DEFAULT_PROFILE_ID);
    expect(getProfile(null).id).toBe(DEFAULT_PROFILE_ID);
    expect(getProfile("loja-cheia").nome).toBe("Loja cheia");
  });

  it("o aparelho segue a rádio até fixar um perfil próprio", () => {
    const store = memoryStore();
    expect(readDeviceProfileChoice(store)).toBe(FOLLOW_RADIO);
    expect(resolveProfileId(readDeviceProfileChoice(store), "loja-cheia")).toBe("loja-cheia");
    storeDeviceProfileChoice("caixa-pequena", store);
    expect(readDeviceProfileChoice(store)).toBe("caixa-pequena");
    expect(resolveProfileId(readDeviceProfileChoice(store), "loja-cheia")).toBe("caixa-pequena");
    storeDeviceProfileChoice(FOLLOW_RADIO, store);
    expect(resolveProfileId(readDeviceProfileChoice(store), "loja-vazia")).toBe("loja-vazia");
  });

  it("perfil da rádio desconhecido ou ausente vira o padrão", () => {
    expect(resolveProfileId(FOLLOW_RADIO, "inventado")).toBe(DEFAULT_PROFILE_ID);
    expect(resolveProfileId(FOLLOW_RADIO, null)).toBe(DEFAULT_PROFILE_ID);
    expect(resolveProfileId(FOLLOW_RADIO, undefined)).toBe(DEFAULT_PROFILE_ID);
  });

  it("limita o volume entre 0 e 1", () => {
    expect(clampVolume(0.35)).toBe(0.35);
    expect(clampVolume(1.7)).toBe(1);
    expect(clampVolume(-2)).toBe(0);
    expect(clampVolume("0.5")).toBe(0.5);
    expect(clampVolume(null)).toBe(0.8);
    expect(clampVolume(undefined, 0.6)).toBe(0.6);
    expect(clampVolume(NaN)).toBe(0.8);
    expect(clampVolume("")).toBe(0.8);
  });

  it("vem ligado e respeita quando o usuário desliga", () => {
    const store = memoryStore();
    expect(readSoundEnabled(store)).toBe(true);
    storeSoundEnabled(false, store);
    expect(readSoundEnabled(store)).toBe(false);
  });

  it("não quebra quando o armazenamento está bloqueado", () => {
    expect(readDeviceProfileChoice(brokenStore)).toBe(FOLLOW_RADIO);
    expect(readSoundEnabled(brokenStore)).toBe(true);
    expect(() => storeDeviceProfileChoice("loja-vazia", brokenStore)).not.toThrow();
    expect(() => storeSoundEnabled(false, brokenStore)).not.toThrow();
  });
});
