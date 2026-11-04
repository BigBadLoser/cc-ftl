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
  // Derelicts: what you found and what it cost. `derelicts_found` counts the wrecks you worked (a scan reads them better with practice).
  salvaged: { on: 'salvaged', of: 'derelict', effects: [{ type: 'flag', flag: 'derelicts_found', op: 'add' }], log: 'Salvage coming off the {ship}', tone: 'good' },
  cleared: { on: 'cleared', of: 'derelict', effects: [{ type: 'flag', flag: 'infestations_cleared', op: 'add' }], log: 'The {ship} is clear: nothing hostile left aboard', tone: 'good' },
  derelictLeft: { on: 'left', of: 'derelict', effects: [{ type: 'flag', flag: 'derelicts_left', op: 'add' }] },
  crewLost: { on: 'crewLost', log: '{crew} did not come back', tone: 'bad' },
} satisfies Record<string, SceneRuleDef>;
