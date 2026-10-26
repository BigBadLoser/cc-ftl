import type { RoleDef } from '../sim';

/** Priorities: 0 = off, 1 = highest ... 4 = lowest. Every role fights fires at 2. */
const NO_WORK = { firefighting: 0, medical: 0, operating: 0, repair: 0, construction: 0, hauling: 0, refining: 0, crafting: 0, cooking: 0, patrol: 0 };

/** Crew who are not gunners grab one of these from storage when boarders are aboard (best first), and put it back afterwards. */
const EMERGENCY_ARMS = ['item.rifle', 'item.sidearm', 'item.blade'];

export const roles = {
  'role.engineer': {
    name: 'Engineer',
    priorities: { firefighting: 2, medical: 4, operating: 3, repair: 1, construction: 1, hauling: 3, refining: 2, crafting: 2, cooking: 4, patrol: 0 },
    skills: { shielding: 2, repair: 2, hacking: 1 },
    emergencyLoadout: EMERGENCY_ARMS,
    relievesStations: true,
  },
  'role.gunner': {
    name: 'Gunner',
    priorities: { firefighting: 2, medical: 4, operating: 1, repair: 3, construction: 4, hauling: 3, refining: 4, crafting: 4, cooking: 4, patrol: 0 },
    skills: { gunnery: 3 },
    // Gunners take a gun from storage when one is there, so they fight boarders without being drafted (not `fighter`: they do not patrol).
    playerLoadout: ['item.rifle', 'item.sidearm'],
  },
  'role.medic': {
    name: 'Medic',
    skills: { medicine: 3 },
    emergencyLoadout: EMERGENCY_ARMS,
    priorities: { firefighting: 2, medical: 1, operating: 4, repair: 4, construction: 4, hauling: 3, refining: 3, crafting: 3, cooking: 3, patrol: 0 },
    relievesStations: true,
  },
  'role.security': {
    name: 'Security',
    priorities: { firefighting: 2, medical: 4, operating: 2, repair: 4, construction: 4, hauling: 3, refining: 4, crafting: 4, cooking: 4, patrol: 2 },
    // patrol: only directors post patrol jobs (a station's guards); the player has no patrol jobs yet.
    skills: { gunnery: 2, melee: 2 },
    fighter: true,
    loadout: ['item.rifle', 'item.sidearm', 'item.blade'],
  },
  'role.pilot': {
    name: 'Pilot',
    priorities: { firefighting: 2, medical: 4, operating: 1, repair: 4, construction: 4, hauling: 3, refining: 4, crafting: 4, cooking: 4, patrol: 0 },
    skills: { piloting: 3 },
    emergencyLoadout: EMERGENCY_ARMS,
  },
  // --- Robot variants (species.robot). They never surrender; no medical or cooking work. ---
  'role.robot_worker': {
    name: 'Worker bot',
    species: 'species.robot',
    assemble: { cost: [{ item: 'item.parts', count: 6 }, { item: 'item.metal', count: 10 }, { item: 'item.electronics', count: 4 }], work: 400 },
    priorities: { firefighting: 2, medical: 0, operating: 3, repair: 2, construction: 1, hauling: 1, refining: 2, crafting: 2, cooking: 0, patrol: 0 },
    relievesStations: true,
  },
  'role.robot_security': {
    name: 'Security bot',
    species: 'species.robot_heavy',
    assemble: { cost: [{ item: 'item.parts', count: 10 }, { item: 'item.metal', count: 20 }, { item: 'item.electronics', count: 6 }], work: 600 },
    priorities: { firefighting: 3, medical: 0, operating: 2, repair: 4, construction: 0, hauling: 4, refining: 0, crafting: 0, cooking: 0, patrol: 2 },
    skills: { gunnery: 3, melee: 3 },
    fighter: true,
    loadout: ['item.rifle', 'item.sidearm', 'item.blade'],
  },
  'role.robot_repair': {
    name: 'Repair drone-bot',
    species: 'species.robot',
    assemble: { cost: [{ item: 'item.parts', count: 8 }, { item: 'item.metal', count: 8 }, { item: 'item.electronics', count: 8 }], work: 500 },
    priorities: { firefighting: 1, medical: 0, operating: 4, repair: 1, construction: 2, hauling: 3, refining: 4, crafting: 4, cooking: 0, patrol: 0 },
    skills: { repair: 3 },
  },
  // --- Creatures (one role per alien species). No work at all: the alien system and crew combat drive them. ---
  'role.alien_hunter': { name: 'Hunter', species: 'species.alien_hunter', priorities: NO_WORK, skills: { melee: 2 } },
  'role.alien_brute': { name: 'Brute', species: 'species.alien_brute', priorities: NO_WORK, skills: { melee: 2 } },
  'role.alien_spitter': { name: 'Spitter', species: 'species.alien_spitter', priorities: NO_WORK, skills: { gunnery: 2 } },
} satisfies Record<string, RoleDef>;
