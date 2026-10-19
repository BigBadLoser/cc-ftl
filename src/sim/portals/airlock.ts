import type { Grid } from '../grid';
import { hullOutward, hullSide, rotateOffset, type Tile } from '../modules/footprint';
import { ModuleC, type Module } from '../modules/components';
import type { ModuleDef } from '../registry';
import type { Sim } from '../sim';
import { Struct, writeStruct } from '../structure';
import { AirlockC, type Airlock } from './components';

/**
 * Airlock geometry. A module with `airlock` has `hullEdge: 'n'`. Plain form: footprint [1, n] (n >= 3), local row 0 the outer
 * door, the last row the inner door, rows between the chamber. With `airlock.layout` (the docking airlock) the roles come from
 * the layout: the pod is the inner door, the hull tile the outer door, and the collar lies outside the footprint.
 */
export interface AirlockTiles {
  outer: Tile;
  inner: Tile;
  chamber: Tile[];
  /** The ship tile just inside the inner door. */
  inside: Tile;
  /** The docking collar tile, one tile past the hull row (null for a plain airlock). */
  collar: Tile | null;
  /** Cargo unloaders: solid body tiles, the chute tile, and the keep-out tile crew stand on to work it. */
  unloaders: { tiles: Tile[]; chute: Tile; stand: Tile }[];
}

export function airlockTiles(def: ModuleDef, m: Pick<Module, 'x' | 'y' | 'rot'>): AirlockTiles {
  const at = (col: number, row: number): Tile => {
    const o = rotateOffset(def, m.rot, col, row);
    return { x: m.x + o.x, y: m.y + o.y };
  };
  const layout = def.airlock?.layout;
  if (layout) {
    return {
      outer: at(...layout.outer), inner: at(...layout.inner), chamber: [], inside: at(...layout.inside), collar: at(...layout.collar),
      unloaders: layout.unloaders.map((u) => ({ tiles: u.tiles.map((t) => at(...t)), chute: at(...u.chute), stand: at(...u.stand) })),
    };
  }
  const rows = def.footprint[1];
  const out = hullOutward(hullSide(def, m.rot) ?? 'n');
  const inner = at(0, rows - 1);
  return {
    outer: at(0, 0),
    inner,
    chamber: Array.from({ length: rows - 2 }, (_, i) => at(0, i + 1)),
    inside: { x: inner.x - out.x, y: inner.y - out.y },
    collar: null,
    unloaders: [],
  };
}

/** Tiles where the airlock's unloaders hand cargo over: the keep-out tiles crew stand on. */
export function keepOutTiles(def: ModuleDef, m: Pick<Module, 'x' | 'y' | 'rot'>): Tile[] {
  return airlockTiles(def, m).unloaders.map((u) => u.stand);
}

/** Make a freshly spawned airlock module's tiles real: outer and inner doors, floor chamber. */
export function initAirlock(sim: Sim, grid: Grid, id: number): void {
  const m = sim.world.get(id, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def?.airlock) return;
  const t = airlockTiles(def, m);
  for (const d of [t.outer, t.inner]) writeStruct(grid, d.x, d.y, Struct.Door);
  for (const c of t.chamber) writeStruct(grid, c.x, c.y, Struct.Floor);
  grid.set('door', t.outer.x, t.outer.y, 0);
  grid.set('door', t.inner.x, t.inner.y, 255);
  sim.world.add(id, AirlockC, { state: 'inner', timer: 0, request: null, suits: def.airlock.suits ?? 0 });
}

/** Undo initAirlock when the module is removed: the outer door goes back to hull wall, the inner door to floor. */
export function dismantleAirlock(sim: Sim, grid: Grid, id: number): void {
  const m = sim.world.get(id, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def?.airlock) return;
  const t = airlockTiles(def, m);
  writeStruct(grid, t.outer.x, t.outer.y, Struct.Wall);
  writeStruct(grid, t.inner.x, t.inner.y, Struct.Floor);
  grid.set('door', t.outer.x, t.outer.y, 0);
  grid.set('door', t.inner.x, t.inner.y, 0);
}

/** True if the airlock module is enabled, intact and powered. */
export function airlockWorking(sim: Sim, id: number): boolean {
  const m = sim.world.get(id, ModuleC);
  return !!m && !!sim.world.has(id, AirlockC) && m.enabled && m.hp > 0 && m.powered;
}

/** The airlock whose outer or inner door is at (x, y), with which door it is. */
export function airlockDoorAt(sim: Sim, grid: Grid, x: number, y: number): { id: number; door: 'outer' | 'inner' } | null {
  if (!grid.has('module') || grid.get('struct', x, y) !== Struct.Door) return null;
  const id = grid.get('module', x, y);
  if (id === 0 || !sim.world.has(id, AirlockC)) return null;
  const m = sim.world.get(id, ModuleC) as Module;
  const def = sim.content.modules[m.def];
  if (!def?.airlock) return null;
  const t = airlockTiles(def, m);
  return t.outer.x === x && t.outer.y === y ? { id, door: 'outer' } : { id, door: 'inner' };
}

/** Ask an airlock to open a side. The airlock system acts on it when it is idle and the doorway is clear. */
export function requestAirlock(sim: Sim, id: number, side: 'inner' | 'outer'): void {
  const a = sim.world.get(id, AirlockC) as Airlock | undefined;
  if (a && a.state !== side) a.request = side;
}

/** Which side an idle airlock currently has open, else null (cycling). */
export function openSide(a: Airlock): 'inner' | 'outer' | null {
  return a.state === 'inner' || a.state === 'outer' ? a.state : null;
}
