import type { Faction } from '../combat/components';
import { AllegianceC } from '../fight/components';
import { CoreLinkC } from '../robots/components';
import type { Sim } from '../sim';
import { CREW_MAX_HP } from '../tuning';
import { CrewC, HealthC, NeedsC, PathC, PositionC, PrioritiesC } from './components';

/**
 * Create one crew member of a role on a tile. The species comes from the role (default human). `name` defaults to a
 * random pool name, or `<designation>-NNN` for species that have one. Core-linked species spawned for the rogue
 * faction are tied to the AI core of `gridId` (CoreLinkC). Returns the id, or 0 for an unknown role or species.
 */
export function createCrew(
  sim: Sim, gridId: number, roleId: string, tile: { x: number; y: number },
  opts: { faction: Faction; rest?: number; name?: string },
): number {
  const role = sim.content.roles[roleId];
  const speciesId = role?.species ?? 'species.human';
  const species = sim.content.species[speciesId];
  if (!role || !species) return 0;
  const name = opts.name ?? (species.designation
    ? `${species.designation}-${String(sim.rng.int(0, 999)).padStart(3, '0')}`
    : (sim.content.crewNames[sim.rng.int(0, Math.max(0, sim.content.crewNames.length - 1))] ?? 'Crew'));
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name, role: roleId, species: speciesId, appearanceSeed: sim.rng.int(0, 0x7fffffff), activity: 'idle' });
  sim.world.add(id, PositionC, { gridId, x: tile.x, y: tile.y, toX: tile.x, toY: tile.y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...role.priorities });
  // Species without rest decay (robots) keep a full Needs record: the decision system reads it, nothing drains it.
  sim.world.add(id, NeedsC, { rest: species.restDecay > 0 ? opts.rest ?? sim.rng.int(60, 100) : 100 });
  const hp = species.maxHp ?? CREW_MAX_HP;
  sim.world.add(id, HealthC, { hp, max: hp });
  sim.world.add(id, AllegianceC, { faction: opts.faction });
  if (species.coreLinked && opts.faction === 'rogue') sim.world.add(id, CoreLinkC, { gridId });
  return id;
}
