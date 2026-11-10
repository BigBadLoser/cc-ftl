import type { RoleDef } from '../sim';

/** Priorities: 0 = off, 1 = highest ... 4 = lowest. Every working role does damage control (fires, breaches) at 1. */
const NO_WORK = { firefighting: 0, medical: 0, operating: 0, repair: 0, construction: 0, hauling: 0, refining: 0, crafting: 0, research: 0, cooking: 0, farming: 0, patrol: 0 };

const baseRoles = {
  // Every person on the player's crew (docs/TRAITS.md 10.11): skills, priorities and title come from their background (crew/profile.ts).
  'role.crew': {
    name: 'Crew',
    priorities: { firefighting: 1, medical: 3, operating: 3, repair: 3, construction: 3, hauling: 3, refining: 3, crafting: 3, research: 3, cooking: 3, farming: 3, patrol: 0 },
  },
  'role.engineer': {
    name: 'Engineer',
    priorities: { firefighting: 1, medical: 4, operating: 3, repair: 1, construction: 1, hauling: 3, refining: 2, crafting: 2, research: 3, cooking: 4, farming: 4, patrol: 0 },
    skills: { shielding: 4, construction: 4, hacking: 2 },
    relievesStations: true,
  },
  'role.gunner': {
    name: 'Gunner',
    priorities: { firefighting: 1, medical: 4, operating: 1, repair: 3, construction: 4, hauling: 3, refining: 4, crafting: 4, research: 4, cooking: 4, farming: 4, patrol: 0 },
    skills: { gunnery: 6 },
  },
  'role.medic': {
    name: 'Medic',
    skills: { medicine: 6, cooking: 2 },
    priorities: { firefighting: 1, medical: 1, operating: 4, repair: 4, construction: 4, hauling: 3, refining: 3, crafting: 3, research: 3, cooking: 3, farming: 3, patrol: 0 },
    relievesStations: true,
  },
  'role.security': {
    name: 'Security',
    priorities: { firefighting: 1, medical: 4, operating: 2, repair: 4, construction: 4, hauling: 3, refining: 4, crafting: 4, research: 4, cooking: 4, farming: 4, patrol: 2 },
    // patrol: only directors post patrol jobs (a station's guards); the player has no patrol jobs yet.
    skills: { gunnery: 4, melee: 4 },
    fighter: true,
    loadout: ['item.rifle', 'item.sidearm', 'item.blade'],
  },
  'role.pilot': {
    name: 'Pilot',
    priorities: { firefighting: 1, medical: 4, operating: 1, repair: 4, construction: 4, hauling: 3, refining: 4, crafting: 4, research: 4, cooking: 4, farming: 4, patrol: 0 },
    skills: { piloting: 6 },
  },
  // The lab hand: science 6 makes research 30% faster. Anyone can work a research module; the scientist just prefers it.
  'role.scientist': {
    name: 'Scientist',
    priorities: { firefighting: 1, medical: 4, operating: 3, repair: 4, construction: 4, hauling: 3, refining: 3, crafting: 3, research: 1, cooking: 4, farming: 4, patrol: 0 },
    skills: { science: 6 },
    relievesStations: true,
  },
  // --- Robot variants (species.robot). They never surrender; no medical or cooking work. ---
  'role.robot_worker': {
    name: 'Worker bot',
    species: 'species.robot',
    assemble: { cost: [{ item: 'item.parts', count: 6 }, { item: 'item.metal', count: 10 }, { item: 'item.electronics', count: 4 }], work: 400 },
    priorities: { firefighting: 1, medical: 0, operating: 3, repair: 2, construction: 1, hauling: 1, refining: 2, crafting: 2, research: 3, cooking: 0, farming: 0, patrol: 0 },
    relievesStations: true,
  },
  'role.robot_security': {
    name: 'Security bot',
    species: 'species.robot_heavy',
    assemble: { cost: [{ item: 'item.parts', count: 10 }, { item: 'item.metal', count: 20 }, { item: 'item.electronics', count: 6 }], work: 600 },
    priorities: { firefighting: 1, medical: 0, operating: 2, repair: 4, construction: 0, hauling: 4, refining: 0, crafting: 0, research: 0, cooking: 0, farming: 0, patrol: 2 },
    skills: { gunnery: 6, melee: 6 },
    fighter: true,
    loadout: ['item.rifle', 'item.sidearm', 'item.blade'],
  },
  'role.robot_repair': {
    name: 'Repair bot',
    species: 'species.robot',
    assemble: { cost: [{ item: 'item.parts', count: 8 }, { item: 'item.metal', count: 8 }, { item: 'item.electronics', count: 8 }], work: 500 },
    priorities: { firefighting: 1, medical: 0, operating: 4, repair: 1, construction: 2, hauling: 3, refining: 4, crafting: 4, research: 4, cooking: 0, farming: 0, patrol: 0 },
    skills: { construction: 6 },
  },
  // --- Creatures (one role per alien species). No work at all: the alien system and crew combat drive them. ---
  'role.alien_hunter': { name: 'Hunter', species: 'species.alien_hunter', priorities: NO_WORK, skills: { melee: 4 } },
  'role.alien_brute': { name: 'Brute', species: 'species.alien_brute', priorities: NO_WORK, skills: { melee: 4 } },
  'role.alien_spitter': { name: 'Spitter', species: 'species.alien_spitter', priorities: NO_WORK, skills: { gunnery: 4 } },
} satisfies Record<string, RoleDef>;

/** The zealots' crews: the usual trades in the machine-touched body (`species.augmented`, fearless). Real implants arrive with phase 7. */
const augmented = (name: string, role: RoleDef): RoleDef => ({ ...role, name, species: 'species.augmented' });

export const roles = {
  ...baseRoles,
  'role.zealot_pilot': augmented('Zealot pilot', baseRoles['role.pilot']),
  'role.zealot_gunner': augmented('Zealot gunner', baseRoles['role.gunner']),
  'role.zealot_guard': augmented('Zealot guard', baseRoles['role.security']),
  'role.zealot_engineer': augmented('Zealot engineer', baseRoles['role.engineer']),
} satisfies Record<string, RoleDef>;
