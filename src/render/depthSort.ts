/**
 * In-place sort of `a[0..n)` by `keys[0..n)`, then `ties[0..n)` (both ascending), moving the keys and ties with the items.
 * With distinct ties the result is fully determined, whatever order `a` starts in.
 *
 * A depth band re-sorts each time its render group rebuilds, which is every frame a crew member in it steps across a depth
 * (#389), and then only a handful of items are out of place. Insertion sort does that in about n steps; when it has to move
 * items too far (a first build, a ship added) it gives up after `budget` moves and sorts from scratch.
 */
export function sortByKeys<T>(a: T[], keys: Float64Array, ties: Float64Array, n: number, budget = 4 * n + 64): void {
  const before = (k1: number, t1: number, k2: number, t2: number): boolean => k1 < k2 || (k1 === k2 && t1 < t2);
  let moves = 0;
  let i = 1;
  for (; i < n; i++) {
    const k = keys[i] as number;
    const t = ties[i] as number;
    if (!before(k, t, keys[i - 1] as number, ties[i - 1] as number)) continue;
    const item = a[i] as T;
    let j = i - 1;
    while (j >= 0 && before(k, t, keys[j] as number, ties[j] as number)) {
      keys[j + 1] = keys[j] as number;
      ties[j + 1] = ties[j] as number;
      a[j + 1] = a[j] as T;
      j--;
    }
    keys[j + 1] = k;
    ties[j + 1] = t;
    a[j + 1] = item;
    moves += i - 1 - j;
    if (moves > budget) break;
  }
  if (i >= n) return;
  const order: number[] = new Array(n);
  for (let x = 0; x < n; x++) order[x] = x;
  order.sort((x, y) => (keys[x] as number) - (keys[y] as number) || (ties[x] as number) - (ties[y] as number));
  const items = a.slice(0, n);
  const ks = keys.slice(0, n);
  const ts = ties.slice(0, n);
  for (let x = 0; x < n; x++) {
    const o = order[x] as number;
    a[x] = items[o] as T;
    keys[x] = ks[o] as number;
    ties[x] = ts[o] as number;
  }
}
