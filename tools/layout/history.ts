/** Undo and redo over whole layouts (plain data, so a snapshot is a reference): one entry per gesture. */
export interface History<T> { past: T[]; present: T; future: T[] }
export const LIMIT = 200;

export const fresh = <T>(present: T): History<T> => ({ past: [], present, future: [] });
/** The present changed without making an undo step (a drag in progress). */
export const live = <T>(h: History<T>, present: T): History<T> => ({ ...h, present });
/** Close a gesture that began at `before`: it is one undo step if it changed anything. */
export function commit<T>(h: History<T>, before: T): History<T> {
  if (before === h.present) return h;
  return { past: [...h.past, before].slice(-LIMIT), present: h.present, future: [] };
}
export function undo<T>(h: History<T>): History<T> {
  const p = h.past[h.past.length - 1];
  return p === undefined ? h : { past: h.past.slice(0, -1), present: p, future: [h.present, ...h.future] };
}
export function redo<T>(h: History<T>): History<T> {
  const n = h.future[0];
  return n === undefined ? h : { past: [...h.past, h.present], present: n, future: h.future.slice(1) };
}
