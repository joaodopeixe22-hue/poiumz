import { describe, expect, it } from "vitest";
import {
  analyzeChannels,
  integratedLoudness,
  kWeightingFilters,
  samplePeakDb,
  silenceBounds,
  trackGainDb,
} from "./audio-analysis";

function sine(seconds: number, sampleRate: number, amplitude = 1, freq = 997): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < out.length; i++)
    out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return out;
}
function concat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
const silence = (seconds: number, sampleRate: number) =>
  new Float32Array(Math.round(seconds * sampleRate));

describe("volume percebido (BS.1770)", () => {
  it("reproduz os coeficientes publicados para 48 kHz", () => {
    const [shelf, highpass] = kWeightingFilters(48000);
    expect(shelf.b0).toBeCloseTo(1.53512485958697, 6);
    expect(shelf.b1).toBeCloseTo(-2.69169618940638, 6);
    expect(shelf.b2).toBeCloseTo(1.19839281085285, 6);
    expect(shelf.a1).toBeCloseTo(-1.69065929318241, 6);
    expect(shelf.a2).toBeCloseTo(0.73248077421585, 6);
    expect(highpass.a1).toBeCloseTo(-1.99004745483398, 6);
    expect(highpass.a2).toBeCloseTo(0.99007225036621, 6);
  });

  it("mede −3,01 LUFS para um seno de 997 Hz em fundo de escala num canal", () => {
    expect(integratedLoudness([sine(10, 48000)], 48000)).toBeCloseTo(-3.01, 1);
  });

  it("soma os dois canais: o mesmo seno em estéreo mede 0 LUFS", () => {
    const s = sine(10, 48000);
    expect(integratedLoudness([s, s], 48000)).toBeCloseTo(0, 1);
  });

  it("independe da taxa de amostragem", () => {
    expect(integratedLoudness([sine(10, 44100)], 44100)).toBeCloseTo(-3.01, 1);
    expect(integratedLoudness([sine(10, 22050)], 22050)).toBeCloseTo(-3.01, 1);
  });

  it("acompanha o ganho: metade da amplitude mede 6 dB a menos", () => {
    const full = integratedLoudness([sine(10, 48000)], 48000)!;
    const half = integratedLoudness([sine(10, 48000, 0.5)], 48000)!;
    expect(full - half).toBeCloseTo(6.02, 1);
  });

  it("ignora trechos de silêncio (porta relativa)", () => {
    const alone = integratedLoudness([sine(10, 48000, 0.25)], 48000)!;
    const padded = integratedLoudness([concat(sine(10, 48000, 0.25), silence(10, 48000))], 48000)!;
    // Os blocos da borda (parte som, parte silêncio) passam pela porta, como manda a norma.
    expect(Math.abs(padded - alone)).toBeLessThan(0.15);
  });

  it("devolve null para silêncio ou áudio curto demais", () => {
    expect(integratedLoudness([silence(5, 48000)], 48000)).toBeNull();
    expect(integratedLoudness([sine(0.2, 48000)], 48000)).toBeNull();
    expect(integratedLoudness([], 48000)).toBeNull();
  });
});

describe("pico e silêncio", () => {
  it("mede o pico em dBFS", () => {
    expect(samplePeakDb([sine(1, 48000, 0.5)])).toBeCloseTo(-6.02, 1);
    expect(samplePeakDb([silence(1, 48000)])).toBeNull();
  });

  it("encontra o início e o fim reais do som", () => {
    const sr = 44100;
    const track = concat(silence(2, sr), sine(5, sr, 0.3), silence(3, sr));
    const bounds = silenceBounds([track, track], sr);
    expect(bounds.inicio_segundos).toBeCloseTo(1.97, 1);
    expect(bounds.fim_segundos).toBeCloseTo(7.25, 1);
  });

  it("não corta quando a sobra é pequena", () => {
    const sr = 44100;
    const track = concat(silence(0.1, sr), sine(5, sr, 0.3), silence(0.2, sr));
    expect(silenceBounds([track], sr)).toEqual({ inicio_segundos: null, fim_segundos: null });
  });

  it("não corta trechos suspeitos de tão longos", () => {
    const sr = 22050;
    const track = concat(silence(20, sr), sine(5, sr, 0.3), silence(40, sr));
    expect(silenceBounds([track], sr)).toEqual({ inicio_segundos: null, fim_segundos: null });
  });

  it("trata ruído de fundo baixo como silêncio", () => {
    const sr = 44100;
    const hiss = new Float32Array(sr * 2);
    for (let i = 0; i < hiss.length; i++) hiss[i] = 0.0005 * Math.sin(i * 1.7); // ≈ −69 dBFS
    const track = concat(hiss, sine(5, sr, 0.3), hiss);
    const bounds = silenceBounds([track], sr);
    expect(bounds.inicio_segundos).toBeCloseTo(1.97, 1);
    expect(bounds.fim_segundos).toBeCloseTo(7.25, 1);
  });

  it("faz a análise completa e arredonda", () => {
    const sr = 44100;
    const track = concat(silence(1, sr), sine(6, sr, 0.5), silence(1, sr));
    const a = analyzeChannels([track, track], sr);
    expect(Math.abs(a.loudness_lufs! - -6.02)).toBeLessThan(0.3);
    expect(a.pico_db).toBeCloseTo(-6.02, 1);
    expect(a.inicio_segundos).toBeCloseTo(0.97, 1);
    expect(a.fim_segundos).toBeCloseTo(7.25, 1);
    expect(analyzeChannels([], sr)).toEqual({
      loudness_lufs: null,
      pico_db: null,
      inicio_segundos: null,
      fim_segundos: null,
    });
  });
});

describe("ganho por faixa", () => {
  it("abaixa faixa alta e levanta faixa baixa até o alvo", () => {
    expect(trackGainDb({ loudness_lufs: -8, pico_db: 0 })).toBe(-6);
    expect(trackGainDb({ loudness_lufs: -19, pico_db: -9 })).toBe(5);
  });
  it("limita o reforço pelo pico para não distorcer", () => {
    expect(trackGainDb({ loudness_lufs: -22, pico_db: -1 })).toBe(3);
    expect(trackGainDb({ loudness_lufs: -30, pico_db: -20 })).toBe(8);
  });
  it("limita o corte e deixa em 0 dB a faixa sem análise", () => {
    expect(trackGainDb({ loudness_lufs: 5, pico_db: 0 })).toBe(-14);
    expect(trackGainDb({ loudness_lufs: null, pico_db: null })).toBe(0);
    expect(trackGainDb(null)).toBe(0);
    expect(trackGainDb({})).toBe(0);
  });
});
