import type { CreatureDefs } from '../sim';

/** Derelict infestations. Placeholder weights: mostly hunters, some brutes, a few spitters. */
export const creatures = {
  hatch: [
    { role: 'role.alien_hunter', weight: 7 },
    { role: 'role.alien_brute', weight: 2 },
    { role: 'role.alien_spitter', weight: 1 },
  ],
} satisfies CreatureDefs;
