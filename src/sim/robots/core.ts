import { shipOf } from '../combat/ships';
import type { Faction } from '../combat/components';
import { CrewC, PositionC, type Position } from '../crew/components';
import { ModuleC } from '../modules/components';
import type { SpeciesDef } from '../registry';
import type { Sim } from '../sim';
import { HackedC, InertC, StunC } from './components';

/** The species def of a crew member, if known. */
export function speciesOf(sim: Sim, crew: number): SpeciesDef | undefined {
  const c = sim.world.get(crew, CrewC);
  return c ? sim.content.species[c.species] : undefined;
}

/** AI core modules on a grid, ascending ids. */
export function aiCores(sim: Sim, gridId: number): number[] {
  return sim.world.query(ModuleC).filter((id) => {
    const m = sim.world.get(id, ModuleC);
    return !!m && m.gridId === gridId && !!sim.content.modules[m.def]?.aiCore;
  });
}

/** A core that can run things: intact, powered this tick (so enabled and not ion-disabled) and not hacked. */
export function isCoreLive(sim: Sim, id: number): boolean {
  const m = sim.world.get(id, ModuleC);
  return !!m && m.hp > 0 && m.powered && !sim.world.has(id, HackedC);
}

/** True if the ship on `gridId` belongs to `faction` (any if omitted) and has a live AI core. */
export function hasLiveCore(sim: Sim, gridId: number, faction?: Faction): boolean {
  const ship = shipOf(sim, gridId);
  if (faction && ship?.faction !== faction) return false;
  return aiCores(sim, gridId).some((id) => isCoreLive(sim, id));
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
export function crewOnGrid(sim: Sim, gridId: number): number[] {
  return sim.world.query(CrewC, PositionC).filter((id) => sim.world.get(id, PositionC)?.gridId === gridId);
}
