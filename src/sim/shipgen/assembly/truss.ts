import type { Rng } from '../../rng';
import { containerChar, extractContainers, type PlacedContainer } from '../containerCells';
import type { TrussSpec } from '../outlineRecipe';

/**
 * A pusher's truss (PROTOTYPE, #581): the cargo a freighter pushes ahead of its hull, frame and sealed containers, no
 * floor. A spine three beams deep runs forward from the hull's bow on its axis; either side of it a bank of large
 * containers stood across it two tiles apart, their doors clamped to the spine, each bank starting ahead of whatever of
 * the hull stands in its rows (an offset cockpit's pod: that side's bank starts past it); with a second layer, a rail
 * outboard of the first bank and a second bank clamped to it. The hull pushes it.
 */

/** A large container stood across the spine: its width and length. */
const CW = 3, CL = 6;
/** Tiles of space between two containers along the spine, and between the first and the hull. */
const GAP = 2;
/** Rows of the spine either side of the axis. */
const SPINE = 1;

export interface Trussed { rows: string[]; roomOf: Int16Array; width: number; height: number; containers: PlacedContainer[] }

/** The rows with the truss ahead of the hull (`axis` its centre row), the rooms moved with them. */
export function addTruss(rng: Rng, t: TrussSpec, s: { rows: string[]; roomOf: Int16Array; width: number; height: number }, axis: number): Trussed {
  const n = rng.int(t.banks[0], t.banks[1]), layers = t.layers;
  // The truss's half-depth: the spine, then each layer's bank and the rail outboard of it.
  const half = SPINE + layers * (CL + 1);
  const padY = Math.max(0, half + 1 - axis, half + 1 - (s.height - 1 - axis));
  // Room enough ahead for every bank, its hull face as far aft as the hull reaches.
  const ox = (n + 1) * (CW + GAP) + s.width;
  const W = s.width + ox, H = s.height + 2 * padY, a = axis + padY;
  const cells: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) (cells[y + padY] as string[])[x + ox] = s.rows[y]?.[x] ?? '.';
  const at = (x: number, y: number): string => cells[y]?.[x] ?? '.';
  const set = (x: number, y: number, c: string): void => { const r = cells[y]; if (r && x >= 0 && x < W) r[x] = c; };
  const box = containerChar(CW, CL) as string;
  // Each bank: its rows outward from the spine (or the rail inboard of it); its containers from its hull face forward.
  let x0 = W;
  for (const side of [-1, 1]) for (let l = 0; l < layers; l++) {
    const inner = SPINE + 1 + l * (CL + 1), ys = Array.from({ length: CL }, (_, k) => a + side * (inner + k));
    let face = W;
    for (const y of ys) for (let x = 0; x < W; x++) if (at(x, y) !== '.') { face = Math.min(face, x); break; }
    for (let i = 0; i < n; i++) {
      const cx = face - GAP - CW - i * (CW + GAP);
      for (const y of ys) for (let k = 0; k < CW; k++) set(cx + k, y, box);
      x0 = Math.min(x0, cx);
    }
    if (l < layers - 1) for (let x = x0; x < face; x++) set(x, a + side * (inner + CL), '=');
  }
  // The spine, from the foremost container on to the hull's bow wall.
  for (let y = a - SPINE; y <= a + SPINE; y++) for (let x = x0; x < W && at(x, y) === '.'; x++) set(x, y, '=');
  // Cropped to a tile of space ahead of it, the rooms moved with the hull.
  const cut = x0 - 1, width = W - cut;
  const roomOf = new Int16Array(width * H).fill(-1);
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) roomOf[(y + padY) * width + x + ox - cut] = s.roomOf[y * s.width + x] as number;
  const { rows, containers } = extractContainers(cells.map((r) => r.slice(cut).join('')));
  return { rows, roomOf, width, height: H, containers };
}
