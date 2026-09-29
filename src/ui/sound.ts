/**
 * Sound effects, made on the fly with the Web Audio API (no audio files), in
 * keeping with the minimal art style. Phones only allow sound after the player
 * touches the screen, so the audio starts on the first touch (unlockAudio).
 */
export type Sfx =
  | 'tap'
  | 'select'
  | 'deny'
  | 'card'
  | 'hit'
  | 'hurt'
  | 'block'
  | 'element'
  | 'brew'
  | 'enemyBrew'
  | 'weather'
  | 'thunder'
  | 'burn'
  | 'heal'
  | 'steal'
  | 'coin'
  | 'endTurn'
  | 'victory'
  | 'defeat';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

/** Starts (or resumes) audio; call from a touch or click handler. */
export function unlockAudio(): void {
  if (!ctx) {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    ctx = new Context();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  /** Seconds after now. */
  delay?: number;
  /** Glide to this frequency by the end. */
  slideTo?: number;
}

function tone(freq: number, duration: number, options: ToneOptions = {}): void {
  if (!ctx || !master) return;
  const start = ctx.currentTime + (options.delay ?? 0);
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = options.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, start);
  if (options.slideTo) osc.frequency.exponentialRampToValueAtTime(options.slideTo, start + duration);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(options.gain ?? 0.3, start + Math.min(0.01, duration / 4));
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env).connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

interface NoiseOptions {
  gain?: number;
  delay?: number;
  filter?: BiquadFilterType;
  freq?: number;
  /** Sweep the filter to this frequency by the end. */
  sweepTo?: number;
  q?: number;
}

function noise(duration: number, options: NoiseOptions = {}): void {
  if (!ctx || !master) return;
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const start = ctx.currentTime + (options.delay ?? 0);
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = options.filter ?? 'lowpass';
  filter.frequency.setValueAtTime(options.freq ?? 1000, start);
  if (options.sweepTo) filter.frequency.exponentialRampToValueAtTime(options.sweepTo, start + duration);
  filter.Q.value = options.q ?? 1;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(options.gain ?? 0.3, start + Math.min(0.02, duration / 4));
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(env).connect(master);
  source.start(start);
  source.stop(start + duration + 0.02);
}

/** Plays a sound effect, optionally a little later (to space out a burst of events). */
export function playSfx(name: Sfx, delay = 0): void {
  if (!enabled || !ctx) return;
  const d = delay;
  switch (name) {
    case 'tap':
      tone(620, 0.05, { type: 'triangle', gain: 0.12, delay: d });
      break;
    case 'select':
      tone(900, 0.04, { type: 'triangle', gain: 0.08, delay: d });
      break;
    case 'deny':
      tone(190, 0.07, { type: 'square', gain: 0.08, delay: d });
      tone(150, 0.1, { type: 'square', gain: 0.08, delay: d + 0.08 });
      break;
    case 'card':
      noise(0.14, { filter: 'bandpass', freq: 2200, sweepTo: 700, q: 1.2, gain: 0.25, delay: d });
      break;
    case 'hit':
      tone(150, 0.14, { slideTo: 60, gain: 0.45, delay: d });
      noise(0.08, { freq: 1200, gain: 0.3, delay: d });
      break;
    case 'hurt':
      tone(110, 0.22, { type: 'square', slideTo: 45, gain: 0.2, delay: d });
      noise(0.16, { freq: 700, gain: 0.35, delay: d });
      break;
    case 'block':
      tone(880, 0.09, { type: 'triangle', gain: 0.18, delay: d });
      tone(1320, 0.07, { type: 'triangle', gain: 0.1, delay: d + 0.015 });
      break;
    case 'element':
      tone(1150, 0.09, { slideTo: 520, gain: 0.2, delay: d });
      break;
    case 'brew':
    case 'enemyBrew': {
      const base = name === 'brew' ? 380 : 220;
      for (let i = 0; i < 4; i++) tone(base + i * 90 + Math.random() * 60, 0.07, { gain: 0.18, delay: d + i * 0.06 });
      break;
    }
    case 'weather':
      noise(0.7, { filter: 'bandpass', freq: 300, sweepTo: 1600, q: 0.8, gain: 0.18, delay: d });
      break;
    case 'thunder':
      noise(0.06, { filter: 'highpass', freq: 2500, gain: 0.35, delay: d });
      noise(1.1, { freq: 260, sweepTo: 80, gain: 0.55, delay: d + 0.03 });
      break;
    case 'burn':
      for (let i = 0; i < 3; i++) noise(0.04, { filter: 'highpass', freq: 3000, gain: 0.12, delay: d + i * 0.05 });
      break;
    case 'heal':
      [523, 659, 784].forEach((f, i) => tone(f, 0.16, { gain: 0.14, delay: d + i * 0.07 }));
      break;
    case 'steal':
      tone(700, 0.18, { type: 'triangle', slideTo: 250, gain: 0.18, delay: d });
      break;
    case 'coin':
      tone(988, 0.07, { type: 'square', gain: 0.08, delay: d });
      tone(1319, 0.14, { type: 'square', gain: 0.08, delay: d + 0.07 });
      break;
    case 'endTurn':
      noise(0.22, { filter: 'bandpass', freq: 600, sweepTo: 250, gain: 0.15, delay: d });
      break;
    case 'victory':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.2, delay: d + i * 0.11 }));
      break;
    case 'defeat':
      [392, 330, 262].forEach((f, i) => tone(f, 0.35, { type: 'triangle', gain: 0.2, delay: d + i * 0.2 }));
      break;
  }
}
