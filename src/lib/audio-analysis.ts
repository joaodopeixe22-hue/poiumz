/**
 * Análise de áudio do "Som de loja" — funções puras, sem dependência do navegador.
 *
 * - Volume percebido (LUFS integrado) conforme ITU-R BS.1770-4.
 * - Pico de amostra em dBFS.
 * - Limites de silêncio no início e no fim da faixa.
 *
 * Tudo roda sobre os canais já decodificados (Float32Array por canal).
 */

export type AudioAnalysis = {
  /** Volume percebido da faixa inteira, em LUFS. null = faixa silenciosa ou curta demais. */
  loudness_lufs: number | null;
  /** Maior pico de amostra, em dBFS (0 = fundo de escala). */
  pico_db: number | null;
  /** Segundo em que o som realmente começa. null = começa no zero. */
  inicio_segundos: number | null;
  /** Segundo em que o som realmente termina. null = vai até o fim do arquivo. */
  fim_segundos: number | null;
};

export type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

/** Volume-alvo da rádio. −14 LUFS é o padrão usado por serviços de streaming. */
export const TARGET_LUFS = -14;

const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = -10;
const BLOCK_SECONDS = 0.4;
const STEP_SECONDS = 0.1;

const START_SILENCE_DB = -50;
const END_SILENCE_DB = -45;
const SILENCE_WINDOW_SECONDS = 0.01;
const START_PREROLL_SECONDS = 0.03;
const END_TAIL_SECONDS = 0.25;
const MIN_START_TRIM_SECONDS = 0.25;
const MIN_END_TRIM_SECONDS = 0.4;
const MAX_START_TRIM_SECONDS = 15;
const MAX_END_TRIM_SECONDS = 30;

/**
 * Filtros de ponderação K (pré-filtro "shelf" + passa-altas RLB) para qualquer
 * taxa de amostragem. Em 48 kHz reproduz os coeficientes publicados na BS.1770.
 */
export function kWeightingFilters(sampleRate: number): [Biquad, Biquad] {
  // Estágio 1: shelving de agudos (resposta acústica da cabeça).
  const f0 = 1681.974450955533;
  const G = 3.999843853973347;
  const Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / sampleRate);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  // Estágio 2: passa-altas (curva RLB).
  const f1 = 38.13547087602444;
  const Q1 = 0.5003270373238773;
  K = Math.tan((Math.PI * f1) / sampleRate);
  a0 = 1 + K / Q1 + K * K;
  const highpass: Biquad = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q1 + K * K) / a0,
  };
  return [shelf, highpass];
}

/**
 * Energia média (ponderada em K) de cada janela de 100 ms de um canal.
 * Devolve a soma dos quadrados por janela; a última janela incompleta é descartada.
 */
function steppedEnergy(channel: Float32Array, sampleRate: number, stepSize: number): Float64Array {
  const [s, h] = kWeightingFilters(sampleRate);
  const steps = Math.floor(channel.length / stepSize);
  const out = new Float64Array(steps);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0; // estado do shelf
  let u1 = 0,
    u2 = 0,
    v1 = 0,
    v2 = 0; // estado do passa-altas
  let i = 0;
  for (let step = 0; step < steps; step++) {
    let sum = 0;
    const end = i + stepSize;
    for (; i < end; i++) {
      const x = channel[i];
      const y = s.b0 * x + s.b1 * x1 + s.b2 * x2 - s.a1 * y1 - s.a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      const v = h.b0 * y + h.b1 * u1 + h.b2 * u2 - h.a1 * v1 - h.a2 * v2;
      u2 = u1;
      u1 = y;
      v2 = v1;
      v1 = v;
      sum += v * v;
    }
    out[step] = sum;
  }
  return out;
}

const lufs = (meanSquare: number) => -0.691 + 10 * Math.log10(meanSquare);

/**
 * Volume percebido integrado (LUFS) com as duas portas da BS.1770:
 * absoluta (−70 LUFS) e relativa (−10 LU abaixo da média).
 * Usa no máximo os dois primeiros canais (mono ou estéreo), ambos com peso 1.
 */
export function integratedLoudness(channels: Float32Array[], sampleRate: number): number | null {
  const used = channels.slice(0, 2).filter((c) => c && c.length > 0);
  if (used.length === 0 || !(sampleRate > 0)) return null;
  const stepSize = Math.round(sampleRate * STEP_SECONDS);
  const stepsPerBlock = Math.round(BLOCK_SECONDS / STEP_SECONDS);
  const perChannel = used.map((c) => steppedEnergy(c, sampleRate, stepSize));
  const steps = Math.min(...perChannel.map((e) => e.length));
  const blocks = steps - stepsPerBlock + 1;
  if (blocks <= 0) return null;

  const blockSamples = stepSize * stepsPerBlock;
  const power = new Float64Array(blocks); // soma, entre canais, da média quadrática do bloco
  for (let b = 0; b < blocks; b++) {
    let z = 0;
    for (const energy of perChannel) {
      let sum = 0;
      for (let k = 0; k < stepsPerBlock; k++) sum += energy[b + k];
      z += sum / blockSamples;
    }
    power[b] = z;
  }

  const absoluteGate = Math.pow(10, (ABSOLUTE_GATE_LUFS + 0.691) / 10);
  let sum = 0;
  let count = 0;
  for (let b = 0; b < blocks; b++) {
    if (power[b] > absoluteGate) {
      sum += power[b];
      count++;
    }
  }
  if (count === 0) return null;
  const relativeGate = (sum / count) * Math.pow(10, RELATIVE_GATE_LU / 10);
  sum = 0;
  count = 0;
  for (let b = 0; b < blocks; b++) {
    if (power[b] > absoluteGate && power[b] > relativeGate) {
      sum += power[b];
      count++;
    }
  }
  if (count === 0) return null;
  return lufs(sum / count);
}

