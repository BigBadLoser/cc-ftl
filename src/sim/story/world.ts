import { CrewC, DeadC } from '../crew/components';
import { ShipC } from '../combat/components';
import { AllegianceC, SurrenderedC } from '../fight/components';
import { ItemStackC, StorageC } from '../items/components';
import { storageCount } from '../items/storage';
import { ModuleC } from '../modules/components';
import type { SkillName } from '../registry';
import type { Sim } from '../sim';
import { stat } from '../stats';
import { ImplantsC } from './components';

/** Living, free crew on the player's side (anywhere: ships, shuttles). Ascending id. */
export function playerCrew(sim: Sim): number[] {
  return sim.world.query(CrewC, AllegianceC).filter(
    (id) => sim.world.get(id, AllegianceC)?.faction === 'player' && !sim.world.has(id, DeadC) && !sim.world.has(id, SurrenderedC),
  );
}

/** Grid ids of ships the player owns (active, disabled or prize; not wrecks). */
export function playerGrids(sim: Sim): Set<number> {
  const out = new Set<number>();
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (s?.faction === 'player' && s.state !== 'wreck') out.add(s.gridId);
  }
  return out;
}

/** Module entity ids of a def on player ships. */
export function playerModules(sim: Sim, def?: string): number[] {
  const grids = playerGrids(sim);
  return sim.world.query(ModuleC).filter((id) => {
    const m = sim.world.get(id, ModuleC);
    return !!m && grids.has(m.gridId) && (def === undefined || m.def === def);
  });
}

/** Storage modules on player ships, ascending id. */
export function playerStorages(sim: Sim): number[] {
  const grids = playerGrids(sim);
  return sim.world.query(StorageC, ModuleC).filter((id) => grids.has(sim.world.get(id, ModuleC)?.gridId ?? -1));
}

export function skillOf(sim: Sim, crew: number, skill: SkillName): number {
  try {
    return stat(sim, crew, skill);
  } catch {
    return 0;
  }
}

/** The crew member with the highest skill (ties: lowest id), or null with no crew. */
export function bestAt(sim: Sim, skill: SkillName): { crew: number; level: number } | null {
  let best: { crew: number; level: number } | null = null;
  for (const id of playerCrew(sim)) {
    const level = skillOf(sim, id, skill);
    if (!best || level > best.level) best = { crew: id, level };
  }
  return best;
}

export const hasImplant = (sim: Sim, crew: number, implant: string): boolean => !!sim.world.get(crew, ImplantsC)?.list.includes(implant);

/** Units of an item on player ships only: their storage modules plus loose stacks. Other ships' stock never counts. */
export function playerStock(sim: Sim, item: string): number {
  let n = 0;
  for (const id of playerStorages(sim)) n += storageCount(sim, id, item);
  const grids = playerGrids(sim);
  for (const id of sim.world.query(ItemStackC)) {
    const s = sim.world.get(id, ItemStackC);
    if (s?.item === item && grids.has(s.gridId)) n += s.count;
  }
  return n;
}
