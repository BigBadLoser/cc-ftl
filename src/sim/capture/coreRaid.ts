import { ShipC } from '../combat/components';
import { CrewC, DeadC, PositionC, type Position } from '../crew/components';
import { defineComponent } from '../ecs';
import { AllegianceC } from '../fight/components';
import { isCombatReady } from '../fight/relations';
import { ModuleC, type Module } from '../modules/components';
import { rotatedSize } from '../modules/footprint';
import { removeModule } from '../modules/spawn';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { CORE_RAID_DEFENDER_RADIUS, CORE_RAID_HOLD_TICKS, CORE_RAID_RADIUS } from '../tuning';

/**
 * The zealots' raid on an AI core. Their boarders (`CoreRaiderC`, given when the party leaves its shuttle) walk to the core room instead of the
 * bridge (`coreObjective`). While they stand at a core and no defender of the ship does, `CoreRaidC` on the core module counts up; any defender near
 * it, or no raider, counts it back down faster. Held for CORE_RAID_HOLD_TICKS the core is torn out of the ship (the module is removed, not just
 * broken), so no repair brings it back; the robots it ran go inert on the next robot pass. A ship with no AI core gives the raiders nothing to
 * walk to: they board like anyone else.
 */
export interface CoreRaider {
  /** The zealot ship that sent the party. */
  from: number;
}
export const CoreRaiderC = defineComponent<CoreRaider>('coreRaider');

/** On an AI core module being held by raiders: ticks held so far. */
export interface CoreRaid {
  ticks: number;
}
export const CoreRaidC = defineComponent<CoreRaid>('coreRaid');

/** The footprint box of an AI core module (top-left tile and size). */
function boxOf(sim: Sim, m: Module): Box | null {
  const def = sim.content.modules[m.def];
  if (!def) return null;
  const [w, h] = rotatedSize(def, m.rot);
  return { x: m.x, y: m.y, w, h };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Is the position within `r` tiles (centre to centre) of the box? */
const nearBox = (pos: Position, b: Box, r: number): boolean => Math.hypot(pos.x - (b.x + (b.w - 1) / 2), pos.y - (b.y + (b.h - 1) / 2)) <= r;

/** Is the position on a tile beside the box (8-adjacent)? */
export const besideBox = (pos: Position, b: Box): boolean => Math.max(b.x - pos.x, 0, pos.x - (b.x + b.w - 1)) <= 1 && Math.max(b.y - pos.y, 0, pos.y - (b.y + b.h - 1)) <= 1;

/** The box of the nearest AI core of the ship (alive or not: a wrecked core can still be torn out), or null when it has none. Raiders walk to stand beside it. */
export function coreObjective(sim: Sim, shipId: number, from: Position): Box | null {
  let best: Box | null = null;
  let bestD = Infinity;
  for (const mid of sim.world.query(ModuleC)) {
    const m = sim.world.get(mid, ModuleC);
    if (!m || !sim.content.modules[m.def]?.aiCore || shipIdOf(sim, m) !== shipId) continue;
    const box = boxOf(sim, m);
    const d = box ? Math.hypot(box.x - from.x, box.y - from.y) : Infinity;
    if (box && d < bestD) {
      best = box;
      bestD = d;
    }
  }
  return best;
}

/** Hand the raid flag to the party that leaves for `target`'s ship (boardingAi.ts): the crew walk to its core once aboard. */
export function markRaiders(sim: Sim, crew: readonly number[], from: number): void {
  for (const c of crew) sim.world.add(c, CoreRaiderC, { from });
}

/** Is the crew member a live raider on the ship's grid? */
function raiderOn(sim: Sim, id: number, shipId: number): boolean {
  const pos = sim.world.get(id, PositionC);
  return !!pos && shipIdOf(sim, pos) === shipId && !sim.world.has(id, DeadC) && isCombatReady(sim, id);
}

/**
 * Count the holds. Runs late in the tick, before capture (pipeline.ts). Only ships of the player are raided: zealots do not tear cores out of anyone else's.
 */
export function coreRaidSystem(sim: Sim): void {
  const raiders = sim.world.query(CoreRaiderC, CrewC, PositionC);
  if (raiders.length === 0) {
    for (const id of sim.world.query(CoreRaidC)) sim.world.remove(id, CoreRaidC);
    return;
  }
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || !sim.content.modules[m.def]?.aiCore) continue;
    const shipId = shipIdOf(sim, m);
    if (sim.world.get(shipId, ShipC)?.faction !== 'player') continue;
    const box = boxOf(sim, m);
    if (!box) continue;
    const holding = raiders.some((r) => raiderOn(sim, r, shipId) && nearBox(sim.world.get(r, PositionC) as Position, box, CORE_RAID_RADIUS));
    const defended = sim.world.query(AllegianceC, PositionC).some((c) => {
      if (sim.world.get(c, AllegianceC)?.faction !== 'player' || !raiderOn(sim, c, shipId)) return false;
      return nearBox(sim.world.get(c, PositionC) as Position, box, CORE_RAID_DEFENDER_RADIUS);
    });
    const raid = sim.world.get(id, CoreRaidC);
    if (!raid) {
      if (holding && !defended) sim.world.add(id, CoreRaidC, { ticks: 1 });
      continue;
    }
    raid.ticks = holding && !defended ? raid.ticks + 1 : Math.max(0, raid.ticks - 2);
    if (raid.ticks === 0) sim.world.remove(id, CoreRaidC);
    else if (raid.ticks >= CORE_RAID_HOLD_TICKS) {
      removeModule(sim, id);
      sim.events.emit({ type: 'core.torn', ship: shipId });
    }
  }
}
