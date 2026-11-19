import { dockSpec, engineSpec, type RoomSpec, type ShipPlan } from '../plan';
/** A scaled silhouette about its axis: `inside(x, y)` with y = 0 the axis. */
export interface Mask {
  W: number; H: number; inside: (x: number, y: number) => boolean;
  /** Gun sites' blister columns [x0, x1), scaled (prototype). */ sites?: [number, number][];
  /** PROTOTYPE (#581): a gun battery on a maintenance corridor along the hull: its columns [a, b), its guns' blisters, its gun rooms' floor rows, and the airlock's first column (the dock). */
  battery?: { a: number; b: number; guns: [number, number][]; rows: number; air: number };
}

/**
 * The fixed frame of a navy outline both layouts build on (SHIPGEN_V4, "Room layout"): the drive's engine rows at the
 * stern, the bridge at the bow, the band between them, and the dock's cross corridor at the hull's widest flat stretch.
 * Null when the outline cannot hold them.
 */

/** Side rows out from the axis: the spine is rows -1..1, its wall row 2, room floor from row 3 (room row 1). */
export const BAND = 2;
/** Floor rows a room has at least, and so a tier. */
export const MIN_DEPTH = 3;

export interface Frame {
  W: number; H: number; inside: (x: number, y: number) => boolean;
  /** The hull's last inside row above the axis at a column; floor rows out from the spine there. */
  top: (x: number) => number; depth: (x: number) => number;
  /** The stern's first column past the band; the deepest stern column; engine rows a side and the rows they take. */
  xS: number; xEnd: number; sternMax: number; perSide: number; used: number; engine: RoomSpec;
  /** The bridge's end column; the band's first column. */
  xBr: number; xBand: number;
  /** The cross corridor's width and its first column (the dock). */
  CW: number; dockAt: number;
  /** PROTOTYPE (#581): the battery's maintenance corridor, its row out from the axis per column (rooms stop short of it). */
  maint?: { a: number; b: number; guns: [number, number][]; rows: number; hallY: (x: number) => number };
}

export function outlineFrame(plan: ShipPlan, m: Mask): Frame | null {
  const { W, H, inside } = m;
  if (2 * H + 4 > 120 || W + 4 > 240) return null;
  const top = (x: number): number => { let y = 0; while (inside(x, y + 1)) y++; return inside(x, 0) ? y : -1; };
  // A battery's maintenance corridor runs a row in from the hull, round each gun room (the gun on the hull, the
  // corridor inboard of it): rooms on the spine stop a wall short of it.
  const bt = m.battery, reg = bt ? top(bt.a) : 0;
  const hallY = (x: number): number => (bt?.guns.some(([s0, s1]) => x >= s0 - 1 && x <= s1) ? reg - bt.rows - 1 : reg - 1);
  const inBt = (x: number): boolean => !!bt && x >= bt.a && x < bt.b && !(x >= bt.air && x < bt.air + dockSpec().w);
  const depth = (x: number): number => (inBt(x) ? hallY(x) - 2 - BAND : top(x) - BAND - 1);
  const rowEnd = (y: number): number => { let x = W - 1; while (x > 0 && !inside(x, y)) x--; return x; };
  let xEnd = W - 1;
  while (xEnd > 0 && !inside(xEnd, 0)) xEnd--;

  // Engines claim the aft hull: out from the spine, each run of rows sharing an aft wall (a row beside one reaching
  // further aft has wall, not space, behind its hull tile) takes the engines it is deep enough for, a walk column ahead.
  const one = engineSpec(1, 'w', plan.kit);
  const xS = Math.min(xEnd, rowEnd(-(BAND + 1))) - one.w - 1;
  let sternMax = 0;
  for (let tx = xS + 1; tx <= xEnd; tx++) sternMax = Math.max(sternMax, depth(tx));
  const need = Math.ceil(plan.engines / 2), most = Math.max(need, 3);
  let perSide = 0, used = 0;
  for (let r = 0; r < sternMax && perSide < most;) {
    let run = 1;
    while (r + run < sternMax && rowEnd(-(BAND + 1 + r + run)) === rowEnd(-(BAND + 1 + r))) run++;
    const end = rowEnd(-(BAND + 1 + r)), longer = (y: number): number => (rowEnd(y) > end ? 1 : 0);
    const k = Math.min(Math.floor((run - (r > 0 ? longer(-(BAND + r)) : 0) - longer(-(BAND + 1 + r + run))) / one.h), most - perSide);
    if (k > 0) { perSide += k; used = r + run; }
    r += run;
  }
  if (perSide < need || perSide === 0) return null;
  const engine = engineSpec(perSide, 'w', plan.kit);

  // The bridge takes the bow, about twice its plan and at least four columns.
  const bridge = plan.command;
  let xBr = 0, area = 0;
  while (xBr < xS && (area < 2.6 * bridge.w * bridge.h || top(xBr) < 2 || xBr <= MIN_DEPTH + 1)) { area += Math.max(0, 2 * top(xBr) - 1); xBr++; }
  let xBand = xBr + 1;
  while (xBand < xS && depth(xBand) < 1) xBand++;
  if (xBand >= xS - 6) return null;
  // The cross corridor: out to the airlocks at the hull's widest flat stretch (an airlock needs a flat outer wall), in the
  // forward three quarters, leaving a room's length either side. Outer rooms elsewhere open into the room in front.
  const CW = dockSpec().w;
  const flat = (x0: number): boolean => {
    // (Beside a gun's blister, a plating column between, or clear of the battery: a room's width from every blister.)
    const st = m.sites ?? [];
    if (!st.some(([a, b]) => x0 === b + 1 || x0 + CW + 1 === a) && st.some(([a, b]) => x0 + CW + 1 >= a - 8 && x0 - 1 < b + 8)) return false;
    for (let k = -1; k <= CW; k++) if (top(x0 + k) !== top(x0)) return false;
    return true;
  };
  let dockAt = bt ? bt.air : -1;
  if (!bt) for (let x = xBand + MIN_DEPTH + 1; x <= Math.min(xS - MIN_DEPTH - CW - 1, xBand + 0.75 * (xS - xBand)); x++) if (flat(x) && (dockAt < 0 || depth(x) > depth(dockAt))) dockAt = x;
  if (dockAt < 0) return null;
  return { W, H, inside, top, depth, xS, xEnd, sternMax, perSide, used, engine, xBr, xBand, CW, dockAt, ...(bt ? { maint: { a: bt.a, b: bt.b, guns: bt.guns, rows: bt.rows, hallY } } : {}) };
}
