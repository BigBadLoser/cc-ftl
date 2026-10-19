import type { EventDef } from '../sim';

/**
 * Starter events (see "Events" in docs/ARCHITECTURE.md). Faction ids are free strings matched against the story
 * context: a galaxy faction id from content/galaxy.ts ('meridian' is the Meridian Combine), or null for open space.
 * Reputation is per faction id ('traders', 'pirates', 'meridian', ...); standings sit on top (sim/galaxy/standing.ts).
 * Physical outcomes (`physical` effects) are recorded only until the sector layer can realise them.
 */
export const events = {
  // --- Decisions ---
  /** Skill check with shown odds; cost-free; reputation reward. */
  'event.distress_call': {
    title: 'Distress call',
    text: 'A battered freighter drifts nearby, its engines dead. The captain begs for help restoring power before the cold gets to the crew.',
    mode: 'decision',
    triggers: [{ kind: 'transit', weight: 2 }, { kind: 'arrival', weight: 3 }, { kind: 'periodic', weight: 3 }],
    cooldownSec: 600,
    choices: [
      {
        id: 'repair', label: 'Send a repair team', hint: 'A skilled hand on the engines',
        check: { skill: 'repair', difficulty: 3 },
        success: {
          text: 'The engines catch. The grateful captain empties a cargo crate into your hold.',
          effects: [{ type: 'items', item: 'item.parts', count: 6 }, { type: 'items', item: 'item.scrap', count: 20 }, { type: 'skillXp', skill: 'repair', amount: 40, who: 'actor' }, { type: 'reputation', faction: 'traders', delta: 1 }],
        },
        failure: {
          text: 'A coolant line bursts while your team works. They get out, scorched, and the freighter stays dead.',
          effects: [{ type: 'crewDamage', amount: 25, who: 'actor' }, { type: 'skillXp', skill: 'repair', amount: 15, who: 'actor' }],
        },
      },
      { id: 'supplies', label: 'Throw them some spare parts', cost: [{ item: 'item.parts', count: 3 }], outcome: { text: 'They patch it together themselves and thank you.', effects: [{ type: 'reputation', faction: 'traders', delta: 1 }] } },
      { id: 'ignore', label: 'Fly on', outcome: { text: 'You leave them to it.', effects: [{ type: 'reputation', faction: 'traders', delta: -1 }] } },
    ],
  },
  /** Item cost; an option gated by reputation. */
  'event.trader_swap': {
    title: 'Trader offers a swap',
    text: 'A trading skiff pulls alongside. "Scrap for chips, friend. I always need scrap, and my electronics are the good kind."',
    mode: 'decision',
    triggers: [{ kind: 'arrival', weight: 3 }, { kind: 'periodic', weight: 2 }],
    cooldownSec: 600,
    choices: [
      { id: 'swap', label: 'Swap 20 scrap for 5 electronics', cost: [{ item: 'item.scrap', count: 20 }], outcome: { text: 'A fair deal. The skiff peels away.', effects: [{ type: 'items', item: 'item.electronics', count: 5 }] } },
      {
        id: 'friends', label: 'Ask for the friends rate',
        requires: [{ kind: 'reputation', faction: 'traders', min: 2 }], cost: [{ item: 'item.scrap', count: 10 }],
        outcome: { text: '"For you? Done." He throws in extra.', effects: [{ type: 'items', item: 'item.electronics', count: 6 }, { type: 'items', item: 'item.parts', count: 2 }] },
      },
      { id: 'decline', label: 'No thanks', outcome: { text: 'The skiff shrugs and leaves.' } },
    ],
  },
  /** Uses the stubbed physical outcome. */
  'event.derelict_sighting': {
    title: 'Derelict sighted',
    text: 'Long-range scans pick out a dark, drifting hull. No transponder, no heat. It could hold salvage, or something worse.',
    mode: 'decision',
    triggers: [{ kind: 'transit', weight: 3 }, { kind: 'arrival', weight: 2 }, { kind: 'periodic', weight: 2 }],
    danger: { max: 3 },
    choices: [
      {
        id: 'explore', label: 'Mark it for exploration', hint: 'A derelict appears for an away team',
        outcome: { text: 'You plot a course. An away team can board it.', effects: [{ type: 'physical', outcome: { kind: 'derelict', template: 'ship.derelict' } }, { type: 'flag', flag: 'derelicts_found', op: 'add' }] },
      },
      {
        id: 'scan', label: 'Scan it from here', requires: [{ kind: 'skill', skill: 'hacking', level: 1 }],
        outcome: { text: 'The wreck is ancient but its data core still spins. You copy what you can.', effects: [{ type: 'items', item: 'item.electronics', count: 3 }] },
      },
      { id: 'skip', label: 'Leave it', outcome: {} },
    ],
  },
  /** Arc part 1: the choice sets a flag. */
  'event.pirate_captive': {
    title: 'Pirate scout surrenders',
    text: 'A pirate skiff took a hit from something else and its pilot hails you, hands up. "I only fly the boat. Please. I have a kid."',
    mode: 'decision',
    triggers: [{ kind: 'transit', weight: 2 }, { kind: 'periodic', weight: 3 }, { kind: 'arrival', weight: 1 }],
    danger: { min: 1 },
    once: true,
    choices: [
      { id: 'spare', label: 'Let him go', hint: 'He may remember this', outcome: { text: 'He salutes, wobbles, and is gone.', effects: [{ type: 'flag', flag: 'spared_pirate' }, { type: 'reputation', faction: 'pirates', delta: 1 }] } },
      { id: 'strip', label: 'Take his cargo, then go', outcome: { text: 'You take what he has and send him off with a warning.', effects: [{ type: 'items', item: 'item.scrap', count: 30 }, { type: 'reputation', faction: 'pirates', delta: -1 }, { type: 'flag', flag: 'robbed_pirate' }] } },
      { id: 'fire', label: 'Open fire', outcome: { text: 'The skiff is gone. His friends will not be happy.', effects: [{ type: 'reputation', faction: 'pirates', delta: -3 }, { type: 'flag', flag: 'killed_pirate' }] } },
    ],
  },
  /** Arc part 2: triggered by the flag, gated on it. */
  'event.pirate_returns': {
    title: 'The pirate you spared',
    text: 'A skiff you know hails you. "You let me go. I have not forgotten. There is a patrol ahead and I can tell you where."',
    mode: 'decision',
    triggers: [{ kind: 'flag', flag: 'spared_pirate', delaySec: 240 }],
    eligible: [{ kind: 'flag', flag: 'spared_pirate' }],
    once: true,
    choices: [
      { id: 'listen', label: 'Hear him out', outcome: { text: 'He sells you the patrol routes for nothing. Your trip is quieter for it.', effects: [{ type: 'items', item: 'item.missile', count: 4 }, { type: 'reputation', faction: 'pirates', delta: 2 }, { type: 'flag', flag: 'spared_pirate', op: 'clear' }] } },
      { id: 'ambush', label: 'Suspect a trap and raise shields', outcome: { text: 'It was a trap after all. His friends were waiting.', effects: [{ type: 'physical', outcome: { kind: 'boarders', template: 'ship.raiderBoarder', size: 3 } }, { type: 'flag', flag: 'spared_pirate', op: 'clear' }] } },
    ],
  },
  /** Species requirement: only a robot can do it. */
  'event.rogue_terminal': {
    title: 'Maintenance terminal',
    text: 'A dead station relay still blinks a service port, a connector pattern no human tool fits. The core behind it is intact.',
    mode: 'decision',
    triggers: [{ kind: 'transit', weight: 1 }, { kind: 'arrival', weight: 2 }, { kind: 'periodic', weight: 1 }],
    cooldownSec: 900,
    choices: [
      { id: 'interface', label: 'Interface directly', requires: [{ kind: 'species', species: 'species.robot' }], outcome: { text: 'The robot plugs in and downloads the station logs: parts caches, coordinates and a long lullaby.', effects: [{ type: 'items', item: 'item.parts', count: 8 }, { type: 'items', item: 'item.electronics', count: 4 }, { type: 'skillXp', skill: 'hacking', amount: 30, who: 'random' }] } },
      { id: 'hack', label: 'Crack the port by hand', check: { skill: 'hacking', difficulty: 3, base: 0.4 }, success: { text: 'It takes hours, but you get in.', effects: [{ type: 'items', item: 'item.electronics', count: 4 }, { type: 'skillXp', skill: 'hacking', amount: 30, who: 'actor' }] }, failure: { text: 'A counter-intrusion fries the console.', effects: [{ type: 'crewDamage', amount: 10, who: 'actor' }] } },
      { id: 'leave', label: 'Not worth it', outcome: {} },
    ],
  },
  /** Faction territory: a corporate checkpoint; reputation both gates and changes. */
  'event.corp_checkpoint': {
    title: 'Meridian checkpoint',
    text: 'A corporate patrol cutter hails you. "Transit tariff applies in Meridian space. Cargo manifest, captain."',
    mode: 'decision',
    triggers: [{ kind: 'arrival', weight: 6 }, { kind: 'periodic', weight: 2 }],
    factions: ['meridian'],
    cooldownSec: 600,
    choices: [
      { id: 'pay', label: 'Pay the tariff', cost: [{ item: 'item.scrap', count: 15 }], outcome: { text: 'The cutter logs you as compliant.', effects: [{ type: 'reputation', faction: 'meridian', delta: 1 }] } },
      { id: 'vip', label: 'Show your clearance', requires: [{ kind: 'reputation', faction: 'meridian', min: 3 }], outcome: { text: '"Carry on, captain."', effects: [{ type: 'reputation', faction: 'meridian', delta: 1 }] } },
      { id: 'bluff', label: 'Bluff your way through', check: { skill: 'piloting', difficulty: 2, base: 0.45 }, success: { text: 'They buy it.', effects: [{ type: 'flag', flag: 'bluffed_corp' }] }, failure: { text: 'They do not. Your fine is posted and your name flagged.', effects: [{ type: 'reputation', faction: 'meridian', delta: -2 }, { type: 'items', item: 'item.scrap', count: -10 }] } },
    ],
  },
  /** Module requirement; heal effect. */
  'event.medical_emergency': {
    title: 'Medical emergency',
    text: 'A stranded prospector floats in a leaking escape pod, barely conscious. Your crew could patch them up if you have somewhere to lay them.',
    mode: 'decision',
    triggers: [{ kind: 'periodic', weight: 2 }, { kind: 'arrival', weight: 1 }],
    cooldownSec: 900,
    choices: [
      { id: 'treat', label: 'Take them aboard', requires: [{ kind: 'module', def: 'module.bed' }], outcome: { text: 'Rested and fed, the prospector rewards you and your crew feel the better for the good deed.', effects: [{ type: 'items', item: 'item.metal', count: 15 }, { type: 'crewHeal', amount: 20, who: 'all' }, { type: 'reputation', faction: 'traders', delta: 1 }] } },
      { id: 'beacon', label: 'Drop a rescue beacon', outcome: { text: 'Someone will find them.' } },
    ],
  },
  // --- Notices (in-world, non-pausing) ---
  'event.notice_comet': {
    title: 'Comet pass',
    text: 'A comet sweeps by close enough to light the viewports. A few crew linger to watch.',
    mode: 'notice',
    triggers: [{ kind: 'periodic', weight: 3 }],
    cooldownSec: 900,
    effects: [{ type: 'crewHeal', amount: 5, who: 'all' }],
  },
  'event.notice_chatter': {
    title: 'Radio chatter',
    text: 'Faint pirate chatter on an old channel. Something about a rendezvous at the dead moon.',
    mode: 'notice',
    triggers: [{ kind: 'periodic', weight: 2 }, { kind: 'arrival', weight: 2 }],
    danger: { min: 1 },
    cooldownSec: 600,
  },
  /** A lead: tapping it opens a decision. */
  'event.notice_beacon': {
    title: 'Faint beacon',
    text: 'A weak automated beacon repeats on the long-range band. It might be worth a look.',
    mode: 'notice',
    triggers: [{ kind: 'periodic', weight: 2 }],
    lead: 'event.derelict_sighting',
    cooldownSec: 900,
  },
} satisfies Record<string, EventDef>;
