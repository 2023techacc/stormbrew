import { motionAllowed } from './weatherFx';

/**
 * Small animation helpers shared by the screens. Screens are redrawn with
 * innerHTML, so an animation either restarts a CSS class on the new element
 * (flash) or flies a copy of the old element across the redrawn screen (fly).
 * Everything here is skipped when weather effects are off or the phone asks
 * for less motion (CSS animations are switched off in style.css for the same).
 */

/** Restarts a CSS animation class on an element. */
export function flash(el: Element | null | undefined, className = 'hit'): void {
  if (!el) return;
  el.classList.remove(className);
  void (el as HTMLElement).offsetWidth; // restart the animation
  el.classList.add(className);
}

export function shake(el: Element | null | undefined): void {
  flash(el, 'shake');
}

/** A short text rising from an element and fading out (damage, Block, a brew's name…). */
export function floatText(parent: Element | null | undefined, text: string, className: string): void {
  if (!parent) return;
  const float = document.createElement('span');
  float.className = `float ${className}`;
  float.textContent = text;
  parent.appendChild(float);
  float.addEventListener('animationend', () => float.remove());
}

/** A copy of an element and where it was on screen, taken before the screen is redrawn. */
export interface Ghost {
  el: HTMLElement;
  rect: DOMRect;
}

export function capture(el: Element | null | undefined): Ghost | null {
  if (!el || !motionAllowed()) return null;
  return { el: el.cloneNode(true) as HTMLElement, rect: el.getBoundingClientRect() };
}

export interface FlyOptions {
  delay?: number;
  duration?: number;
  /** How small the copy gets by the time it lands. */
  endScale?: number;
  /** Called when the copy lands (e.g. to make the target bump). */
  onLand?: () => void;
}

/** Flies a captured copy in an arc to a target (or upwards, without one), shrinking and fading on the way. */
export function fly(ghost: Ghost | null, target: Element | null | undefined, options: FlyOptions = {}): void {
  if (!ghost) return;
  const { el, rect } = ghost;
  for (const name of el.getAttributeNames()) if (name.startsWith('data-') || name === 'id') el.removeAttribute(name);
  el.classList.remove('selected', 'drawn', 'enter', 'pop');
  el.classList.add('ghost');
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  el.style.setProperty('--card-width', `${rect.width}px`);
  document.body.appendChild(el);
  const to = target?.getBoundingClientRect();
  const dx = to ? to.left + to.width / 2 - (rect.left + rect.width / 2) : 0;
  const dy = to ? to.top + to.height / 2 - (rect.top + rect.height / 2) : -120;
  const end = options.endScale ?? 0.3;
  const flight = el.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(${(1 + end) / 2 + 0.1})`, opacity: 0.95, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(${end})`, opacity: 0.2 },
    ],
    { duration: options.duration ?? 380, delay: options.delay ?? 0, easing: 'ease-in', fill: 'backwards' },
  );
  flight.onfinish = () => {
    el.remove();
    options.onLand?.();
  };
  flight.oncancel = () => el.remove();
}

/** Counts a number shown in an element from one value to another (gold going up or down). */
export function countTo(el: Element | null | undefined, from: number, to: number, ms = 500): void {
  if (!el || from === to || !motionAllowed()) return;
  const start = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / ms);
    el.textContent = String(Math.round(from + (to - from) * (1 - (1 - p) ** 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  el.textContent = String(from);
  requestAnimationFrame(step);
}

/** A little burst of icons flying out from behind an element's edges (a won fight's result). */
export function burst(from: Element | null | undefined, icons: readonly string[], count = 12): void {
  if (!from || !motionAllowed()) return;
  const rect = from.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('span');
    spark.className = 'spark';
    spark.setAttribute('aria-hidden', 'true');
    spark.textContent = icons[i % icons.length] ?? '✨';
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    // Start on the element's edge (an ellipse around it) and fly outwards.
    const sx = cx + (Math.cos(angle) * rect.width) / 2;
    const sy = cy + (Math.sin(angle) * rect.height) / 2;
    Object.assign(spark.style, { left: `${sx}px`, top: `${sy}px` });
    document.body.appendChild(spark);
    const distance = 50 + Math.random() * 60;
    const anim = spark.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.15 },
        {
          transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance + 20}px)) scale(0.6)`,
          opacity: 0,
        },
      ],
      { duration: 900 + Math.random() * 300, delay: Math.random() * 120, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)', fill: 'backwards' },
    );
    anim.onfinish = () => spark.remove();
    anim.oncancel = () => spark.remove();
  }
}

export { motionAllowed };
