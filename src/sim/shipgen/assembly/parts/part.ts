import type { ProgramRules } from '../../outlineRecipe';
import type { Bay } from '../bays';
import type { Frame } from '../frame';
import type { FrameGrid } from '../frameGrid';
import type { Dept } from '../zones';

/**
 * A bay layout's part (SHIPGEN_V4, "Ship recipes and layout parts"): one piece of layout as hooks the pipeline calls. A
 * recipe without the part never reaches its code. (PROTOTYPE, #581: the lane's frame, bays and paint are still the
 * frame's own, `Frame.lane`.)
 */
export interface BayPart {
  /** The room program's rules this part sets (the recipe's own over them). */
  program?: ProgramRules;
  /** Frame: the cross corridor's first column (-1 for none), in place of the hull's widest flat stretch. */
  dock?: (s: DockSite) => number;
  /** Frame: columns [x0, x1] the part takes for rooms of its own, no bay there (null: the hull has no room for them). */
  skip?: (s: DockSite) => [number, number] | null;
  /** Fixed: the cabins the part's own rooms hold (the plan's cabin blocks go there, not on bays). */
  cabins?: (fr: Frame) => number;
  /** Paint: its own rooms and halls, over the closed frame (`beds`: the plan's cabin beds). */
  paint?: (fr: Frame, fg: FrameGrid, beds: number) => void;
  /** Zones: the bays the forward departments are cut over, and every other bay's department. */
  zones?: { forward: (b: Bay, fr: Frame) => boolean; other: (b: Bay, k: number, z: ZoneCtx) => Dept };
  /** Fixed: the bays the single-cabin strip takes, in order, for `beds` beds (both sides). */
  strip?: (g: BayGeo, beds: number) => number[];
  /** Fixed: where the mounts (each gun pair, then the point-defence pair) go, one bay each, tried in turn; and flight ops' bays. */
  mounts?: (g: BayGeo, mounts: number) => { at: number[]; flight: number }[];
}

/** What a dock rule sees of the frame being built. */
export interface DockSite { xBand: number; xS: number; CW: number; depth: (x: number) => number; flat: (x: number) => boolean }

/** Zoning a bay outside the forward cut: the bays the guns are fixed in, flight ops' count, and a counter it may keep. */
export interface ZoneCtx { weapons: ReadonlySet<number>; flight: number; out: { n: number } }

/** The bays and the asks a part's hooks make of them. */
export interface BayGeo { fr: Frame; bays: readonly Bay[]; minDepth: (i: number, j: number) => number; joined: (k: number) => boolean }

/** Single cabins along bays `ks`, a cabin to four columns, run on across joined bays: each run's bays [i, j) and cabins. */
export function cutStrip(g: BayGeo, ks: readonly number[], need: number): { i: number; j: number; c: number }[] {
  const bay = (k: number): Bay => g.bays[k] as Bay;
  const cap = (i: number, j: number): number => Math.max(1, Math.floor((bay(j - 1).x1 - bay(i).x0) / 4));
  const got: { i: number; j: number; c: number }[] = [];
  for (let m = 0; m < ks.length && need > 0; ) {
    const i = ks[m] as number;
    let j = i + 1;
    while (cap(i, j) < need && ks[m + 1] === j && g.joined(j - 1)) { j++; m++; }
    m++;
    const c = Math.min(need, cap(i, j));
    got.push({ i, j, c }); need -= c;
  }
  return got;
}

/** Cabins bays `ks` hold. */
export const stripRoom = (g: BayGeo, ks: readonly number[]): number => cutStrip(g, ks, 999).reduce((t, r) => t + r.c, 0);
