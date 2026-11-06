import type { EventDef } from '../sim';

/**
 * Starter events (see "Events" in docs/ARCHITECTURE.md). Faction ids are free strings matched against the story
 * context: the reputation key of the territory the player is in ('meridian', 'helix' and 'vantor' for each corporation's space, 'navy', 'pirates', ...) or null
 * for open space. Reputation is per that key (content/galaxy.ts, where each galaxy faction names its own key).
 * Physical outcomes (`physical` effects) are recorded only until the sector layer can realise them.
 */
export const events = {
  // --- Decisions ---
  /**
   * A physical encounter (DESIGN.md "Distress freighter"): a crippled freighter, its reactor failing on a clock (fires as it runs down, then it blows),
   * maybe its drive too. Help is agreed over the hail (its crew then take your party aboard as guests, who mend it through the ordinary repair jobs);
   * boarding it unasked is boarding. Deeper, raiders may already be on it, or be on their way (the scene seed; a scan warns of them).
   */
  'event.distress_call': {
    title: 'Distress call',
    text: 'A freighter drifts off the lane, its distress call clipped and looping: "...power failing... request any..." Reactor, drive or raiders: the signal does not say.',
    mode: 'decision',
    triggers: [{ kind: 'transit', weight: 6 }],
    cooldownSec: 600,
    eligible: [{ kind: 'shuttle', eva: true }],
    scene: {
      persistence: 'transient',
      ships: [
        {
          tag: 'freighter', owner: 'traders', shipgen: 'faction.civilian', family: 'freighter', stance: 'helpless', crew: [2, 4], credits: [150, 400], attitude: 3,
          damage: [{ def: 'module.reactor', count: 1, hp: [20, 35], failing: true }, { def: 'module.engine', count: 1, hp: [5, 30] }],
          lacks: ['repair'], // no engineer aboard: "we cannot fix it with what we have"
          cargo: {
            lines: [2, 3],
            pool: [
              { item: 'item.fuel', min: 6, max: 14 }, { item: 'item.ration', min: 10, max: 24 }, { item: 'item.electronics', min: 4, max: 10 },
              { item: 'item.polymer', min: 8, max: 18 }, { item: 'item.parts', min: 4, max: 10 },
            ],
          },
          story: '"This is the freighter on your scope. Our reactor took a coolant fault two jumps back and it is getting worse; the drive went with it. We cannot fix it with what we have. Send a repair party and we will make it worth your while: whatever we can spare from the hold."',
        },
        // Deeper only (danger 2 and up), on some seeds: raiders on the freighter, already there or on their way (they jump in on a clock).
        {
          tag: 'raider', group: 'raiders', owner: 'pirates', shipgen: 'faction.scrapper', family: 'raider', stance: 'hostile', prey: 'freighter',
          danger: { min: 2 }, chance: 0.6, arrive: { chance: 0.5, afterSec: [60, 100] },
        },
      ],
      timers: [{
        id: 'reactor', ship: 'freighter', afterSec: [110, 130], stopOn: 'repaired', fires: { leadSec: 45, everySec: 15, max: 3 }, due: 'wreck',
        // The reactor blows: wrecked systems and hull around it, crew hurt less the further they stand (three rings), fire; then the ship goes dark.
        blast: [
          { type: 'moduleDamage', amount: 300, radius: 2 },
          { type: 'hullDamage', amount: 300, radius: 3, falloff: 0.5 },
          { type: 'crewDamage', amount: 35, radius: 2 }, { type: 'crewDamage', amount: 25, radius: 4 }, { type: 'crewDamage', amount: 15, radius: 6 },
          { type: 'ignite', radius: 4 },
        ],
      }],
      rules: {
        reactorBlew: { on: 'timer', timer: 'reactor', log: "The {ship}'s reactor blows", tone: 'bad' },
      },
    },
    choices: [
      { id: 'hail', label: 'Answer the call', hint: 'Hear what happened', remote: 'hail' },
      { id: 'scan', label: 'Scan it', hint: 'Hull, the failing system, cargo, raiders', remote: 'scan' },
      {
        id: 'help', label: 'Offer help', hint: 'Drop out; your party goes aboard as guests',
        requires: [{ kind: 'remote', action: 'hail' }, { kind: 'shuttle', eva: true }], outcome: { effects: [{ type: 'scene', aid: true }] },
      },
      { id: 'approach', label: 'Drop out', hint: 'No promises made', outcome: { effects: [{ type: 'scene' }] } },
      { id: 'ignore', label: 'Fly on', hint: 'Continue the trip', outcome: {} },
    ],
  },
  /**
   * A physical encounter (DESIGN.md "Physical encounters", the trader skiff): remote actions read its scene, investigating drops out beside it.
   * What happens there (trade, barter, robbing or firing on it, waving and leaving) is the sim's; the shared observer rules make the consequences.
   */
  'event.trader_swap': {
    title: 'A skiff on the lane',
    text: 'Sensors catch a small trading skiff drifting along the lane, transponder on. Its drive is cold: it is in no hurry.',
    mode: 'decision',
    triggers: [{ kind: 'transit', weight: 5 }],
    cooldownSec: 600,
    scene: {
      persistence: 'transient',
      ships: [{
        owner: 'traders', shipgen: 'faction.civilian', family: 'mining', stance: 'neutral', crew: [1, 3], credits: [120, 420], leaveAfterSec: [100, 160],
        cargo: {
          lines: [2, 4],
          pool: [
            { item: 'item.electronics', min: 4, max: 12 }, { item: 'item.parts', min: 4, max: 10 }, { item: 'item.polymer', min: 6, max: 16 },
            { item: 'item.ration', min: 8, max: 20 }, { item: 'item.missile', min: 1, max: 4 }, { item: 'item.sidearm', min: 1, max: 2 },
            { item: 'item.fuel', min: 4, max: 12 },
          ],
        },
      }],
    },
    choices: [
      { id: 'hail', label: 'Hail it', hint: 'Ask what it carries', remote: 'hail' },
      { id: 'scan', label: 'Scan it', hint: 'Hull and crew', remote: 'scan' },
      { id: 'approach', label: 'Drop out', hint: 'Travel pauses here', outcome: { effects: [{ type: 'scene' }] } },
      { id: 'ignore', label: 'Fly on', hint: 'Continue the trip', outcome: {} },
    ],
  },
  /**
   * A physical encounter (DESIGN.md "Physical encounters", the derelict): a dead hull from the derelict generator, ruined by what killed it, maybe with
   * something aboard. Scanning reads it from the lane; investigating drops out beside it, where salvage, an away team and the shuttle do the rest.
   */
  'event.derelict_sighting': {
    title: 'Derelict sighted',
    text: 'Long-range sensors pick out a dark hull drifting off the lane. No transponder. Its power signature flickers in and out: dead, or nearly.',
    mode: 'decision',
    triggers: [{ kind: 'transit', weight: 7 }],
    danger: { max: 3 },
    eligible: [{ kind: 'shuttle', eva: true }],
    scene: {
      persistence: 'discovery',
      derelicts: [{ intensity: [0.3, 0.75], causes: ['combat', 'decay'], infested: 0.5 }],
    },
    choices: [
      { id: 'scan', label: 'Scan it', hint: 'Hull, air and signs of life', remote: 'scan' },
      {
        id: 'probe', label: 'Hack its data core', hint: 'A deep scan: what is aboard, and how much', remote: 'probe',
        requires: [{ kind: 'skill', skill: 'hacking', level: 2 }],
      },
      {
        id: 'approach', label: 'Drop out', hint: 'Board it, strip it, or look and leave',
        requires: [{ kind: 'shuttle', eva: true }], outcome: { effects: [{ type: 'scene' }] },
      },
      { id: 'skip', label: 'Leave it', outcome: {} },
    ],
  },
  /** Arc part 1: the choice sets a flag. */
  'event.pirate_captive': {
    title: 'Pirate scout surrenders',
    text: 'A pirate skiff took a hit from something else and its pilot hails you, hands up. "I only fly the boat. Please. I have a kid."',
    mode: 'decision',
    triggers: [{ kind: 'transit', weight: 6 }],
    danger: { min: 1 },
    once: true,
    choices: [
      { id: 'spare', label: 'Let him go', hint: 'He may remember this', outcome: { text: 'He salutes, wobbles, and is gone.', effects: [{ type: 'flag', flag: 'spared_pirate' }, { type: 'reputation', faction: 'pirates', delta: 1 }] } },
      { id: 'strip', label: 'Take his cargo, then go', outcome: { text: 'You take what he has and send him off with a warning.', effects: [{ type: 'items', item: 'item.metal', count: 12 }, { type: 'reputation', faction: 'pirates', delta: -1 }, { type: 'flag', flag: 'robbed_pirate' }] } },
      { id: 'fire', label: 'Open fire', outcome: { text: 'The skiff is gone. His friends will not be happy.', effects: [{ type: 'reputation', faction: 'pirates', delta: -3 }, { type: 'flag', flag: 'killed_pirate' }] } },
    ],
  },
  /**
   * Arc part 2, a physical encounter (DESIGN.md "Pirate ambush"): the flag queues it, the next hop of a trip opens it. The pirate you spared hails you with a
   * debt to pay. The scene seed decides whether it is true (a skiff that trades and talks) or a trap (a boarding party of 3 and a shuttle, which asks to
   * dock a while after you drop out; let in, the party turns on you). Scans and hails read it from the lane; what you do in the pocket is yours.
   */
  'event.pirate_returns': {
    title: 'The pirate you spared',
    comms: { showWares: false },
    text: 'A skiff you know hails you off the lane. "You let me go back there. I haven\'t forgotten. I owe you, and I mean to pay."',
    mode: 'decision',
    triggers: [{ kind: 'flag', flag: 'spared_pirate', delaySec: 240 }],
    eligible: [{ kind: 'flag', flag: 'spared_pirate' }],
    danger: { min: 1 },
    once: true,
    scene: {
      persistence: 'transient',
      ships: [{
        owner: 'pirates', shipgen: 'faction.scrapper', family: 'raider', stance: 'neutral', credits: [60, 220], leaveAfterSec: [150, 220], attitude: 2,
        cargo: {
          lines: [2, 3],
          pool: [
            { item: 'item.metal', min: 6, max: 16 }, { item: 'item.ration', min: 4, max: 12 }, { item: 'item.parts', min: 2, max: 8 },
            { item: 'item.fuel', min: 3, max: 9 }, { item: 'item.sidearm', min: 1, max: 2 },
          ],
        },
        ambush: {
          chance: 0.5, party: 3, crew: [4, 5], askAfterSec: [14, 22], honest: { party: [1, 2], crew: [3, 4] },
          talk: {
            honest: '"It\'s me, the one you let go. The clan let me keep the boat, and I\'ve been paying it off since. I know where the patrols sit, and I\'ll tell you for nothing. Come alongside and we can trade, if you like."',
            trap: '"Captain, it\'s me, the one you spared. I owe you my life, and my crew want to thank you in person. Let us dock and we\'ll settle up properly."',
            tells: {
              // The tells are shown, not told: the caller's name and the scan's transponder ID flicker to a second value (`name`), or the video stutters (`lag`).
              // `{caller}` is the caller's name, seeded from the scene (app/comms/speaker.ts).
              name: '"Captain, it\'s {caller}, the one you spared. I owe you my life." "My crew want to thank you in person. Let us dock."',
              lag: '"Captain, it\'s me, the one you spared. I owe you my life." "My crew want to thank you in person. Let us dock."',
            },
          },
        },
      }],
      rules: {
        honestPaid: {
          on: 'delivered', trap: false,
          effects: [{ type: 'items', item: 'item.missile', count: 4, at: 'visitAirlock' }, { type: 'reputation', faction: 'owner', delta: 2 }, { type: 'flag', flag: 'spared_pirate', op: 'clear' }],
          log: '{ship} keeps its word: four missiles handed over, and the patrol routes for nothing', tone: 'good',
        },
        honestRefused: {
          on: 'declined', trap: false,
          effects: [{ type: 'flag', flag: 'spared_pirate', op: 'clear' }],
          log: '{ship} pulls away, the debt unpaid', tone: 'warn',
        },
        ambushed: {
          on: 'ambushed', trap: true,
          effects: [{ type: 'flag', flag: 'pirate_ambushed', op: 'add' }, { type: 'flag', flag: 'spared_pirate', op: 'clear' }],
          log: 'It was a trap: the boarders from {ship} turn on you', tone: 'bad',
        },
        boardersDown: {
          on: 'boardersDown', trap: true,
          effects: [{ type: 'reputation', faction: 'owner', delta: -1 }],
          log: 'The boarders from {ship} are down. Their gear is yours, and the clan will hear of it', tone: 'warn',
        },
        destroyed: {
          on: 'destroyed', effects: [{ type: 'flag', flag: 'killed_pirate' }],
          log: 'The {ship} is a dead hull now, open to stripping', tone: 'bad',
        },
      },
    },
    choices: [
      { id: 'hail', label: 'Hear him out', hint: 'Answer the call and listen', remote: 'hail' },
      { id: 'scan', label: 'Scan the skiff', hint: 'Weapons, boarding craft and crew', remote: 'scan' },
      { id: 'approach', label: 'Drop out', hint: 'Travel pauses here', outcome: { effects: [{ type: 'scene' }] } },
      { id: 'ignore', label: 'Fly on', hint: 'Continue the trip', outcome: {} },
    ],
  },
  /** Species requirement: only a robot can do it. */
  'event.rogue_terminal': {
    title: 'Maintenance terminal',
    text: 'A dead station relay still blinks a service port, a connector pattern no human tool fits. The core behind it is intact.',
    mode: 'decision',
    triggers: [{ kind: 'transit', weight: 4 }],
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
    triggers: [{ kind: 'transit', weight: 8 }],
    factions: ['meridian'],
    cooldownSec: 600,
    choices: [
      { id: 'pay', label: 'Pay the tariff', cost: [{ item: 'item.metal', count: 6 }], outcome: { text: 'The cutter logs you as compliant.', effects: [{ type: 'reputation', faction: 'meridian', delta: 1 }] } },
      { id: 'vip', label: 'Show your clearance', requires: [{ kind: 'reputation', faction: 'meridian', min: 3 }], outcome: { text: '"Carry on, captain."', effects: [{ type: 'reputation', faction: 'meridian', delta: 1 }] } },
      { id: 'bluff', label: 'Bluff your way through', check: { skill: 'piloting', difficulty: 2, base: 0.45 }, success: { text: 'They buy it.', effects: [{ type: 'flag', flag: 'bluffed_corp' }] }, failure: { text: 'They do not. Your fine is posted and your name flagged.', effects: [{ type: 'reputation', faction: 'meridian', delta: -2 }, { type: 'items', item: 'item.metal', count: -5 }] } },
    ],
  },
  /** Module requirement; heal effect. */
  'event.medical_emergency': {
    title: 'Medical emergency',
    text: 'A stranded prospector floats in a leaking escape pod, barely conscious. Your crew could patch them up if you have somewhere to lay them.',
    mode: 'decision',
    triggers: [{ kind: 'transit', weight: 3 }],
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
    triggers: [{ kind: 'transit', weight: 3 }],
    cooldownSec: 900,
    effects: [{ type: 'crewHeal', amount: 5, who: 'all' }],
  },
  'event.notice_chatter': {
    title: 'Radio chatter',
    text: 'Faint pirate chatter on an old channel. Something about a rendezvous at the dead moon.',
    mode: 'notice',
    triggers: [{ kind: 'transit', weight: 4 }],
    danger: { min: 1 },
    cooldownSec: 600,
  },
  /** A lead: tapping it opens a decision. */
  'event.notice_beacon': {
    title: 'Faint beacon',
    text: 'A weak automated beacon repeats on the long-range band. It might be worth a look.',
    mode: 'notice',
    triggers: [{ kind: 'transit', weight: 2 }],
    lead: 'event.derelict_sighting',
    cooldownSec: 900,
  },
} satisfies Record<string, EventDef>;
