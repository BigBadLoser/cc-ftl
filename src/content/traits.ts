import type { TraitDef } from '../sim';

/**
 * Crew traits (docs/TRAITS.md section 4). `effect` is the exact effect in words, shown on hover; keep it in step with
 * `modifiers` and `effects`. Traits whose mechanic isn't built yet (fear, bonds, habits) are `rollable: false`.
 * Weights: 10 common, 5 uncommon, 2 rare.
 */
export const traits = {
  // --- Behaviour ---
  'trait.brave': {
    name: 'Brave', flavour: 'Runs toward the shooting.', kind: 'behaviour', weight: 5, rollable: true,
    effect: 'Fights intruders even unarmed (bare-handed); never surrenders.',
    excludes: ['trait.coward', 'trait.battle_shy'], effects: { brave: true },
  },
  'trait.coward': {
    name: 'Coward', flavour: 'Runs away from the shooting.', kind: 'behaviour', weight: 10, rollable: true,
    effect: 'Below 50% hp runs from the intruders it sees, even armed; surrenders below 30% hp when outnumbered.',
    excludes: ['trait.brave'], effects: { coward: true },
  },
  'trait.loner': {
    name: 'Loner', flavour: 'Prefers the quiet decks.', kind: 'behaviour', weight: 10, rollable: true,
    effect: 'Alone: +3 mood instead of Lonely. No Company bonus; Crowded -4 with 3+ crew within 7 tiles.',
    excludes: ['trait.social'], effects: { company: 'loner' },
  },
  'trait.social': {
    name: 'Social', flavour: 'Needs someone to talk at.', kind: 'behaviour', weight: 10, rollable: true,
    effect: 'Company +6 mood (not +3); Lonely -8 (not -4).',
    excludes: ['trait.loner'], effects: { company: 'social' },
  },
  'trait.hot_headed': {
    name: 'Hot-headed', flavour: 'Takes it personally.', kind: 'behaviour', weight: 10, rollable: false,
    effect: 'Rivalries form twice as fast; shouting matches with rivals when unhappy.',
    excludes: ['trait.peacemaker'],
  },
  'trait.peacemaker': {
    name: 'Peacemaker', flavour: "Everyone's favourite.", kind: 'behaviour', weight: 5, rollable: false,
    effect: 'Friendships form 1.5x as fast; rivals nearby feel half the rival penalty.',
    excludes: ['trait.hot_headed'],
  },
  'trait.protective': {
    name: 'Protective', flavour: 'Nobody touches my people.', kind: 'behaviour', weight: 5, rollable: false,
    effect: 'Bonds twice as fast in shared danger; +1 gunnery and melee fighting near a friend; grieves harder.',
  },
  'trait.workaholic': {
    name: 'Workaholic', flavour: 'One more panel.', kind: 'behaviour', weight: 5, rollable: true,
    effect: 'Work speed x1.15. Only stops to sleep at rest 5 and to eat at hunger 10. Idle -5 mood after 60 s without a job.',
    excludes: ['trait.lazy'], modifiers: [{ stat: 'workSpeed', op: 'mul', value: 1.15 }],
    effects: { workaholic: true, idleMood: { key: 'idle', value: -5, afterSec: 60 } },
  },
  'trait.lazy': {
    name: 'Lazy', flavour: 'Will get to it.', kind: 'behaviour', weight: 10, rollable: true,
    effect: 'Work speed x0.9. Wanders about 3x as often when idle. Relaxed +3 mood.',
    excludes: ['trait.workaholic'], modifiers: [{ stat: 'workSpeed', op: 'mul', value: 0.9 }],
    effects: { wanderMult: 3, mood: 3 },
  },
  'trait.thrill_seeker': {
    name: 'Thrill-seeker', flavour: "Bored when it's quiet.", kind: 'behaviour', weight: 5, rollable: true,
    effect: '+6 mood in combat or on EVA. Bored -3 after 15 min without either.',
    excludes: ['trait.battle_shy', 'trait.void_fear'], effects: { thrill: true },
  },
  'trait.stoic': {
    name: 'Stoic', flavour: 'Seen worse.', kind: 'behaviour', weight: 5, rollable: true,
    effect: 'Every mood factor counts half, good and bad.',
    excludes: ['trait.sensitive'], effects: { moodScale: 0.5 },
  },
  'trait.sensitive': {
    name: 'Sensitive', flavour: 'Feels everything.', kind: 'behaviour', weight: 5, rollable: true,
    effect: 'Every mood factor counts 1.5x, good and bad.',
    excludes: ['trait.stoic'], effects: { moodScale: 1.5 },
  },
  'trait.cheerful': {
    name: 'Cheerful', flavour: 'Whistles through red alerts.', kind: 'behaviour', weight: 10, rollable: true,
    effect: '+5 mood. Crew within 7 tiles get Cheered up +2.',
    excludes: ['trait.gloomy'], effects: { mood: 5, aura: 2 },
  },
  'trait.gloomy': {
    name: 'Gloomy', flavour: 'Knows how this ends.', kind: 'behaviour', weight: 10, rollable: true,
    effect: '-5 mood. Crew within 7 tiles get Dragged down -1.',
    excludes: ['trait.cheerful'], effects: { mood: -5, aura: -1 },
  },
  // --- Phobias and habits (mechanics pending) ---
  'trait.pyrophobic': {
    name: 'Pyrophobic', flavour: 'Saw a ship burn once.', kind: 'phobia', weight: 5, rollable: false,
    effect: 'Afraid of fire: avoids jobs near flames; panics if it lasts.',
  },
  'trait.void_fear': {
    name: 'Afraid of the void', flavour: 'Hates the hum of the hull.', kind: 'phobia', weight: 5, rollable: false,
    effect: 'Afraid of vacuum and EVA: avoids spacewalks; panics if it lasts.',
    excludes: ['trait.void_born', 'trait.thrill_seeker'],
  },
  'trait.dark_fear': {
    name: 'Afraid of the dark', flavour: 'Sleeps with the lights on.', kind: 'phobia', weight: 5, rollable: false,
    effect: 'Afraid of darkness: avoids dark rooms; panics if it lasts.',
    excludes: ['trait.dark_adapted'],
  },
  'trait.battle_shy': {
    name: 'Battle-shy', flavour: 'Freezes when the shooting starts.', kind: 'phobia', weight: 5, rollable: false,
    effect: 'Afraid of combat: avoids jobs near hostiles; panics if it lasts.',
    excludes: ['trait.brave', 'trait.thrill_seeker'],
  },
  'trait.drinker': {
    name: 'Drinker', flavour: 'Just one to take the edge off.', kind: 'habit', weight: 5, rollable: false,
    effect: 'Craves spirits; withdrawal without them.',
    excludes: ['trait.stim_hooked'],
  },
  'trait.stim_hooked': {
    name: 'Stim-hooked', flavour: 'Ran double shifts on a mining rig.', kind: 'habit', weight: 2, rollable: false,
    effect: 'Craves stims; works faster dosed, withdrawal without them.',
    excludes: ['trait.drinker'],
  },
  // --- Trade-offs ---
  'trait.strong': {
    name: 'Strong', flavour: 'Carries the crate and the guy on it.', kind: 'tradeoff', weight: 5, rollable: true,
    effect: 'Carry x1.5, melee +1. Gets hungry 1.25x as fast.',
    excludes: ['trait.bookish'],
    modifiers: [{ stat: 'carryCapacity', op: 'mul', value: 1.5 }, { stat: 'melee', op: 'add', value: 1 }],
    effects: { hungerMult: 1.25 },
  },
  'trait.quick': {
    name: 'Quick', flavour: "Walks like the deck's on fire.", kind: 'tradeoff', weight: 5, rollable: true,
    effect: 'Move speed x1.15. Tires 1.15x as fast.',
    modifiers: [{ stat: 'moveSpeed', op: 'mul', value: 1.15 }, { stat: 'restDecay', op: 'mul', value: 1.15 }],
  },
  'trait.tough': {
    name: 'Tough', flavour: 'Hard to put down.', kind: 'tradeoff', weight: 5, rollable: true,
    effect: 'Max hp x1.2; lasts 1.5x as long downed before bleeding out. Move speed x0.95.',
    excludes: ['trait.bookish'], modifiers: [{ stat: 'moveSpeed', op: 'mul', value: 0.95 }],
    effects: { maxHpMult: 1.2, bleedMult: 1.5 },
  },
  'trait.bookish': {
    name: 'Bookish', flavour: 'Reads the manual.', kind: 'tradeoff', weight: 5, rollable: true,
    effect: 'Science, medicine and hacking XP x1.5. Max hp x0.85, carry x0.75.',
    excludes: ['trait.strong', 'trait.tough'], modifiers: [{ stat: 'carryCapacity', op: 'mul', value: 0.75 }],
    effects: { maxHpMult: 0.85, xpMult: 1.5, xpSkills: ['science', 'medicine', 'hacking'] },
  },
  'trait.small_appetite': {
    name: 'Small appetite', flavour: 'Half a ration is plenty.', kind: 'tradeoff', weight: 5, rollable: true,
    effect: 'Gets hungry 0.7x as fast. Well fed and hot meals give half the mood.',
    excludes: ['trait.glutton'], effects: { hungerMult: 0.7, foodMoodMult: 0.5 },
  },
  'trait.glutton': {
    name: 'Glutton', flavour: 'Ate your ration too.', kind: 'tradeoff', weight: 10, rollable: true,
    effect: 'Well fed and hot meals give double the mood. Gets hungry 1.3x as fast; goes to eat below 50 hunger (not 35).',
    excludes: ['trait.small_appetite'], effects: { hungerMult: 1.3, foodMoodMult: 2, eatBelow: 50 },
  },
  'trait.void_born': {
    name: 'Void-born', flavour: 'Spacewalks before breakfast.', kind: 'tradeoff', weight: 2, rollable: true,
    effect: 'Suit air lasts 1.5x as long; no walking penalty in a suit. Cooped up -3 mood after 30 min without EVA.',
    excludes: ['trait.void_fear'], effects: { suitAirMult: 1.5, noSuitSlow: true, voidHome: true },
  },
  'trait.dark_adapted': {
    name: 'Dark-adapted', flavour: 'Grew up on a dim station.', kind: 'tradeoff', weight: 5, rollable: true,
    effect: 'No slowdown or mood penalty in the dark. Glare -3 mood on brightly lit tiles.',
    excludes: ['trait.dark_fear'], effects: { darkAdapted: true },
  },
  'trait.gifted': {
    name: 'Gifted', flavour: 'Learns it once.', kind: 'tradeoff', weight: 2, rollable: true,
    effect: 'All XP x1.5. Restless -3 mood when idle for 10 s.',
    effects: { xpMult: 1.5, idleMood: { key: 'restless', value: -3, afterSec: 10 } },
  },
  // --- Texture ---
  'trait.marksman': {
    name: 'Marksman', flavour: 'Never misses twice.', kind: 'texture', weight: 5, rollable: true,
    effect: 'Gunnery +1.', excludes: ['trait.clumsy'], modifiers: [{ stat: 'gunnery', op: 'add', value: 1 }],
  },
  'trait.natural_pilot': {
    name: 'Natural pilot', flavour: 'Flies by feel.', kind: 'texture', weight: 5, rollable: true,
    effect: 'Piloting +1.', modifiers: [{ stat: 'piloting', op: 'add', value: 1 }],
  },
  'trait.clumsy': {
    name: 'Clumsy', flavour: 'Drops tools. Drops guns.', kind: 'texture', weight: 5, rollable: true,
    effect: 'Melee -1, gunnery -1, work speed x0.95.', excludes: ['trait.marksman'],
    modifiers: [{ stat: 'melee', op: 'add', value: -1 }, { stat: 'gunnery', op: 'add', value: -1 }, { stat: 'workSpeed', op: 'mul', value: 0.95 }],
  },
} satisfies Record<string, TraitDef>;
