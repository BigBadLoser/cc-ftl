import type { Rng } from '../../rng';
import { allRooms, dockSpec, type RoomSpec, type ShipPlan } from '../plan';
import { reactorOf, reactorRooms } from '../stationKit';

/**
 * The functional plan of a trading station (docs/STATIONGEN2.md sections 3.1 and 3.2): the station plan's rooms
 * regrouped into departments of facilities, each with a size range and a shape, and each department with the floor it
 * needs. The department list is fixed for trading for now (no archetype transforms).
 *   harbour      docks on a hull face, the harbour hall behind them, the customs post (the one door to public space),
 *                the dock office (the station's bridge)
 *   freight      the warehouse holds, opening onto the harbour hall
 *   engineering  reactors, shields and the AI core, behind one guard post
 *   defence      the gun bays, on a gun deck of their own
 *   habitation   one-bed cabins, a lounge and the medbay, away from the harbour and engineering
 *   market       shops and the mess, by the court
 */

export type DeptId = 'harbour' | 'harbour2' | 'freight' | 'engineering' | 'defence' | 'habitation' | 'market';

export interface Facility {
  spec: RoomSpec;
  /** rect: must be a rectangle (designs, aisles, docks); soft: any shape. */
  shape: 'rect' | 'soft';
  /** Narrowest side allowed. */
  minSide: number;
  area: { min: number; target: number; max: number };
}

export interface Dept {
  id: DeptId;
  facilities: Facility[];
  /** Floor the department needs, walls and its own circulation included. */
  need: number;
  /** Natural depth of its parcel (across, wall to wall) off one public face: what its strategy lays out best in. */
  minDepth: number;
  /** Natural depth between two public faces (a row facing each), where that differs. */
  depth2?: number;
  /** Its largest rectangular room with walls, [short side, long side]: on a ring away from the axes it stands askew to the band and needs more depth. */
  rect?: [number, number];
  /** A harbour's dock count and face. */
  docks?: number;
  /** Front (along the corridor) a row department needs for one row of its units: cabins, shops. */
  front?: number;
}

const fac = (spec: RoomSpec, shape: 'rect' | 'soft', minSide = 2): Facility => {
  const a = spec.w * spec.h;
  return { spec, shape, minSide, area: { min: Math.round(a * (shape === 'rect' ? 1 : 0.7)), target: a, max: Math.round(a * (shape === 'rect' ? 1 : 1.6)) } };
};
const gross = (fs: Facility[]): number => fs.reduce((t, f) => t + (f.spec.w + 1) * (f.spec.h + 1), 0);

/** Floor of one cabin with its walls (three wide, four deep inside). */
export const CABIN_GROSS = 20;

