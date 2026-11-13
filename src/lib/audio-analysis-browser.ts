/**
 * Ponte entre o navegador e a análise pura: decodifica o arquivo e mede.
 * Uma decodificação por vez — uma música de 4 min ocupa ~90 MB já decodificada.
 */
import { analyzeChannels, type AudioAnalysis } from "@/lib/audio-analysis";

/** Acima disso não analisamos (memória): a faixa toca normalmente, sem nivelamento. */
export const MAX_ANALYSIS_BYTES = 80 * 1024 * 1024;

export type FileAnalysis = AudioAnalysis & { duracao_segundos: number | null };

let queue: Promise<unknown> = Promise.resolve();

function decode(buffer: ArrayBuffer): Promise<AudioBuffer> {
  const Ctor: typeof OfflineAudioContext | undefined =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!Ctor) return Promise.reject(new Error("Navegador sem suporte a análise de áudio."));
  const ctx = new Ctor(2, 1, 44100);
  // Forma com callbacks: funciona também em Safari antigos.
  return new Promise((resolve, reject) => {
    const maybe = ctx.decodeAudioData(buffer, resolve, reject) as Promise<AudioBuffer> | undefined;
    maybe?.catch?.(reject);
  });
}

async function analyzeNow(source: Blob | ArrayBuffer): Promise<FileAnalysis> {
  const size = source instanceof ArrayBuffer ? source.byteLength : source.size;
  if (size > MAX_ANALYSIS_BYTES) throw new Error("Arquivo grande demais para analisar.");
  const buffer = source instanceof ArrayBuffer ? source : await source.arrayBuffer();
  const decoded = await decode(buffer);
  const channels: Float32Array[] = [];
  for (let c = 0; c < Math.min(2, decoded.numberOfChannels); c++)
    channels.push(decoded.getChannelData(c));
  // Cede a vez à interface antes do cálculo pesado.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const analysis = analyzeChannels(channels, decoded.sampleRate);
  return {
    ...analysis,
    duracao_segundos:
      Number.isFinite(decoded.duration) && decoded.duration > 0 ? decoded.duration : null,
  };
}

/** Analisa um arquivo de áudio. Rejeita se não for possível decodificar. */
export function analyzeAudio(source: Blob | ArrayBuffer): Promise<FileAnalysis> {
  const run = queue.then(
    () => analyzeNow(source),
    () => analyzeNow(source),
  );
  queue = run.catch(() => undefined);
  return run;
}

/** Igual a `analyzeAudio`, mas nunca rejeita: devolve null quando não dá para analisar. */
export async function tryAnalyzeAudio(source: Blob | ArrayBuffer): Promise<FileAnalysis | null> {
  try {
    return await analyzeAudio(source);
  } catch (error) {
    console.warn("[som-de-loja] Análise de áudio falhou", error);
    return null;
  }
}

/** Colunas a gravar no banco a partir de uma análise (ou da ausência dela). */
export function analysisColumns(analysis: FileAnalysis | null) {
  return {
    loudness_lufs: analysis?.loudness_lufs ?? null,
    pico_db: analysis?.pico_db ?? null,
    inicio_segundos: analysis?.inicio_segundos ?? null,
    fim_segundos: analysis?.fim_segundos ?? null,
    analisado_em: new Date().toISOString(),
  };
}
