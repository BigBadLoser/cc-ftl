import { hasTrait } from '../../crew/traits';
import type { World } from '../../ecs';
import { ModuleC, type Module } from '../../modules/components';
import type { ModuleDef, SeatKind } from '../../registry';
import { rotateOffset } from '../../modules/footprint';
import { isTileWalkable } from '../../modules/walk';
import { shipGrid, shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { LEISURE_LEAN_TILES } from '../../tuning';
import { TaskC } from '../components';

/**
 * Leisure spots (`ModuleDef.leisure`: the game table and the arcade). A spot is a module with one stand tile per crew member it takes at once
 * (the table 2, the arcade 1). The reservation is the break itself: a crew member on the leisure machine with `bb.target` = the module and
 * `bb.tile` = their stand tile holds that tile from the moment they set off, so nobody else picks it. Nothing is stored on the module.
 */

export interface PlaySpot {
  module: number;
  kind: 'social' | 'solo';
  /** A free stand tile. */
  stand: { x: number; y: number };
}

/** World stand tiles of a placed leisure module, in the order of its def's `stand` (the first is the front stool of the game table). */
export function standTilesOf(m: Module, def: ModuleDef): { x: number; y: number }[] {
  return (def.leisure?.stand ?? []).map(([dx, dy]) => {
    const o = rotateOffset(def, m.rot, dx, dy);
    return { x: m.x + o.x, y: m.y + o.y };
  });
}

/** `standTilesOf` for a module entity (none for a missing one or one that is no leisure spot). */
export function standTiles(sim: Sim, module: number): { x: number; y: number }[] {
  const m = sim.world.get(module, ModuleC);
  const def = m && sim.content.modules[m.def];
  return m && def ? standTilesOf(m, def) : [];
}

/**
 * Which stand tile of a social spot (the game table) crew member `id` sits on right now, or -1: they are resting on a break at it, settled on the tile.
 * The art seats players on its stools (render/crewView.ts) when the spot has a `leisure.seat`, which also names the crew clip (SEAT_CLIP);
 * a spot without one (the arcade) is played standing.
 */
export function seatIndex(world: World, modules: Readonly<Record<string, ModuleDef>>, id: number, x: number, y: number): { m: Module; def: ModuleDef; index: number; seat: SeatKind } | null {
  const t = world.get(id, TaskC);
  const m = t?.machine === 'leisure' && t.state === 'Relax' && t.bb.target ? world.get(t.bb.target, ModuleC) : undefined;
  const def = m && modules[m.def];
  if (!m || !def?.leisure?.seat) return null;
  const index = standTilesOf(m, def).findIndex((s) => s.x === x && s.y === y);
  return index < 0 ? null : { m, def, index, seat: def.leisure.seat };
}

/** Stand tiles held by crew other than `except` on a break at a spot: "module:x,y". */
function held(world: World, except: number): Set<string> {
  const out = new Set<string>();
  for (const id of world.query(TaskC)) {
    const t = world.get(id, TaskC);
    if (id !== except && t?.machine === 'leisure' && t.bb.target && t.bb.tile) out.add(`${t.bb.target}:${t.bb.tile.x},${t.bb.tile.y}`);
  }
  return out;
}

/** A leisure module that can be used: placed on this ship, switched on, powered and whole. */
function usable(sim: Sim, module: number, ship: number): boolean {
  const m = sim.world.get(module, ModuleC);
  const def = m && sim.content.modules[m.def];
  return !!m && !!def?.leisure && m.enabled && m.powered && m.hp > 0 && shipIdOf(sim, m) === ship;
}

/** Every free stand tile of every usable leisure module on a ship, for crew member `id` (their own held tile counts as free). */
export function freeSpots(sim: Sim, id: number, ship: number): PlaySpot[] {
  const taken = held(sim.world, id);
  const grid = shipGrid(sim, ship);
  if (!grid) return [];
  const out: PlaySpot[] = [];
  for (const module of sim.world.query(ModuleC)) {
    if (!usable(sim, module, ship)) continue;
    const kind = sim.content.modules[(sim.world.get(module, ModuleC) as { def: string }).def]?.leisure?.kind as 'social' | 'solo';
    for (const stand of standTiles(sim, module)) if (!taken.has(`${module}:${stand.x},${stand.y}`) && grid.inBounds(stand.x, stand.y) && isTileWalkable(sim, grid, stand.x, stand.y)) out.push({ module, kind, stand });
  }
  return out;
}

/** Tiles of walking a spot of this kind is worth to a crew member: a social one likes company (`trait.social`), a loner a spot of their own; the other trait feels the opposite. */
export function leisureLean(sim: Sim, id: number, kind: 'social' | 'solo'): number {
  const social = hasTrait(sim, id, 'trait.social'), loner = hasTrait(sim, id, 'trait.loner');
  if (!social && !loner) return 0;
  return (kind === 'social') === social ? LEISURE_LEAN_TILES : -LEISURE_LEAN_TILES / 2;
}

/** Leisure modules in use right now (a crew member settled on a stand tile, resting): module id -> how many. The art shows these active. */
export function playingAt(world: World): Map<number, number> {
  const out = new Map<number, number>();
  for (const id of world.query(TaskC)) {
    const t = world.get(id, TaskC);
    if (t?.machine === 'leisure' && t.state === 'Relax' && t.bb.target) out.set(t.bb.target, (out.get(t.bb.target) ?? 0) + 1);
  }
  return out;
}
