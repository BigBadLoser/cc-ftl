import type { Faction } from '../combat/components';
import { AllegianceC, EquipC } from '../fight/components';
import { wontDo } from './wontDo';

import { CoreLinkC } from '../robots/components';
import type { Sim } from '../sim';
import { CREW_MAX_HP } from '../tuning';
import { ensurePerson } from './bonds';
import { CrewC, HealthC, NeedsC, PathC, PositionC, PrioritiesC } from './components';
import type { RolledCrew } from './roll';
import { RolledSkillsC, TraitsC, traitMult } from './traits';
import { BackgroundC, InterestsC, WONT_DO_CATEGORY, WontDoC } from './background';
import { defaultPriorities } from './profile';
import { WONT_DO_WHY, blockWork } from './workBlock';

/**
 * Create one crew member of a role on a tile. The species comes from the role (default human). `name` defaults to a
 * random pool name, or `<designation>-NNN` for species that have one. Core-linked species spawned for the rogue
 * faction are tied to the AI core of `shipId` (CoreLinkC). `rolled` (crew/roll.ts) supplies the name, appearance, rest,
 * skills and traits instead of `sim.rng`. Returns the id, or 0 for an unknown role or species.
 */
export function createCrew(
  sim: Sim, shipId: number, roleId: string, tile: { x: number; y: number },
  opts: { faction: Faction; rest?: number; name?: string; rolled?: RolledCrew },
): number {
  const role = sim.content.roles[roleId];
  const speciesId = role?.species ?? 'species.human';
  const species = sim.content.species[speciesId];
  if (!role || !species) return 0;
  const rolled = opts.rolled;
  const name = opts.name ?? rolled?.name ?? (species.designation
    ? `${species.designation}-${String(sim.rng.int(0, 999)).padStart(3, '0')}`
    : (sim.content.crewNames[sim.rng.int(0, Math.max(0, sim.content.crewNames.length - 1))] ?? 'Crew'));
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name, role: roleId, species: speciesId, appearanceSeed: rolled ? rolled.appearanceSeed : sim.rng.int(0, 0x7fffffff), activity: 'idle' });
  if (opts.faction === 'player') ensurePerson(sim, id); // other sides get an identity when they join the player's crew (the bond pass)
  sim.world.add(id, PositionC, { x: tile.x, y: tile.y, toX: tile.x, toY: tile.y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...role.priorities });
  // Species without rest decay (robots) keep a full Needs record: the decision system reads it, nothing drains it.
  sim.world.add(id, NeedsC, {
    rest: species.restDecay > 0 ? opts.rest ?? rolled?.rest ?? sim.rng.int(60, 100) : 100, ...(species.charge ? { charge: 100 } : {}),
  });
  if (rolled?.skills) sim.world.add(id, RolledSkillsC, { skills: { ...rolled.skills } });
  if (rolled?.traits.length) sim.world.add(id, TraitsC, { ids: [...rolled.traits] });
  if (rolled?.background) {
    // A person with a background (docs/TRAITS.md 10.5-10.10): interests, won't-do as permanent work blocks, priorities from their skills.
    sim.world.add(id, BackgroundC, { ...rolled.background });
    const interests = rolled.interests ?? { keen: [], passionate: [] };
    sim.world.add(id, InterestsC, { keen: [...interests.keen], passionate: [...interests.passionate] });
    sim.world.add(id, PrioritiesC, defaultPriorities(rolled.skills ?? {}, interests, rolled.wontDo));
  }
  if (rolled?.wontDo?.length) {
    sim.world.add(id, WontDoC, { ids: [...rolled.wontDo] });
    for (const w of rolled.wontDo) {
      const cat = WONT_DO_CATEGORY[w];
      if (cat) blockWork(sim, id, cat, WONT_DO_WHY);
    }
  }
  if (opts.faction === 'player') issueKit(sim, id);
  const hp = Math.round((species.maxHp ?? CREW_MAX_HP) * traitMult(sim, id, 'maxHpMult'));
  sim.world.add(id, HealthC, { hp, max: hp });
  sim.world.add(id, AllegianceC, { faction: opts.faction });
  if (species.coreLinked && opts.faction === 'rogue') sim.world.add(id, CoreLinkC, { ship: shipId, faction: 'rogue' });
  return id;
}

/**
 * Personal kit (docs/TRAITS.md 10.9): a person joining the player's crew (spawned, hired) carries their species' sidearm when they hold
 * nothing, unless they won't fight. Robots and other kinds arm by their `loadout`.
 */
export function issueKit(sim: Sim, id: number): void {
  const species = sim.content.species[sim.world.get(id, CrewC)?.species ?? ''];
  const kit = species?.mood ? species.kit : undefined;
  if (!kit || !sim.content.items[kit]?.hand || sim.world.get(id, EquipC)?.weapon || wontDo(sim, id, 'violence')) return;
  sim.world.add(id, EquipC, { weapon: kit });
}