export function program(rng: Rng, plan: ShipPlan, docksPer: number[]): Dept[] {
  const rooms = allRooms(plan);
  const of = (role: string): RoomSpec[] => rooms.filter((r) => r.role === role);
  const arms = of('armoury');
  const guardSpec = (base?: RoomSpec): RoomSpec => ({ role: 'armoury', mods: ['module.storage_locker', 'module.storage_locker'], w: 5, h: 3, stock: true, pinned: true, ...(base?.items ? { items: base.items } : {}) });
  const depts: Dept[] = [];
  docksPer.forEach((n, h) => {
    const customs = h === 0 && arms[0] ? { ...arms[0], pinned: true } : guardSpec(arms[0]);
    const fs = [
      ...Array.from({ length: n }, () => fac(dockSpec(), 'rect', 3)),
      fac(customs, 'soft', 3),
      ...(h === 0 ? [fac({ ...plan.command, pinned: true }, 'soft', 4)] : []),
    ];
    // Docks four wide each; behind them the hall (three deep) and the hull row.
    depts.push({ id: h === 0 ? 'harbour' : 'harbour2', facilities: fs, need: n * 4 * 8 + gross(fs.slice(n)) + 12, minDepth: 9, docks: n });
  });
  const cargo = of('cargo');
  const crates = cargo.flatMap((r) => r.mods);
  const holdArea = cargo.reduce((t, r) => t + r.w * r.h, 0);
  // One hold for every 24 crates; the strategy sizes them to its parcel.
  const holds = Math.max(1, Math.ceil(crates.length / 24));
  const hold = (i: number): RoomSpec => {
    const mods = crates.filter((_, j) => j % holds === i);
    const h = 6, w = Math.max(6, Math.round(holdArea / holds / h));
    return { role: 'cargo', mods, w, h, stock: true, warehouse: true, items: cargo.flatMap((r) => r.items ?? []) };
  };
  const freight = Array.from({ length: holds }, (_, i) => fac(hold(i), 'rect', 5));
  for (const f of freight) if (f.spec.items?.length === 0) delete f.spec.items;
  depts.push({ id: 'freight', facilities: freight, need: Math.round(gross(freight) * 1.2), minDepth: 10 });
  const machines = [...reactorRooms(plan.reactors, reactorOf(plan)), ...plan.shields, ...(plan.core ? [plan.core] : [])];
  const eng = [...machines.map((r) => fac(r, 'rect', 3)), fac(arms[1] ? { ...arms[1], pinned: true } : guardSpec(arms[0]), 'soft', 3)];
  // Machine rooms stand in one row behind the service aisle: the parcel is as deep as the deepest room (on its short
  // side) plus the aisle and walls, and as long as the rooms side by side (each on its short side where the depth allows).
  const deep = Math.max(...machines.map((r) => Math.min(r.w, r.h)));
  const along = machines.reduce((t, r) => t + (Math.max(r.w, r.h) <= deep ? Math.min(r.w, r.h) : Math.max(r.w, r.h)) + 1, 0) + 6;
  const big = (rs: RoomSpec[]): [number, number] => {
    const r = rs.reduce((b, x) => (x.w * x.h > b.w * b.h ? x : b));
    return [Math.min(r.w, r.h) + 2, Math.max(r.w, r.h) + 2];
  };
  // Demand: the strip the row of rooms and the aisle take (rooms at their size with walls, the aisle, the guard post).
  depts.push({ id: 'engineering', facilities: eng, need: Math.round(along * (deep + 6) * 1.05), minDepth: deep + 6, rect: big(machines) });
  // Gun bays (roof turrets: any clear roof) stand on their own gun deck, a rect row off a short corridor.
  const bays = [...plan.weapons, ...plan.pd];
  if (bays.length > 0) {
    const bd = Math.max(...bays.map((r) => Math.min(r.w, r.h)));
    const bl = bays.reduce((t, r) => t + Math.max(r.w, r.h) + 1, 0) + 4;
    const fs = bays.map((r) => fac(r, 'rect', 3));
    depts.push({ id: 'defence', facilities: fs, need: Math.round(bl * (bd + 6) * 1.05), minDepth: bd + 6, rect: big(bays) });
  }
  const quarters = of('quarters');
  const beds = quarters.reduce((t, r) => t + r.mods.filter((m) => m === 'module.bed').length, 0);
  const ls = quarters.flatMap((r) => r.mods.filter((m) => m !== 'module.bed'));
  const messes = of('support');
  const lounge: RoomSpec = messes[1] ? { ...messes[1], mods: [...messes[1].mods, ...ls] } : { role: 'support', mods: ls, w: 6, h: 4 };
  const cots = Math.min(4, Math.max(1, Math.ceil(plan.crew.length / 8)));
  const hab = [
    ...Array.from({ length: beds }, () => fac({ role: 'quarters', mods: ['module.bed'], w: 3, h: 4, cabin: true }, 'soft', 2)),
    fac(lounge, 'soft', 3),
    fac({ role: 'medbay', mods: Array<string>(cots).fill('module.med_bed'), w: 2 * cots + 1, h: 4, pinned: true }, 'soft', 3),
    ...messes.slice(2).map((m) => fac(m, 'soft', 3)),
  ];
  depts.push({ id: 'habitation', facilities: hab, need: Math.round((beds * CABIN_GROSS + gross(hab.slice(beds))) * 1.15), minDepth: 6, depth2: 11, front: beds * 4 + hab.slice(beds).reduce((t, f) => t + Math.max(6, (f.spec.w * f.spec.h) / 3), 0) + 4 });
  const shops = rng.int(3, 6);
  const market = [
    ...(messes[0] ? [fac(messes[0], 'soft', 3)] : []),
    ...Array.from({ length: shops }, () => fac({ role: 'shop', mods: [], w: 3, h: 4 }, 'soft', 3)),
  ];
  depts.push({ id: 'market', facilities: market, need: Math.round(gross(market) * 1.1), minDepth: 6, front: shops * 4.5 + (messes[0] ? 9 : 0) + 3 });
  return depts;
}
