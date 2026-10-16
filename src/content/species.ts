import type { SpeciesDef } from '../sim';

export const species = {
  'species.human': {
    name: 'Human',
    moveSpeed: 2.5,
    workSpeed: 1,
    // Rest drains in a few minutes so sleeping is easy to observe while testing.
    restDecay: 0.6,
    carryCapacity: 20,
  },
} satisfies Record<string, SpeciesDef>;
