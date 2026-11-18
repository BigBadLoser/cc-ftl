import { definePreset, flag } from '../types';

/**
 * `?scenario=boarding[&aim][&menu][&manual][&far][&charged]`: the fight scenario with a boarding party (the `boarding` scenario hook): your crew fly over in the
 * shuttle, dock, step out and wreck the raider's reactor. `&menu`, `&manual` and `&aim` as in the hook.
 */
export default definePreset({
  doc: 'The fight scenario with a boarding party sent over to wreck the raider\'s reactor.',
  params: { far: flag(), charged: flag(), aim: flag(), menu: flag(), manual: flag() },
  spec: (p) => ({
    node: { warm: 10, relocate: true },
    ships: [{ kind: 'raider', ...(p['far'] ? { far: true } : {}) }],
    steps: p['charged'] ? [{ cmds: [{ type: 'debug.chargeFtl' }] }] : [],
    hooks: [{ name: 'boarding', args: { aim: !!p['aim'], menu: !!p['menu'], manual: !!p['manual'] } }],
    ui: { speed: 1 },
  }),
});
