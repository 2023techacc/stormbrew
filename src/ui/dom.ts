/**
 * Cards have a fixed size, so a long text (or a long name in another
 * language) can run past the bottom edge on a small phone. After a screen is
 * drawn, a card whose content doesn't fit gets smaller text. All the cards are
 * measured first and changed after, so the page is laid out only once.
 */
export function fitCards(root: ParentNode): void {
  const cards = [...root.querySelectorAll<HTMLElement>('.card')];
  const overflowing = cards.filter((card) => card.scrollHeight > card.clientHeight + 1);
  for (const card of overflowing) card.classList.add('tight');
}

/** Escapes text for safe use inside innerHTML templates. */
export function esc(text: string | number): string {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