/** Maior pico de amostra entre os canais, em dBFS. null = silêncio total. */
export function samplePeakDb(channels: Float32Array[]): number | null {
  let peak = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const a = Math.abs(channel[i]);
      if (a > peak) peak = a;
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : null;
}

/**
 * Acha onde o som começa e termina, olhando a energia em janelas de 10 ms.
 * Cortes pequenos demais são ignorados; cortes grandes demais são tratados como
 * suspeitos (faixa escondida, vinheta falada) e também ignorados.
 */
export function silenceBounds(
  channels: Float32Array[],
  sampleRate: number,
): { inicio_segundos: number | null; fim_segundos: number | null } {
  const none = { inicio_segundos: null, fim_segundos: null };
  const length = Math.min(...channels.map((c) => c.length));
  if (!Number.isFinite(length) || length <= 0 || !(sampleRate > 0)) return none;
  const duration = length / sampleRate;
  const window = Math.max(1, Math.round(sampleRate * SILENCE_WINDOW_SECONDS));
  const windows = Math.floor(length / window);
  if (windows < 2) return none;

  const loudest = (w: number): number => {
    let best = 0;
    for (const channel of channels) {
      let sum = 0;
      const start = w * window;
      for (let i = start; i < start + window; i++) sum += channel[i] * channel[i];
      const ms = sum / window;
      if (ms > best) best = ms;
    }
    return best;
  };
  const startGate = Math.pow(10, START_SILENCE_DB / 10);
  const endGate = Math.pow(10, END_SILENCE_DB / 10);

  let first = -1;
  for (let w = 0; w < windows; w++) {
    if (loudest(w) > startGate) {
      first = w;
      break;
    }
  }
  if (first < 0) return none; // faixa inteira em silêncio
  let last = first;
  for (let w = windows - 1; w >= first; w--) {
    if (loudest(w) > endGate) {
      last = w;
      break;
    }
  }

  const start = Math.max(0, (first * window) / sampleRate - START_PREROLL_SECONDS);
  const end = Math.min(duration, ((last + 1) * window) / sampleRate + END_TAIL_SECONDS);
  const round = (n: number) => Math.round(n * 100) / 100;
  const startTrim = start;
  const endTrim = duration - end;
  return {
    inicio_segundos:
      startTrim >= MIN_START_TRIM_SECONDS && startTrim <= MAX_START_TRIM_SECONDS
        ? round(start)
        : null,
    fim_segundos:
      endTrim >= MIN_END_TRIM_SECONDS && endTrim <= MAX_END_TRIM_SECONDS ? round(end) : null,
  };
}

/** Análise completa de uma faixa já decodificada. */
export function analyzeChannels(channels: Float32Array[], sampleRate: number): AudioAnalysis {
  const used = channels.slice(0, 2).filter((c) => c && c.length > 0);
  if (used.length === 0) {
    return { loudness_lufs: null, pico_db: null, inicio_segundos: null, fim_segundos: null };
  }
  const loudness = integratedLoudness(used, sampleRate);
  const peak = samplePeakDb(used);
  const round = (n: number | null) =>
    n === null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100;
  return {
    loudness_lufs: round(loudness),
    pico_db: round(peak),
    ...silenceBounds(used, sampleRate),
  };
}

const MAX_BOOST_DB = 8;
const MAX_CUT_DB = -14;
/** Quanto o ganho pode empurrar o pico acima de −1 dBFS; o limitador do player segura o resto. */
const LIMITER_HEADROOM_DB = 3;

/**
 * Ganho (em dB) que leva a faixa ao volume-alvo. Faixa sem análise fica em 0 dB.
 * O reforço é limitado pelo pico da faixa para não distorcer.
 */
export function trackGainDb(
  analysis: { loudness_lufs?: number | null; pico_db?: number | null } | null | undefined,
  target: number = TARGET_LUFS,
): number {
  const loudness = Number(analysis?.loudness_lufs);
  if (analysis?.loudness_lufs == null || !Number.isFinite(loudness)) return 0;
  let gain = target - loudness;
  const peak = Number(analysis?.pico_db);
  if (analysis?.pico_db != null && Number.isFinite(peak)) {
    gain = Math.min(gain, -1 - peak + LIMITER_HEADROOM_DB);
  }
  gain = Math.max(MAX_CUT_DB, Math.min(MAX_BOOST_DB, gain));
  return Math.round(gain * 10) / 10;
}

export const dbToGain = (db: number) => Math.pow(10, db / 20);
