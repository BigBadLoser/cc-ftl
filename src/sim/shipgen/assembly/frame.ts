import { dockSpec, engineSpec, type RoomSpec, type ShipPlan } from '../plan';
/** A scaled silhouette about its axis: `inside(x, y)` with y = 0 the axis. */
export interface Mask {
  W: number; H: number; inside: (x: number, y: number) => boolean;
  /** The silhouette's scale along and across, where it was scaled from one. */ scale?: [number, number];
  /** Gun sites' blister columns [x0, x1), scaled (prototype). */ sites?: [number, number][];
  /** PROTOTYPE (#581): a gun battery on a maintenance corridor along the hull: its columns [a, b), its guns' blisters, its gun rooms' floor rows, and the airlock's first column (the dock). */
  battery?: { a: number; b: number; guns: [number, number][]; rows: number; air: number; /** Sites whose column holds a second gun inboard. */ inner: number[] };
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

/**
 * A run of bays' rows: out from a hall whose middle row is `c` (the spine's 0, a side corridor's), towards the hull
 * (`dir` 1) or the axis (-1, a carrier's lane side), and the floor rows a room has there per column.
 */
export interface Row { c: number; dir: 1 | -1; depth: (x: number) => number }

/**
 * PROTOTYPE (#581): a carrier's launch lane, open out of the stern from its head: the hangar between the cross corridor
 * and the lane's head, a corridor down each side hull (its middle row `yc`) to its engine room, rooms outboard of it and,
 * inboard (between it and the lane): a room's depth with `both`, else a strip of small rooms. `edge(x)` is the side
 * hull's first row beside the lane. The airlocks are in the lane's walls, evenly spaced along the side hulls (`docks`,
 * their first columns), opening onto the side corridors: two a side, one where the hull steps in aft (`taper`).
 */
export interface Lane { head: number; yc: number; both: boolean; edge: (x: number) => number; taper: boolean; docks: number[] }

/** Side-hull rows a lane hull needs, its edge to its top (most of its length): deep rooms inboard of the corridor, or a strip. */
const LANE_BOTH = 16, LANE_ONE = 13;
/** Floor rows of the strip of rooms between a side corridor and the lane, where it has no deeper rooms there. */
const STRIP = 3;
/** The hangar's columns, as near this as the cross corridor finds a flat stretch for its airlocks. */
const HANGAR = [12, 11, 13, 10, 14, 9, 15];

export interface Frame {
  W: number; H: number; inside: (x: number, y: number) => boolean;
  /** The silhouette's scale along and across, where it was scaled from one. */ scale?: [number, number];
  /** The hull's last inside row above the axis at a column; floor rows out from the spine there. */
  top: (x: number) => number; depth: (x: number) => number;
  /** The hull's last inside row above the axis at a column, the axis open or not (a lane). */ outer: (x: number) => number;
  /** The stern's first column past the band; the deepest stern column; engine rows a side and the rows they take. */
  xS: number; xEnd: number; sternMax: number; perSide: number; used: number; engine: RoomSpec;
  /** The bridge's end column; the band's first column. */
  xBr: number; xBand: number;
  /** The cross corridor's width and its first column (the dock). */
  CW: number; dockAt: number;
  /** PROTOTYPE (#581): the battery's maintenance corridor, its row out from the axis per column (rooms stop short of it). */
  maint?: { a: number; b: number; guns: [number, number][]; rows: number; inner: number[]; hallY: (x: number) => number };
  lane?: Lane;
  /** PROTOTYPE (#581): passenger decks aft of the airlocks (`BayLayout.decks`). */
  decks?: boolean;
  /** The mask's tiles (counted where the drive is sized by the hull). */
  area: number;
}

/** A finished hull's area against its mask's, at most (`thinHull`, `dropIslands`). */
const HULL_OF_MASK = 0.93;

/**
 * With `carry` (the hull tiles one engine carries), the drive holds the engines the hull's own size needs, not only the
 * plan's. With `gap`, its engines stand that many rows apart.
 */
export function outlineFrame(plan: ShipPlan, m: Mask, carry = 0, gap = 0, lane?: { both: boolean }, decks = false): Frame | null {
  const { W, H, inside } = m;
  if (2 * H + 4 > 120 || W + 4 > 240) return null;
  const top = (x: number): number => { let y = 0; while (inside(x, y + 1)) y++; return inside(x, 0) ? y : -1; };
  // A battery chains along the hull: a maintenance corridor two rows wide inside the hull links each gun room to the
  // next and to the dock, and each gun room's blister stands proud enough that its inner wall is the corridor's: one
  // flat wall row (`hallY`) the length of the battery, rooms on the spine stopping at it.
  const bt = m.battery, reg = bt ? top(bt.a) : 0;
  const hallY = (): number => reg - 3;
  const g0 = bt?.guns[0]?.[0] ?? 0, g1 = bt?.guns[bt.guns.length - 1]?.[1] ?? 0;
  const inBt = (x: number): boolean => !!bt && x >= g0 && x < g1 && !(x >= bt.air && x < bt.air + dockSpec().w);
  const depth = (x: number): number => (inBt(x) ? hallY() - 1 - BAND : top(x) - BAND - 1);
  const rowEnd = (y: number): number => { let x = W - 1; while (x > 0 && !inside(x, y)) x--; return x; };
  // (The hull's last row out at a column, where the axis is open: a lane.)
  const outer = (x: number): number => { let y = H; while (y > 0 && !inside(x, y)) y--; return y; };
  const ln = lane ? laneOf(m, outer, lane.both) : null;
  if (lane && !ln) return null;
  // Engines' first floor row: beside the spine, or beside a lane.
  const e0 = ln ? ln.edge(ln.head + 2) + 1 : BAND + 1;
  let xEnd = W - 1;
  while (xEnd > 0 && !inside(xEnd, ln ? e0 : 0)) xEnd--;

  // Engines claim the aft hull: out from the spine, each run of rows sharing an aft wall (a row beside one reaching
  // further aft has wall, not space, behind its hull tile) takes the engines it is deep enough for, a walk column ahead.
  const one = engineSpec(1, 'w', plan.kit);
  // (A lane hull's side corridor ends at its engine room, so the room keeps its own walk column ahead of the engines.)
  const xS = Math.min(xEnd, rowEnd(-e0)) - one.w - (ln ? 2 : 1);
  if (ln) {
    const k = ln.taper ? 1 : 2, span = xS - ln.head - 1, CWd = dockSpec().w;
    ln.docks = Array.from({ length: k }, (_, i) => ln.head + 1 + Math.round((span * (i + 1)) / (k + 1)) - Math.floor(CWd / 2));
    // (An airlock needs a flat wall: the lane's edge the same across it and a column either side.)
    for (const d of ln.docks) for (let x = d - 1; x <= d + CWd; x++) if (ln.edge(x) !== ln.edge(d)) return null;
  }
  let sternMax = 0;
  for (let tx = xS + 1; tx <= xEnd; tx++) sternMax = Math.max(sternMax, ln ? outer(tx) - e0 : depth(tx));
  // Engines only in rows long enough for one, out to the first that is not (a flared stern's rows start partway along it).
  const long = (y: number): boolean => { const e = rowEnd(y); for (let x = e - one.w - 1; x <= e; x++) if (!inside(x, y)) return false; return true; };
  let deep = 0;
  // (A floor row has hull past it too, the hull's wall, as long: a diagonal's wall runs a tile further in.)
  while (deep < sternMax && long(-(e0 + deep)) && long(-(e0 + 1 + deep))) deep++;
  let tiles = 0;
  if (carry > 0) for (let y = -H; y <= H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) tiles++;
  // (The finished hull comes out 7-9% under its mask: its walls thinned and slivers dropped. Counted at the near end.)
  const need = Math.max(Math.ceil(plan.engines / 2), carry > 0 ? Math.ceil((HULL_OF_MASK * tiles) / carry / 2) : 0), most = Math.max(need, 3);
  let perSide = 0, used = 0;
  for (let r = 0; r < deep && perSide < most;) {
    let run = 1;
    while (r + run < deep && rowEnd(-(e0 + r + run)) === rowEnd(-(e0 + r))) run++;
    const end = rowEnd(-(e0 + r)), longer = (y: number): number => (rowEnd(y) > end ? 1 : 0);
    // (A row spare: the engines stacked wall to wall would stand in front of the room's door.)
    const k = Math.min(Math.floor((run - 1 - (r > 0 ? longer(-(e0 - 1 + r)) : 0) - longer(-(e0 + r + run)) + gap) / (one.h + gap)), most - perSide);
    if (k > 0) { perSide += k; used = r + run; }
    r += run;
  }
  if (perSide < need || perSide === 0) return null;
  const engine: RoomSpec = { ...engineSpec(perSide, 'w', plan.kit), ...(gap > 0 ? { h: perSide * (one.h + gap) - gap, gap } : {}) };

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
  // A lane hull's cross corridor stands a hangar's length ahead of the lane's head.
  if (ln) for (const h of HANGAR) { const x = ln.head - h - CW; if (x > xBand + MIN_DEPTH && flat(x)) { dockAt = x; break; } }
  // (Passenger decks: the forward section's aftmost flat stretch, by its shoulder down to the deck.)
  else if (decks) {
    let peak = 0;
    for (let x = xBand + MIN_DEPTH + 1; x <= xS - MIN_DEPTH - CW - 1; x++) {
      peak = Math.max(peak, depth(x));
      if (depth(x + CW) < peak - 1) { if (flat(x)) dockAt = x; break; }
      if (flat(x)) dockAt = x;
    }
  } else if (!bt) for (let x = xBand + MIN_DEPTH + 1; x <= Math.min(xS - MIN_DEPTH - CW - 1, xBand + 0.75 * (xS - xBand)); x++) if (flat(x) && (dockAt < 0 || depth(x) > depth(dockAt))) dockAt = x;
  if (dockAt < 0) return null;
  return { W, H, inside, top, outer, depth, area: tiles, xS, xEnd, sternMax, perSide, used, engine, xBr, xBand, CW, dockAt, ...(bt ? { maint: { a: g0, b: g1, guns: bt.guns, rows: bt.rows, inner: bt.inner, hallY } } : {}), ...(ln ? { lane: ln } : {}), ...(decks ? { decks } : {}) };
}

/**
 * The lane's head (its first column, past the hull's first third), its edge, and the side corridor's middle row: against
 * the lane, or with `both` a room's depth out from it (five floor rows inboard, at least), halfway to the hull where
 * deeper. Null where the side hull is too shallow for it over most of its length.
 */
function laneOf(m: Mask, outer: (x: number) => number, both: boolean): Lane | null {
  const { W, H, inside } = m;
  let head = Math.floor(W / 3);
  while (head < W && inside(head, 0)) head++;
  if (head >= W) return null;
  const edge = (x: number): number => { let y = 1; while (y <= H && !inside(x, y)) y++; return y; };
  let end = W - 1;
  while (end > head && outer(end) === 0) end--;
  // (Most of its length: an aft step may take the outboard rooms shallower.)
  const tops: number[] = [];
  for (let x = head; x < end - 12; x++) tops.push(outer(x));
  tops.sort((a, b) => a - b);
  const lh = edge(head + 2), t = tops[Math.floor(tops.length * 0.4)] ?? 0;
  if (t - lh < (both ? LANE_BOTH : LANE_ONE)) return null;
  // (Stepped in aft: the side hull ahead of the stern's last stretch shallower than most of it.)
  const taper = outer(end - 14) < t - 1;
  return { head, edge, both, taper, docks: [], yc: both ? Math.max(lh + 8, Math.round((lh + t) / 2)) : lh + STRIP + 3 };
}
