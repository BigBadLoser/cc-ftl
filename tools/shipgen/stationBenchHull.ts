/**
 * Station bench: rim protrusions against the hull circle. The hull circle is fitted robustly: Rc = median over 48 angle
 * bins of the outermost non-space tile's distance from the template centre, airlock footprints excluded (docks stick out
 * by design). A room (not role dock) tile protrudes when it lies farther than Rc + MARGIN. A room glued to the rim spans
 * several bins, so it is a plateau that a per-bin hull would follow; the median ignores it. Share = protruding tiles /
 * room-floor tiles.
 */
const BINS = 48, MARGIN = 2;

export function protrusionShare(W: number, H: number, rows: readonly string[], skip: Set<number>, room: number[]): number {
  const cx = W / 2, cy = H / 2;
  const binOf = (i: number): number => Math.floor(((Math.atan2(Math.floor(i / W) + 0.5 - cy, (i % W) + 0.5 - cx) + Math.PI) / (2 * Math.PI)) * BINS) % BINS;
  const dist = (i: number): number => Math.hypot((i % W) + 0.5 - cx, Math.floor(i / W) + 0.5 - cy);
  const outer = new Array<number>(BINS).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if ((rows[y]?.[x] ?? '.') === '.' || skip.has(i)) continue;
    const b = binOf(i);
    outer[b] = Math.max(outer[b] as number, dist(i));
  }
  const med = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const Rc = med(outer);
  const hit = room.filter((i) => dist(i) > Rc + MARGIN).length;
  return room.length ? hit / room.length : 0;
}
