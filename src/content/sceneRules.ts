import type { SceneRuleDef } from '../sim';

/**
 * Shared outcome observer rules (DESIGN.md "Physical encounters", part c; scene/observer.ts). The world reacts the same way to the same action
 * wherever it happens; an encounter adds or overrides a rule in its `EventDef.scene.rules` only when it has a reason. Destroying or taking a ship
 * already costs standing and notoriety everywhere (galaxy/heat.ts), so these rules add only what that does not: a flag, a log line, the smaller acts.
 */
export const sceneRules = {
  traded: { on: 'traded', stance: ['neutral', 'helpless'], effects: [{ type: 'reputation', faction: 'owner', delta: 1 }], log: 'A fair trade with the {ship}: they will remember it', tone: 'good' },
  attacked: { on: 'attacked', stance: ['neutral', 'helpless'], effects: [{ type: 'flag', flag: 'attacked_neutral', op: 'add' }], log: 'You fired on the {ship}', tone: 'bad' },
  boarded: {
    on: 'boarded', stance: ['neutral', 'helpless'],
    effects: [{ type: 'reputation', faction: 'owner', delta: -1 }, { type: 'flag', flag: 'boarded_neutral', op: 'add' }],
    log: 'Your crew boarded the {ship} uninvited', tone: 'bad',
  },
  captured: { on: 'captured', effects: [{ type: 'flag', flag: 'ships_taken', op: 'add' }], log: 'The {ship} is yours now', tone: 'warn' },
  fled: { on: 'fled', log: 'The {ship} jumped away', tone: 'info' },
  destroyed: { on: 'destroyed', stance: ['neutral', 'helpless'], log: 'The {ship} is a dead hull now, open to stripping', tone: 'bad' },
} satisfies Record<string, SceneRuleDef>;
