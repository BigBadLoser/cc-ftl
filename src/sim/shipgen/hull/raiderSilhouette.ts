import type { Rng } from '../../rng';
import type { BladePick, Range, Silhouette } from './silhouette';

/**
 * A raider's silhouette, drawn whole before any room (PROTOTYPE, #581): the approved mock sheet's body (raider_kit_v18),
 * a nose, a wide body and a drive block, with its blades' roots set on it. The outline scales the body to its rooms; the
 * blades stand where it drew them (assembly/blades.ts), and no airlock stands under a blade's root.
 */

export type Pt = readonly [number, number];
export type Poly = readonly Pt[];

/** The mock's noses: a long taper to a narrow prow, a blunt ram, a fine point, a point on a spike, a rounded bow. */
export type RaiderNose = 'taper' | 'ram' | 'point' | 'spike' | 'round';

/** A raider body's draws, in tiles before scaling: its noses, the nose's length, the body's length and half-beam. */
export interface RaiderSil { noses: readonly RaiderNose[]; nose: Range; len: Range; half: Range }

/** Tiles astern of the body the drive block stands, and in from its side. */
const DRIVE = 5, DRIVE_IN = 4;
/** Columns either side of a blade's root no airlock stands in. */
const ROOT_CLEAR = 6;

/** Whether a point is inside a polygon (even-odd). */
export function inPoly(x: number, y: number, p: Poly): boolean {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i] as Pt, [xj, yj] = p[j] as Pt;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function nosePoly(nose: RaiderNose, n: number, h: number): Pt[] {
  switch (nose) {
    case 'taper': return [[0, 0], [0, 3], [n, h]];
    case 'ram': return [[0, 0], [0, h - 3], [3, h]];
    case 'point': return [[0, 0], [0, 2], [n, h]];
    case 'spike': return [[-6, 0], [-6, 1], [0, 2], [n, h]];
    case 'round': return [[0, 0], [0, h - 5], [2, h - 2], [5, h]];
  }
}

export function drawRaider(rng: Rng, spec: RaiderSil, pick: BladePick): Silhouette {
  const nose = rng.pick(spec.noses as RaiderNose[]), n = rng.int(spec.nose[0], spec.nose[1]);
  const L = rng.int(spec.len[0], spec.len[1]), h = rng.int(spec.half[0], spec.half[1]);
  const core: Poly = [...nosePoly(nose, n, h), [n + L - 4, h], [n + L, h - 3], [n + L, 0]];
  const drive: Poly = [[n + L - 3, 0], [n + L - 3, h - DRIVE_IN], [n + L + DRIVE, h - DRIVE_IN], [n + L + DRIVE, 0]];
  // Half-widths column by column, at tile centres (the axis row's a little off it, so a point's tip holds a tile).
  const x0 = nose === 'spike' ? -6 : 0, length = n + L + DRIVE - x0;
  const body = Array.from({ length }, (_, c) => {
    let t = -1;
    for (let y = 0; y <= h; y++) if ([core, drive].some((p) => inPoly(x0 + c + 0.5, y === 0 ? 0.25 : y + 0.5, p))) t = y;
    return t;
  });
  const H = Math.max(...body);
  const rows = Array.from({ length: 2 * H + 1 }, (_, r) => body.map((t) => (Math.abs(r - H) <= t ? '#' : '.')).join(''));
  // The mock's roots: the fore blade's at the nose's shoulder, the aft's a blade's width ahead of the stern, a horn amidships.
  const col = (x: number): number => x - x0;
  const at = { fore: col(n + 8) / length, aft: col(n + L - 10) / length, horn: col(n + Math.floor(L / 2)) / length };
  const roots = [pick.fore && at.fore, pick.aft && at.aft, pick.horn && at.horn].filter((a): a is number => typeof a === 'number');
  const clear = roots.map((a) => [Math.round(a * length) - ROOT_CLEAR, Math.round(a * length) + ROOT_CLEAR] as [number, number]);
  return { rows, axis: H, length, body: body.map((t) => Math.max(0, t)), blades: { pick, at }, clear };
}
