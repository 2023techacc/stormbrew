import type { WeatherId } from '../core/types';
import { WEATHERS } from './theme';

/**
 * The sky behind a fight: a tint in the weather's color and falling (or rising)
 * particles. It is one canvas behind the page, outside the re-rendered screen,
 * so the particles keep moving while the fight redraws. Particles are off when
 * effects are turned off in Settings or the phone asks for reduced motion.
 */
interface Particle {
  kind: WeatherId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  /** New particles fade in up to this. */
  maxAlpha: number;
  /** For drifting snow and flickering embers. */
  phase: number;
  /** Fading out because the weather changed. */
  leaving: boolean;
}

/** Particles on a phone-sized screen (360×740); bigger screens get more. */
const COUNTS: Record<WeatherId, number> = { clear: 14, rain: 70, storm: 110, heatwave: 32, snow: 60 };
const PHONE_AREA = 360 * 740;

let canvas: HTMLCanvasElement | null = null;
let draw: CanvasRenderingContext2D | null = null;
let weather: WeatherId | null = null;
let enabled = true;
let particles: Particle[] = [];
let frame = 0;
let last = 0;
let time = 0;
/** A lightning flash across the sky, fading from 1 to 0. */
let lightning = 0;

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Whether the livelier effects (particles, flying cards) should run. */
export function motionAllowed(): boolean {
  return enabled && !reducedMotion();
}

/** Shows this weather behind the screen, or nothing (null) outside fights. */
export function setWeatherFx(next: WeatherId | null): void {
  if (next === weather && canvas) return;
  weather = next;
  update();
}

/** Lights up the sky for a moment, when lightning strikes. */
export function flashSky(): void {
  if (frame) lightning = 1;
}

export function setEffectsEnabled(on: boolean): void {
  enabled = on;
  update();
}

function ensureCanvas(): HTMLCanvasElement {
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.className = 'weather-fx';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  draw = canvas.getContext('2d');
  document.addEventListener('visibilitychange', update);
  return canvas;
}

function update(): void {
  const el = ensureCanvas();
  el.classList.toggle('active', weather !== null);
  if (weather) el.style.setProperty('--sky-color', WEATHERS[weather].color);
  for (const p of particles) p.leaving = p.kind !== weather;
  const running = weather !== null && enabled && !reducedMotion() && !document.hidden;
  if (running && !frame) {
    last = performance.now();
    frame = requestAnimationFrame(tick);
  } else if (!running && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
    particles = [];
    draw?.clearRect(0, 0, el.width, el.height);
  }
}

function tick(now: number): void {
  frame = requestAnimationFrame(tick);
  if (!canvas || !draw) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  draw.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw.clearRect(0, 0, w, h);

  if (weather) {
    const target = Math.round(COUNTS[weather] * Math.min(2, (w * h) / PHONE_AREA));
    const current = particles.filter((p) => !p.leaving).length;
    // While the sky fills up, particles appear anywhere and fade in, so a new
    // weather rolls in; after that they come in from the edge.
    const filling = current < target * 0.7;
    for (let i = 0; i < Math.min(target - current, 6); i++) particles.push(spawn(weather, w, h, filling));
  }

  particles = particles.filter((p) => move(p, dt, w, h));
  for (const p of particles) paint(draw, p);

  if (lightning > 0) {
    // Two quick flickers, then it fades.
    const flicker = lightning > 0.75 || (lightning > 0.45 && lightning < 0.6) ? 1 : 0.4;
    draw.fillStyle = `rgba(230, 240, 255, ${0.3 * lightning * flicker})`;
    draw.fillRect(0, 0, w, h);
    lightning = Math.max(0, lightning - dt * 2.5);
  }
}

function spawn(kind: WeatherId, w: number, h: number, anywhere: boolean): Particle {
  const r = Math.random;
  const p: Particle = {
    kind,
    x: r() * w,
    y: 0,
    vx: 0,
    vy: 0,
    size: 1,
    alpha: 0,
    maxAlpha: 0,
    phase: r() * Math.PI * 2,
    leaving: false,
  };
  switch (kind) {
    case 'rain':
      p.vy = 650 + r() * 250;
      p.vx = -60;
      p.size = 10 + r() * 10;
      p.maxAlpha = 0.25 + r() * 0.2;
      p.y = anywhere ? r() * h : -20;
      break;
    case 'storm':
      p.vy = 850 + r() * 300;
      p.vx = -260 - r() * 80;
      p.size = 14 + r() * 12;
      p.maxAlpha = 0.3 + r() * 0.25;
      p.x = r() * (w + 200);
      p.y = anywhere ? r() * h : -30;
      break;
    case 'snow':
      p.vy = 25 + r() * 35;
      p.size = 1 + r() * 2.2;
      p.maxAlpha = 0.5 + r() * 0.4;
      p.y = anywhere ? r() * h : -5;
      break;
    case 'heatwave':
      p.vy = -(18 + r() * 30);
      p.size = 0.8 + r() * 1.6;
      p.maxAlpha = 0.35 + r() * 0.4;
      p.y = anywhere ? r() * h : h + 5;
      break;
    case 'clear':
      p.vy = -(4 + r() * 8);
      p.vx = 4 + r() * 6;
      p.size = 1.5 + r() * 2;
      p.maxAlpha = 0.12 + r() * 0.15;
      p.y = r() * h;
      break;
  }
  p.alpha = anywhere ? 0 : p.maxAlpha;
  return p;
}

/** Moves a particle; false when it's gone. */
function move(p: Particle, dt: number, w: number, h: number): boolean {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.kind === 'snow') p.x += Math.sin(time * 1.3 + p.phase) * 18 * dt;
  if (p.kind === 'heatwave') p.x += Math.sin(time * 2 + p.phase) * 10 * dt;
  if (p.leaving) {
    p.alpha -= dt * 1.5;
    if (p.alpha <= 0) return false;
  } else if (p.alpha < p.maxAlpha) p.alpha = Math.min(p.maxAlpha, p.alpha + dt * 1.2);
  if (p.kind === 'clear') {
    // Motes wander forever; wrap around the edges.
    if (p.x > w + 5) p.x = -5;
    if (p.y < -5) p.y = h + 5;
    return true;
  }
  return p.y < h + 40 && p.y > -40 && p.x > -60;
}

function paint(g: CanvasRenderingContext2D, p: Particle): void {
  switch (p.kind) {
    case 'rain':
    case 'storm': {
      const k = p.size / p.vy;
      g.strokeStyle = `rgba(185, 210, 255, ${p.alpha})`;
      g.lineWidth = p.kind === 'storm' ? 1.4 : 1;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * k, p.y - p.vy * k);
      g.stroke();
      break;
    }
    case 'snow':
      g.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
      break;
    case 'heatwave': {
      const flicker = 0.6 + 0.4 * Math.sin(time * 9 + p.phase);
      g.fillStyle = `rgba(255, ${140 + Math.round(60 * flicker)}, 60, ${p.alpha * flicker})`;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'clear':
      g.fillStyle = `rgba(255, 244, 200, ${p.alpha})`;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
      break;
  }
}
