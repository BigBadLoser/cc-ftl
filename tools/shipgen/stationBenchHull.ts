/**
 * Station bench: rim protrusions against the actual hull. The hull is the outermost non-space tile (wall or floor) per
 * angle bin around the template centre, airlock footprints excluded. Its circle radius Rc is the median of those bin
 * radii. A room-floor tile protrudes when it lies in a local bump: its bin's outer radius exceeds both Rc and the median
 * of the neighbouring bins (+-3, itself excluded) by at least BUMP tiles, and the tile itself is farther out than that
 * larger reference by at least BUMP. Docks (role dock) are excluded. Share = protruding tiles / room-floor tiles.
 */
const BINS = 48, BUMP = 2, NEIGH = 3;

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
  const ref = outer.map((o, b) => {
    const nb: number[] = [];
    for (let k = 1; k <= NEIGH; k++) nb.push(outer[(b + k) % BINS] as number, outer[(b - k + BINS) % BINS] as number);
    return o - Math.max(Rc, med(nb)) >= BUMP ? Math.max(Rc, med(nb)) : Infinity;
  });
  const hit = room.filter((i) => dist(i) - (ref[binOf(i)] as number) >= BUMP).length;
  return room.length ? hit / room.length : 0;
}
