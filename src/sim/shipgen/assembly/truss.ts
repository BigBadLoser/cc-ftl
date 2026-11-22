import type { Rng } from '../../rng';
import { containerChar, extractContainers, type PlacedContainer } from '../containerCells';
import type { TrussSpec } from '../outlineRecipe';

/**
 * A pusher's truss (PROTOTYPE, #581): the cargo a freighter pushes ahead of its hull, frame and sealed containers, no
 * floor. A spine three beams deep runs forward from the hull's bow on its axis; either side of it a bank of large
 * containers stood across it a tile apart, their doors clamped to the spine; with a second layer, a rail
 * outboard of the first bank and a second bank clamped to it. The hull pushes it: its bridge looks down the spine.
 */

/** A large container stood across the spine: its width and length. */
const CW = 3, CL = 6;
/** Rows of the spine either side of the axis. */
const SPINE = 1;

export interface Trussed { rows: string[]; roomOf: Int16Array; width: number; height: number; containers: PlacedContainer[] }

/** The rows with the truss ahead of the hull (`axis` its centre row), the rooms moved with them. */
export function addTruss(rng: Rng, t: TrussSpec, s: { rows: string[]; roomOf: Int16Array; width: number; height: number }, axis: number): Trussed {
  const n = rng.int(t.banks[0], t.banks[1]), layers = t.layers;
  // The truss's half-depth: the spine, then each layer's bank and the rail outboard of it.
  const half = SPINE + layers * (CL + 1);
  const len = n * (CW + 1) - 1, gap = 2;
  const padY = Math.max(0, half + 1 - axis, half + 1 - (s.height - 1 - axis));
  const W = s.width + len + gap, H = s.height + 2 * padY, a = axis + padY, ox = len + gap;
  const cells: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const roomOf = new Int16Array(W * H).fill(-1);
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) {
    (cells[y + padY] as string[])[x + ox] = s.rows[y]?.[x] ?? '.';
    roomOf[(y + padY) * W + x + ox] = s.roomOf[y * s.width + x] as number;
  }
  const set = (x: number, y: number, c: string): void => { const r = cells[y]; if (r && x >= 0 && x < W) r[x] = c; };
  const box = containerChar(CW, CL) as string;
  const x0 = 1;
  // The spine, on to the hull's bow wall.
  for (let y = a - SPINE; y <= a + SPINE; y++) for (let x = x0; x < W && cells[y]?.[x] === '.'; x++) set(x, y, '=');
  for (const side of [-1, 1]) for (let l = 0; l < layers; l++) {
    // A bank: its rows outward from the spine (or the rail inboard of it), a tile of space between containers, the rail beyond.
    const inner = SPINE + 1 + l * (CL + 1);
    const ys = Array.from({ length: CL }, (_, k) => a + side * (inner + k));
    for (let i = 0; i < n; i++) for (const y of ys) for (let k = 0; k < CW; k++) set(x0 + i * (CW + 1) + k, y, box);
    if (l < layers - 1) for (let x = x0; x < x0 + len; x++) set(x, a + side * (inner + CL), '=');
  }
  const { rows, containers } = extractContainers(cells.map((r) => r.join('')));
  return { rows, roomOf, width: W, height: H, containers };
}
