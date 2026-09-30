import type { CombatEvent, CombatState } from '../core/types';
import { buzz } from './haptics';
import { playSfx, type Sfx } from './sound';

/** Damage in one go that makes the phone buzz, and that makes it buzz harder. */
export const BUZZ_HURT = 6;
export const BUZZ_HURT_HARD = 12;

/**
 * Sounds and vibration for what just happened in a fight. A turn can produce
 * many events at once, so each sound plays a limited number of times, slightly
 * apart, instead of all on top of each other. Vibration is kept for the moments
 * that matter: a real hit, lightning striking you, and winning or losing.
 */
export function combatFeedback(events: readonly CombatEvent[], state: CombatState, wasPlaying: boolean): void {
  const counts = new Map<Sfx, number>();
  let delay = 0;
  const play = (sfx: Sfx, limit = 1) => {
    const n = counts.get(sfx) ?? 0;
    if (n >= limit) return;
    counts.set(sfx, n + 1);
    playSfx(sfx, delay);
    delay += 0.07;
  };

  let hurt = 0;
  for (const e of events) {
    switch (e.type) {
      case 'damage':
        if (e.source === 'lightning') {
          play('thunder');
          if (e.target.side === 'player' && e.amount > 0) buzz('heavy');
        } else if (e.source === 'burn') play('burn');
        else if (e.target.side === 'player') {
          if (e.amount > 0) {
            play('hurt', 2);
            hurt += e.amount;
          } else play('block');
        } else play('hit', 3);
        break;
      case 'block':
        if (e.target.side === 'player') play('block');
        break;
      case 'element':
        play('element', 2);
        break;
      case 'brew':
      case 'potion':
        play('brew');
        break;
      case 'enemyBrew':
        play('enemyBrew');
        break;
      case 'weather':
        if (e.from !== e.to) play('weather');
        break;
      case 'heal':
        if (e.amount > 0) play('heal');
        break;
      case 'steal':
      case 'pilfer':
        play('steal');
        break;
      case 'shatter':
        play('shatter');
        break;
      case 'enemyHeal':
        if (e.amount > 0) play('heal');
        break;
      default:
        break;
    }
  }
  if (hurt >= BUZZ_HURT) buzz(hurt >= BUZZ_HURT_HARD ? 'heavy' : 'medium');
  if (wasPlaying && state.status === 'won') {
    playSfx('victory', delay + 0.15);
    buzz('success');
  } else if (wasPlaying && state.status === 'lost') {
    playSfx('defeat', delay + 0.15);
    buzz('failure');
  }
}
