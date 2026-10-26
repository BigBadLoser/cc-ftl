/** Whether a right-column card (goals, jobs) is collapsed to its header row. Lasts for the browser session (sessionStorage); expanded when unset or storage is unavailable. */
type Store = Pick<Storage, 'getItem' | 'setItem'>;

export const collapseKey = (card: string): string => `cc.cardCollapsed.${card}`;

export function readCollapsed(card: string, store: () => Store = () => sessionStorage): boolean {
  try {
    return store().getItem(collapseKey(card)) === '1';
  } catch {
    return false;
  }
}

export function writeCollapsed(card: string, collapsed: boolean, store: () => Store = () => sessionStorage): void {
  try {
    store().setItem(collapseKey(card), collapsed ? '1' : '0');
  } catch {
    /* not remembered */
  }
}
