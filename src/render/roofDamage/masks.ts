/** Pixel mask operations for the roof damage art: masks are Uint8Array (0 / 1) over a w x h window, row-major. */

export type Mask = Uint8Array;

/** The px dy rows above (dy > 0) or below (dy < 0) and dx columns left (dx > 0) of each px: 0 off the window. */
export function shifted(m: Mask, w: number, h: number, dy: number, dx: number): Mask {
  const o = new Uint8Array(m.length);
  for (let y = Math.max(0, dy); y < Math.min(h, h + dy); y++) {
    const sy = y - dy;
    for (let x = Math.max(0, dx); x < Math.min(w, w + dx); x++) o[y * w + x] = m[sy * w + x - dx] as number;
  }
  return o;
}

/** 4-neighbour dilation (`down`: grow to the px below too; false leaves it out). */
export function dilate(m: Mask, w: number, h: number, down = true): Mask {
  const o = m.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (m[i]) continue;
      if ((x > 0 && m[i - 1]) || (x < w - 1 && m[i + 1]) || (y < h - 1 && m[i + w]) || (down && y > 0 && m[i - w])) o[i] = 1;
    }
  }
  return o;
}

/**
 * Steps from m (1..max; m's own px and px past max are 99), growing as `dilate` does: left, right and up each step, and
 * down only on every `downEvery`th step. Grows from each step's new px only, so the cost is the band's, not the window's.
 */
export function distances(m: Mask, w: number, h: number, max: number, downEvery: number): Uint8Array {
  const dist = new Uint8Array(m.length).fill(99);
  const seen = m.slice();
  const layers: number[][] = [[]];
  for (let i = 0; i < m.length; i++) if (m[i]) layers[0]!.push(i);
  for (let k = 1; k <= max; k++) {
    const add: number[] = [];
    const reach = (j: number): void => {
      if (seen[j]) return;
      seen[j] = 1;
      dist[j] = k;
      add.push(j);
    };
    for (const p of layers[k - 1]!) {
      const x = p % w;
      if (x > 0) reach(p - 1);
      if (x < w - 1) reach(p + 1);
      if (p >= w) reach(p - w);
    }
    if (k % downEvery === 0) for (let l = Math.max(0, k - downEvery); l < k; l++) for (const p of layers[l]!) if (p < m.length - w) reach(p + w);
    layers.push(add);
  }
  return dist;
}

/** 4-neighbour erosion (off-window neighbours count as set, so nothing erodes at the window's edge). */
export function erode(m: Mask, w: number, h: number): Mask {
  const o = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (m[i] && (x === 0 || m[i - 1]) && (x === w - 1 || m[i + 1]) && (y === 0 || m[i - w]) && (y === h - 1 || m[i + w])) o[i] = 1;
    }
  }
  return o;
}

/** An opening: erode then dilate `n` times (drops anything narrower than about 2n + 1 px). */
export function opened(m: Mask, w: number, h: number, n: number): Mask {
  let o = m;
  for (let k = 0; k < n; k++) o = erode(o, w, h);
  for (let k = 0; k < n; k++) o = dilate(o, w, h);
  return o;
}

/** 4-connected components of m: labels 1..n (0 elsewhere) and each one's size and whether it touches the window edge. */
export function label(m: Mask, w: number, h: number): { lab: Int32Array; size: number[]; edge: boolean[] } {
  const lab = new Int32Array(m.length);
  const size = [0];
  const edge = [false];
  const todo: number[] = [];
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || lab[s]) continue;
    const n = size.length;
    size.push(0);
    edge.push(false);
    lab[s] = n;
    todo.push(s);
    while (todo.length) {
      const i = todo.pop() as number;
      size[n] = (size[n] as number) + 1;
      const x = i % w;
      const y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge[n] = true;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && m[j] && !lab[j]) {
          lab[j] = n;
          todo.push(j);
        }
      }
    }
  }
  return { lab, size, edge };
}

/**
 * The mask squared off onto a cell grid (each column's and each row's cell index, `cellsAlong`): a cell is in if more
 * than half of its px in the window are.
 */
export function stepped(m: Mask, w: number, h: number, cols: Int32Array, rows: Int32Array): Mask {
  const c0 = cols[0] as number;
  const r0 = rows[0] as number;
  const cw = (cols[w - 1] as number) - c0 + 1;
  const tally = new Int32Array(cw * ((rows[h - 1] as number) - r0 + 1));
  for (let y = 0; y < h; y++) {
    const row = ((rows[y] as number) - r0) * cw - c0;
    for (let x = 0; x < w; x++) {
      const c = row + (cols[x] as number);
      tally[c] = (tally[c] as number) + (m[y * w + x] ? 1 : -1);
    }
  }
  const o = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    const row = ((rows[y] as number) - r0) * cw - c0;
    for (let x = 0; x < w; x++) if ((tally[row + (cols[x] as number)] as number) > 0) o[y * w + x] = 1;
  }
  return o;
}

/** a AND b, a OR b, NOT a. */
export function and(a: Mask, b: Mask): Mask {
  const o = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = (a[i] as number) & (b[i] as number);
  return o;
}
export function or(a: Mask, b: Mask): Mask {
  const o = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = (a[i] as number) | (b[i] as number);
  return o;
}
export function not(a: Mask): Mask {
  const o = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = 1 - (a[i] as number);
  return o;
}

/** Keep only the components of `m` that touch `seed` (4-connected flood from it). */
export function joinedTo(m: Mask, seed: Mask, w: number, h: number): Mask {
  const o = new Uint8Array(m.length);
  const todo: number[] = [];
  for (let i = 0; i < m.length; i++) {
    if (!m[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    if ((x > 0 && seed[i - 1]) || (x < w - 1 && seed[i + 1]) || (y > 0 && seed[i - w]) || (y < h - 1 && seed[i + w])) {
      o[i] = 1;
      todo.push(i);
    }
  }
  while (todo.length) {
    const i = todo.pop() as number;
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j >= 0 && j < m.length && m[j] && !o[j]) {
        o[j] = 1;
        todo.push(j);
      }
    }
  }
  return o;
}
