
import type { Faction } from '../combat/components';
import { CrewC, PositionC, type Position } from '../crew/components';
import { ModuleC } from '../modules/components';
import type { SpeciesDef } from '../registry';
import type { Sim } from '../sim';
import { HackedC, InertC, StunC } from './components';
import { shipIdOf } from '../regions';
import { shipById } from '../combat/ships';

/** The species def of a crew member, if known. */
export function speciesOf(sim: Sim, crew: number): SpeciesDef | undefined {
  const c = sim.world.get(crew, CrewC);
  return c ? sim.content.species[c.species] : undefined;
}

/** AI core modules on a grid, ascending ids. */
export function aiCores(sim: Sim, shipId: number): number[] {
  return sim.world.query(ModuleC).filter((id) => {
    const m = sim.world.get(id, ModuleC);
    return !!m && shipIdOf(sim, m) === shipId && !!sim.content.modules[m.def]?.aiCore;
  });
}

/** A core that can run things: intact, powered this tick (so enabled and not ion-disabled) and not hacked. */
export function isCoreLive(sim: Sim, id: number): boolean {
  const m = sim.world.get(id, ModuleC);
  return !!m && m.hp > 0 && m.powered && !sim.world.has(id, HackedC);
}

/** True if the ship on `shipId` belongs to `faction` (any if omitted) and has a live AI core. */
export function hasLiveCore(sim: Sim, shipId: number, faction?: Faction): boolean {
  const ship = shipById(sim, shipId);
  if (faction && ship?.faction !== faction) return false;
  return aiCores(sim, shipId).some((id) => isCoreLive(sim, id));
}

/** True while a robot is shut down (no live core) or stunned. */
export function isShutDown(sim: Sim, crew: number): boolean {
  return sim.world.has(crew, InertC) || sim.world.has(crew, StunC);
}

/** Stop where it stands: finish no step, keep the tile it is on. */
export function freeze(pos: Position): void {
  pos.toX = pos.x;
  pos.toY = pos.y;
  pos.progress = 0;
}

/** Crew on a grid, ascending ids. */
export function crewOnGrid(sim: Sim, shipId: number): number[] {
  return sim.world.query(CrewC, PositionC).filter((id) => shipIdOf(sim, sim.world.get(id, PositionC)) === shipId);
}

/** Damage fraction a crew member's body ignores (SpeciesDef.armor, 0..1). */
export function armorOf(sim: Sim, crew: number): number {
  return Math.min(1, Math.max(0, speciesOf(sim, crew)?.armor ?? 0));
}
