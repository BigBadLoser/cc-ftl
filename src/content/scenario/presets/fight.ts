import { definePreset, flag } from '../types';

/**
 * `?scenario=fight`: a raider beside the ship and the game running at normal speed, for the combat view; add `&far` for a raider at engagement distance.
 * `&charged` also fills the FTL drive. (The start node holds a station that leaves no room for a raider: the build hops to an empty neighbour first and deploys where the ship was.)
 */
export default definePreset({
  doc: 'A raider beside the ship, for the combat view.',
  params: { far: flag(), charged: flag() },
  spec: (p) => ({
    node: { warm: 10, relocate: true },
    ships: [{ kind: 'raider', ...(p['far'] ? { far: true } : {}) }],
    steps: p['charged'] ? [{ cmds: [{ type: 'debug.chargeFtl' }] }] : [],
    ui: { speed: 1 },
  }),
});
