import type { Tile } from '../../crew/pathfind';
import { ModuleC, type Module } from '../../modules/components';
import { rotatedSize } from '../../modules/footprint';
import type { World } from '../../ecs';
import type { ModuleDef, SeatKind } from '../../registry';
import { shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { TaskC } from '../components';

/**
 * Seats (`ModuleDef.seats`: the bench). The owner of "where is seat i of this module", "which seats are free" and "is this crew member sitting".
 * A seat has no mood effect. The reservation is the sit task itself: a crew member on the `sit` machine with `bb.target` = the module and
 * `bb.n` = the seat index holds that seat from the moment they set off. Nothing is stored on the module. No drive sends crew to sit yet
 * (an idle one was tried and taken out); a drive that does sets that task, and any job found later replaces it (both states class `any`).
 */

/** Seats of a module in seat points: the sub-tile world position (tile centres are whole numbers) of each. */
export function seatPoints(def: ModuleDef, m: { x: number; y: number; rot: number }): { x: number; y: number }[] {
  const [w, d] = rotatedSize(def, m.rot);
  const cx = m.x + (w - 1) / 2, cy = m.y + (d - 1) / 2;
  return (def.seats?.at ?? []).map(([u, v]) => {
    // Local (u, v) to a grid offset by quarter turns, as rotateOffset turns tiles: r0 (u, v), r1 (-v, u), r2 (-u, -v), r3 (v, -u).
    const [dx, dy] = ([[u, v], [-v, u], [-u, -v], [v, -u]] as const)[m.rot % 4] as readonly [number, number];
    return { x: cx + dx, y: cy + dy };
  });
}

/** The footprint tile a seat belongs to (the one crew walk to): the tile its point rounds to, the larger one for a point on the edge between two. */
export function seatTile(def: ModuleDef, m: { x: number; y: number; rot: number }, i: number): Tile {
  const p = seatPoints(def, m)[i] as { x: number; y: number };
  const [w, d] = rotatedSize(def, m.rot);
  return { x: Math.min(m.x + w - 1, Math.max(m.x, Math.round(p.x))), y: Math.min(m.y + d - 1, Math.max(m.y, Math.round(p.y))) };
}

/** Seat indices of module `module` held by crew other than `except`. */
function held(world: World, module: number, except: number): Set<number> {
  const out = new Set<number>();
  for (const id of world.query(TaskC)) {
    const t = world.get(id, TaskC);
    if (id !== except && t?.machine === 'sit' && t.bb.target === module && t.bb.n !== undefined) out.add(t.bb.n);
  }
  return out;
}

/** A seated module that can be sat on: placed on this ship and whole. */
function usableSeats(sim: Sim, module: number, ship: number): boolean {
  const m = sim.world.get(module, ModuleC);
  return !!m && m.hp > 0 && !!sim.content.modules[m.def]?.seats && shipIdOf(sim, m) === ship;
}

/** Every free seat of every usable seated module on a ship, for crew member `id` (their own held seat counts as free). */
export function freeSeats(sim: Sim, id: number, ship: number): { module: number; index: number; tile: Tile }[] {
  const out: { module: number; index: number; tile: Tile }[] = [];
  for (const module of sim.world.query(ModuleC)) {
    if (!usableSeats(sim, module, ship)) continue;
    const m = sim.world.get(module, ModuleC) as Module;
    const def = sim.content.modules[m.def] as ModuleDef;
    const taken = held(sim.world, module, id);
    (def.seats?.at ?? []).forEach((_, index) => {
      if (!taken.has(index)) out.push({ module, index, tile: seatTile(def, m, index) });
    });
  }
  return out;
}

/** The seat crew member `id` is sitting on right now (the sit task settled in `Sit`), with its sub-tile point; null when not seated. The render reads this. */
export function seatedOn(world: World, modules: Readonly<Record<string, ModuleDef>>, id: number): { m: Module; def: ModuleDef; index: number; kind: SeatKind; x: number; y: number } | null {
  const t = world.get(id, TaskC);
  const m = t?.machine === 'sit' && t.state === 'Sit' && t.bb.target ? world.get(t.bb.target, ModuleC) : undefined;
  const def = m && modules[m.def];
  const p = m && def?.seats && t?.bb.n !== undefined ? seatPoints(def, m)[t.bb.n] : undefined;
  return m && def?.seats && p ? { m, def, index: t?.bb.n as number, kind: def.seats.kind, x: p.x, y: p.y } : null;
}
