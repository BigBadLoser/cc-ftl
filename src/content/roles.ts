import type { RoleDef } from '../sim';

/** Priorities: 0 = off, 1 = highest ... 4 = lowest. Every role fights fires at 2. */
export const roles = {
  'role.engineer': {
    name: 'Engineer',
    priorities: { firefighting: 2, medical: 4, operating: 3, repair: 1, construction: 1, hauling: 3, crafting: 2, cooking: 4 },
    skills: { shielding: 2 },
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
    skills: { gunnery: 1 },
  },
  'role.pilot': {
    name: 'Pilot',
    priorities: { firefighting: 2, medical: 4, operating: 1, repair: 4, construction: 4, hauling: 3, crafting: 4, cooking: 4 },
    skills: { piloting: 3 },
  },
} satisfies Record<string, RoleDef>;
