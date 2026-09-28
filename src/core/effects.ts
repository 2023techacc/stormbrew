import type { Combatant } from './types';

/** Damage is absorbed by Block first; the rest comes off HP. */
export function dealDamage(target: Combatant, amount: number): { blocked: number; hpLost: number } {
  const blocked = Math.min(target.block, amount);
  target.block -= blocked;
  const hpLost = Math.min(target.hp, amount - blocked);
  target.hp -= hpLost;
  return { blocked, hpLost };
}

export function gainBlock(target: Combatant, amount: number): void {
  target.block += amount;
}
