/**
 * Cadeia de áudio do "Som de loja" (Web Audio):
 *
 *   <audio> → ganho da faixa → equalizador do perfil → compressor → limitador → volume → saída
 *           └→ caminho direto (usado quando o "Som de loja" é desligado) ──────────┘
 *
 * Só é montada quando o navegador já liberou o áudio (contexto "running") e o
 * arquivo foi carregado com CORS. Se qualquer condição falhar, a rádio segue no
 * player simples — sem processamento, mas tocando.
 */
import { dbToGain } from "@/lib/audio-analysis";
import { LIMITER, PRE_LIMITER_DB, type SoundProfile } from "@/lib/sound-profiles";

const SMOOTH = 0.03; // constante de tempo (s) das mudanças de ganho, para não estalar

export type ProcessingControls = {
  setTrackGainDb: (db: number) => void;
  setProfile: (profile: SoundProfile) => void;
  setVolume: (volume: number) => void;
  /** true = som direto, sem nivelamento, equalização nem limitador. */
  setBypass: (bypass: boolean) => void;
};

type GraphContext = BaseAudioContext;

/**
 * Monta os nós de processamento entre `input` e `output`. Separado da criação
 * do contexto para poder ser exercitado em um OfflineAudioContext.
 */
export function buildProcessingGraph(
  ctx: GraphContext,
  input: AudioNode,
  output: AudioNode,
): ProcessingControls {
  const trackGain = ctx.createGain();
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.Q.value = Math.SQRT1_2;
  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = "lowshelf";
  const presence = ctx.createBiquadFilter();
  presence.type = "peaking";
  const highShelf = ctx.createBiquadFilter();
  highShelf.type = "highshelf";
  const compressor = ctx.createDynamicsCompressor();
  const preLimiter = ctx.createGain();
  preLimiter.gain.value = dbToGain(PRE_LIMITER_DB);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = LIMITER.thresholdDb;
  limiter.ratio.value = LIMITER.ratio;
  limiter.knee.value = LIMITER.kneeDb;
  limiter.attack.value = LIMITER.attack;
  limiter.release.value = LIMITER.release;
  const profileOutput = ctx.createGain();
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 0;
  const master = ctx.createGain();

  input.connect(trackGain);
  trackGain.connect(highpass);
  highpass.connect(lowShelf);
  lowShelf.connect(presence);
  presence.connect(highShelf);
  highShelf.connect(compressor);
  compressor.connect(preLimiter);
  preLimiter.connect(limiter);
  limiter.connect(profileOutput);
  profileOutput.connect(wet);
  wet.connect(master);
  input.connect(dry);
  dry.connect(master);
  master.connect(output);

  const ramp = (param: AudioParam, value: number) => {
    try {
      param.cancelScheduledValues(ctx.currentTime);
      param.setTargetAtTime(value, ctx.currentTime, SMOOTH);
    } catch {
      param.value = value;
    }
  };

  return {
    setTrackGainDb: (db) => ramp(trackGain.gain, dbToGain(Number.isFinite(db) ? db : 0)),
    setVolume: (volume) =>
      ramp(master.gain, Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1))),
    setBypass: (bypass) => {
      ramp(wet.gain, bypass ? 0 : 1);
      ramp(dry.gain, bypass ? 1 : 0);
    },
    setProfile: (p) => {
      ramp(highpass.frequency, p.highpassHz);
      ramp(lowShelf.frequency, p.lowShelf.freq);
      ramp(lowShelf.gain, p.lowShelf.gainDb);
      ramp(presence.frequency, p.presence.freq);
      ramp(presence.Q, p.presence.q);
      ramp(presence.gain, p.presence.gainDb);
      ramp(highShelf.frequency, p.highShelf.freq);
      ramp(highShelf.gain, p.highShelf.gainDb);
      ramp(compressor.threshold, p.compressor.thresholdDb);
      ramp(compressor.ratio, p.compressor.ratio);
      ramp(compressor.knee, p.compressor.kneeDb);
      ramp(compressor.attack, p.compressor.attack);
      ramp(compressor.release, p.compressor.release);
      ramp(profileOutput.gain, dbToGain(p.outputDb));
    },
  };
}

export type RadioAudioChain = ProcessingControls & {
  /** Tenta retomar o contexto (após bloqueio do navegador). true = está tocando. */
  resume: () => Promise<boolean>;
  isRunning: () => boolean;
  onStateChange: (listener: (running: boolean) => void) => void;
  destroy: () => void;
};

function resumeWithTimeout(ctx: AudioContext, ms = 400): Promise<void> {
  return Promise.race([
    ctx.resume().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

/**
 * Liga a cadeia ao elemento <audio>. Devolve null (sem alterar o elemento)
 * quando o navegador não tem Web Audio ou ainda não liberou o som.
 *
 * Atenção: depois de ligado, o som do elemento passa SEMPRE pela cadeia; por
 * isso só chame quando o elemento já tocou com `crossOrigin="anonymous"`.
 */
export async function createRadioAudioChain(
  audio: HTMLAudioElement,
): Promise<RadioAudioChain | null> {
  if (typeof window === "undefined") return null;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  let ctx: AudioContext;
  try {
    ctx = new Ctor({ latencyHint: "playback" });
  } catch {
    return null;
  }
  await resumeWithTimeout(ctx);
  if (ctx.state !== "running") {
    void ctx.close().catch(() => undefined);
    return null;
  }

  let controls: ProcessingControls;
  try {
    const source = ctx.createMediaElementSource(audio);
    controls = buildProcessingGraph(ctx, source, ctx.destination);
  } catch {
    void ctx.close().catch(() => undefined);
    return null;
  }

  return {
    ...controls,
    resume: async () => {
      if (ctx.state !== "running") await resumeWithTimeout(ctx);
      return ctx.state === "running";
    },
    isRunning: () => ctx.state === "running",
    onStateChange: (listener) => {
      ctx.onstatechange = () => listener(ctx.state === "running");
    },
    destroy: () => {
      ctx.onstatechange = null;
      void ctx.close().catch(() => undefined);
    },
  };
}
