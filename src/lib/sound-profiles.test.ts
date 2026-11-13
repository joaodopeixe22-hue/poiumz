import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_ID,
  SOUND_PROFILES,
  getProfile,
  readSoundEnabled,
  readStoredProfileId,
  storeProfileId,
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

  it("guarda e lê o perfil do aparelho", () => {
    const store = memoryStore();
    expect(readStoredProfileId(store)).toBe(DEFAULT_PROFILE_ID);
    storeProfileId("caixa-pequena", store);
    expect(readStoredProfileId(store)).toBe("caixa-pequena");
  });

  it("vem ligado e respeita quando o usuário desliga", () => {
    const store = memoryStore();
    expect(readSoundEnabled(store)).toBe(true);
    storeSoundEnabled(false, store);
    expect(readSoundEnabled(store)).toBe(false);
  });

  it("não quebra quando o armazenamento está bloqueado", () => {
    expect(readStoredProfileId(brokenStore)).toBe(DEFAULT_PROFILE_ID);
    expect(readSoundEnabled(brokenStore)).toBe(true);
    expect(() => storeProfileId("loja-vazia", brokenStore)).not.toThrow();
    expect(() => storeSoundEnabled(false, brokenStore)).not.toThrow();
  });
});
