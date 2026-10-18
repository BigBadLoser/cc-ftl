import type { RoleDef } from '../sim';

/** Priorities: 0 = off, 1 = highest ... 4 = lowest. Every role fights fires at 2. */
export const roles = {
  'role.engineer': {
    name: 'Engineer',
    priorities: { firefighting: 2, medical: 4, operating: 3, repair: 1, construction: 1, hauling: 3, crafting: 2, cooking: 4 },
    skills: { shielding: 2, repair: 2, hacking: 1 },
  },
  'role.gunner': {
    name: 'Gunner',
    priorities: { firefighting: 2, medical: 4, operating: 1, repair: 3, construction: 4, hauling: 3, crafting: 4, cooking: 4 },
    skills: { gunnery: 3 },
  },
  'role.medic': {
    name: 'Medic',
    priorities: { firefighting: 2, medical: 1, operating: 4, repair: 4, construction: 4, hauling: 3, crafting: 3, cooking: 3 },
  },
  'role.security': {
    name: 'Security',
    priorities: { firefighting: 2, medical: 4, operating: 2, repair: 4, construction: 4, hauling: 3, crafting: 4, cooking: 4 },
    skills: { gunnery: 2, melee: 2 },
    fighter: true,
    loadout: ['item.rifle', 'item.sidearm', 'item.blade'],
  },
  'role.pilot': {
    name: 'Pilot',
    priorities: { firefighting: 2, medical: 4, operating: 1, repair: 4, construction: 4, hauling: 3, crafting: 4, cooking: 4 },
    skills: { piloting: 3 },
  },
  // --- Robot variants (species.robot). They never surrender; no medical or cooking work. ---
  'role.robot_worker': {
    name: 'Worker bot',
    species: 'species.robot',
    priorities: { firefighting: 2, medical: 0, operating: 3, repair: 2, construction: 1, hauling: 1, crafting: 2, cooking: 0 },
  },
  'role.robot_security': {
    name: 'Security bot',
    species: 'species.robot',
    priorities: { firefighting: 3, medical: 0, operating: 2, repair: 4, construction: 0, hauling: 4, crafting: 0, cooking: 0 },
    skills: { gunnery: 3, melee: 3 },
    fighter: true,
    loadout: ['item.rifle', 'item.sidearm', 'item.blade'],
  },
  'role.robot_repair': {
    name: 'Repair drone-bot',
    species: 'species.robot',
    priorities: { firefighting: 1, medical: 0, operating: 4, repair: 1, construction: 2, hauling: 3, crafting: 4, cooking: 0 },
    skills: { repair: 3 },
  },
} satisfies Record<string, RoleDef>;
