/**
 * Cargo containers on the shipgen canvas: each container size and turn has its own cell char, so container tiles stay
 * apart from frame beams ('=') and rooms through every block, mirror and placement. The finished rows turn them into
 * Beam tiles ('=') and every container into a `container.<W>x<H>` module (`extractContainers`). The chars are symbols:
 * never a room letter, wall, door, beam or floor.
 */
export interface ContainerKind {
  def: string;
  rot: number;
  /** Footprint as drawn (rotation applied). */
  w: number;
  h: number;
}

export const CONTAINER_CHARS: Readonly<Record<string, ContainerKind>> = {
  '%': { def: 'container.3x3', rot: 0, w: 3, h: 3 },
  '&': { def: 'container.3x5', rot: 0, w: 3, h: 5 },
  '+': { def: 'container.3x5', rot: 1, w: 5, h: 3 },
  '*': { def: 'container.5x5', rot: 0, w: 5, h: 5 },
};

export const isContainerCell = (c: string | undefined): boolean => c !== undefined && c in CONTAINER_CHARS;

/** The cell char of a container `w` (along x) by `h` drawn on the canvas, or null if no container has that footprint. */
export function containerChar(w: number, h: number): string | null {
  for (const [ch, k] of Object.entries(CONTAINER_CHARS)) if (k.w === w && k.h === h) return ch;
  return null;
}

export interface PlacedContainer {
  def: string;
  x: number;
  y: number;
  rot: number;
  clamp: 'n' | 'e' | 's' | 'w';
}

/**
 * Find every container in finished rows and turn its cells into beams. Containers of one char are equal rectangles, so
 * the first unclaimed cell in row-major order is always a container's top-left. The clamp is the side touching the most
 * frame cells, beams or a crawl tube's wall (ties: n, s, w, e).
 */
export function extractContainers(rows: string[]): { rows: string[]; containers: PlacedContainer[] } {
  const cells = rows.map((r) => [...r]);
  const at = (x: number, y: number): string => cells[y]?.[x] ?? '.';
  const claimed = new Set<number>();
  const W = Math.max(0, ...rows.map((r) => r.length));
  const out: PlacedContainer[] = [];
  for (let y = 0; y < cells.length; y++) {
    for (let x = 0; x < (cells[y] as string[]).length; x++) {
      const ch = at(x, y);
      const k = CONTAINER_CHARS[ch];
      if (!k || claimed.has(y * W + x)) continue;
      for (let j = 0; j < k.h; j++) for (let i = 0; i < k.w; i++) claimed.add((y + j) * W + x + i);
      // Frame cells: beams, or a crawl tube's wall; never space or another container.
      const count = (pts: [number, number][]): number => pts.filter(([a, b]) => at(a, b) !== '.' && !isContainerCell(at(a, b))).length;
      const sides: [PlacedContainer['clamp'], number][] = [
        ['n', count(Array.from({ length: k.w }, (_, i) => [x + i, y - 1]))],
        ['s', count(Array.from({ length: k.w }, (_, i) => [x + i, y + k.h]))],
        ['w', count(Array.from({ length: k.h }, (_, j) => [x - 1, y + j]))],
        ['e', count(Array.from({ length: k.h }, (_, j) => [x + k.w, y + j]))],
      ];
      const clamp = sides.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
      out.push({ def: k.def, x, y, rot: k.rot, clamp });
    }
  }
  for (const row of cells) for (let x = 0; x < row.length; x++) if (isContainerCell(row[x])) row[x] = '=';
  return { rows: cells.map((r) => r.join('')), containers: out };
}
