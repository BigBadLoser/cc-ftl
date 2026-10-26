/** Pure helpers for the phone HUD: the notification toast split and the goals chip's session state. */

/** The phone shows the newest alert (the list is newest first) and a "+N" count for the rest. */
export function splitAlerts<T>(list: readonly T[]): { top: T | null; rest: T[]; extra: number } {
  return { top: list[0] ?? null, rest: list.slice(1), extra: Math.max(0, list.length - 1) };
}

export const GOALS_PHONE_KEY = 'cc.goalsOpenPhone';
type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** Whether the phone goals card was left expanded this session; collapsed when unset or storage is unavailable. */
export function readGoalsOpen(store: () => Store = () => sessionStorage): boolean {
  try {
    return store().getItem(GOALS_PHONE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeGoalsOpen(open: boolean, store: () => Store = () => sessionStorage): void {
  try {
    store().setItem(GOALS_PHONE_KEY, open ? '1' : '0');
  } catch {
    /* not remembered */
  }
}
