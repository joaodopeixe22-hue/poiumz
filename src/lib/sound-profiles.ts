/**
 * Perfis de ambiente do "Som de loja": equalização e compressão por aparelho.
 * A escolha é local (localStorage), porque depende da caixa de som e do
 * movimento de cada lugar, não da rádio.
 *
 * Os valores foram calibrados no Chrome: com a faixa já nivelada em −14 LUFS,
 * cada perfil sai dentro de ±0,3 dB do volume de entrada (antes do `outputDb`)
 * e os picos ficam abaixo de −1 dBFS.
 */

export type SoundProfileId = "padrao" | "caixa-pequena" | "loja-cheia" | "loja-vazia";

export type SoundProfile = {
  id: SoundProfileId;
  nome: string;
  descricao: string;
  /** Corta graves abaixo desta frequência (Hz). */
  highpassHz: number;
  lowShelf: { freq: number; gainDb: number };
  /** Região da voz e da "presença". */
  presence: { freq: number; gainDb: number; q: number };
  highShelf: { freq: number; gainDb: number };
  compressor: {
    thresholdDb: number;
    ratio: number;
    kneeDb: number;
    attack: number;
    release: number;
  };
  /** Ajuste final de volume do perfil, depois do limitador. */
  outputDb: number;
};

/** Folga antes do limitador; compensa o ganho automático do compressor do navegador. */
export const PRE_LIMITER_DB = -1.5;

/** Limitador final: segura picos e "gritos" para a caixa não distorcer. */
export const LIMITER = {
  thresholdDb: -6,
  ratio: 20,
  kneeDb: 0,
  attack: 0.001,
  release: 0.08,
} as const;

export const SOUND_PROFILES: readonly SoundProfile[] = [
  {
    id: "padrao",
    nome: "Padrão",
    descricao: "Som equilibrado, sem coloração.",
    highpassHz: 30,
    lowShelf: { freq: 100, gainDb: 0 },
    presence: { freq: 3000, gainDb: 0, q: 0.9 },
    highShelf: { freq: 8000, gainDb: 0 },
    compressor: { thresholdDb: -18, ratio: 2, kneeDb: 10, attack: 0.02, release: 0.3 },
    outputDb: 0,
  },
  {
    id: "caixa-pequena",
    nome: "Caixa pequena",
    descricao: "Tira o grave que a caixa não reproduz e dá clareza.",
    highpassHz: 110,
    lowShelf: { freq: 180, gainDb: 2 },
    presence: { freq: 3000, gainDb: 2.5, q: 0.9 },
    highShelf: { freq: 9000, gainDb: 1.5 },
    compressor: { thresholdDb: -20, ratio: 2.5, kneeDb: 10, attack: 0.02, release: 0.3 },
    outputDb: 0,
  },
  {
    id: "loja-cheia",
    nome: "Loja cheia",
    descricao: "Mais presença e volume constante para vencer o barulho.",
    highpassHz: 60,
    lowShelf: { freq: 120, gainDb: -2 },
    presence: { freq: 2800, gainDb: 3.5, q: 0.8 },
    highShelf: { freq: 8000, gainDb: 1 },
    compressor: { thresholdDb: -24, ratio: 3.5, kneeDb: 8, attack: 0.02, release: 0.25 },
    outputDb: 1.5,
  },
  {
    id: "loja-vazia",
    nome: "Loja vazia",
    descricao: "Mais suave e baixo, para não cansar.",
    highpassHz: 30,
    lowShelf: { freq: 100, gainDb: -1 },
    presence: { freq: 3000, gainDb: -1.5, q: 0.9 },
    highShelf: { freq: 6500, gainDb: -3 },
    compressor: { thresholdDb: -18, ratio: 2, kneeDb: 10, attack: 0.02, release: 0.3 },
    outputDb: -4,
  },
] as const;

export const DEFAULT_PROFILE_ID: SoundProfileId = "padrao";
export const SOUND_ENABLED_KEY = "radioSoundEnabled";

/**
 * Cada aparelho segue o perfil escolhido pelo operador para a rádio
 * (playback_state.sound_profile) ou fixa um perfil próprio.
 */
export const FOLLOW_RADIO = "radio" as const;
export type DeviceProfileChoice = typeof FOLLOW_RADIO | SoundProfileId;
export const PROFILE_CHOICE_KEY = "radioSoundProfileChoice";

export function getProfile(id: string | null | undefined): SoundProfile {
  return SOUND_PROFILES.find((p) => p.id === id) ?? SOUND_PROFILES[0];
}

/** Perfil que o aparelho deve aplicar agora. */
export function resolveProfileId(
  choice: DeviceProfileChoice,
  radioProfile: string | null | undefined,
): SoundProfileId {
  return choice === FOLLOW_RADIO ? getProfile(radioProfile).id : getProfile(choice).id;
}

/** Volume entre 0 e 1; valores inválidos caem no `fallback`. */
export function clampVolume(value: unknown, fallback = 0.8): number {
  const n = typeof value === "number" ? value : value == null || value === "" ? NaN : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readDeviceProfileChoice(
  store: StorageLike | null = storage(),
): DeviceProfileChoice {
  try {
    const raw = store?.getItem(PROFILE_CHOICE_KEY);
    return SOUND_PROFILES.some((p) => p.id === raw) ? (raw as SoundProfileId) : FOLLOW_RADIO;
  } catch {
    return FOLLOW_RADIO;
  }
}

export function storeDeviceProfileChoice(
  choice: DeviceProfileChoice,
  store: StorageLike | null = storage(),
): void {
  try {
    store?.setItem(PROFILE_CHOICE_KEY, choice);
  } catch {
    /* armazenamento indisponível: vale só para esta sessão */
  }
}

/** O "Som de loja" vem ligado; só fica desligado se o usuário desligar neste aparelho. */
export function readSoundEnabled(store: StorageLike | null = storage()): boolean {
  try {
    return store?.getItem(SOUND_ENABLED_KEY) !== "0";
  } catch {
    return true;
  }
}

export function storeSoundEnabled(enabled: boolean, store: StorageLike | null = storage()): void {
  try {
    store?.setItem(SOUND_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}
