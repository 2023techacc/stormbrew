import type { Effect } from '../core/types';

/** Card or recipe text with `{damage}` filled in with its base damage (no weather, e.g. outside fights). */
export function baseText(item: { effects: readonly Effect[]; text: string }): string {
  const damage = item.effects.find((e) => e.type === 'damage');
  return item.text.replace('{damage}', damage?.type === 'damage' ? String(damage.amount) : '');
}
