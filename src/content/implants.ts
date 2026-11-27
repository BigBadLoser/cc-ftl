import type { ItemDef, Modifier, SkillName } from '../sim';

/**
 * Implants (DESIGN.md "Injuries and cyberware", the implant table, #311): items a surgeon fits to a body part (crew/surgery.ts). First-pass numbers from the
 * user-approved table. Replacements set their part's condition (`capacity`, flesh = 1); augments add modifiers beside the flesh part. `load` is the cyber points
 * (heavily augmented at `HEAVY_LOAD`), `ionSec` the shutdown an ion hit will cause (slice 2b), 2 s per load point. Reflex boosters Mk II-III and dermal armour Mk II-III
 * are military: contraband (the Mk I booster is a civilian mover's aid). Placeholder art: the generic implant icon. Not yet in effect: the Mk III eye's dark sight and the Mk III lungs' thin-air work.
 */

const add = (stat: Modifier['stat'], value: number): Modifier => ({ stat, op: 'add', value });
const mul = (stat: Modifier['stat'], value: number): Modifier => ({ stat, op: 'mul', value });
const base: Pick<ItemDef, 'tags' | 'stackSize' | 'art'> = { tags: ['implant'], stackSize: 4, art: 'item.implant' };
const ion = (load: number) => ({ load, ionSec: 2 * load });

/** The neural chips: one item per skill and tier (a sensible few to start). */
const SKILL_NAMES: Partial<Record<SkillName, string>> = { gunnery: 'gunnery', piloting: 'piloting', construction: 'engineering', medicine: 'medical', science: 'science' };
const chips = Object.fromEntries(Object.entries(SKILL_NAMES).flatMap(([skill, name]) => [
  [`item.chip_${skill}_1`, { ...base, name: `Neural chip Mk I (${name})`, price: 160, tier: 1, implant: { slot: 'brain', tier: 1, kind: 'augment', mods: [add(skill as SkillName, 1)], ...ion(1) } }],
  [`item.chip_${skill}_2`, { ...base, name: `Neural chip Mk II (${name})`, price: 380, tier: 2, implant: { slot: 'brain', tier: 2, kind: 'augment', mods: [add(skill as SkillName, 2)], ...ion(2) } }],
  [`item.chip_${skill}_3`, { ...base, name: `Neural chip Mk III (${name})`, price: 900, tier: 3, implant: { slot: 'brain', tier: 3, kind: 'augment', mods: [add(skill as SkillName, 3)], ...ion(3) } }],
])) as Record<string, ItemDef>;

const ALL_SKILLS: SkillName[] = ['gunnery', 'piloting', 'shielding', 'melee', 'construction', 'hacking', 'medicine', 'science', 'cooking', 'botany', 'industry'];

/**
 * Named cyberware: its own kind (`ImplantDef.named`, no Mk tier), found only: never researched, made or sold in a stock list. Same slots as the Mk lines, so
 * surgery and load work as for any implant; the surgery rules treat one as Mk III (crew/implants.ts `implantTier`). `price` is only what a fence pays.
 */
const named = {
  'item.chip_coprocessor': {
    ...base, name: 'Neural co-processor', price: 1200,
    description: 'A brain-stem co-processor of unknown make: every skill a little sharper and the hands a little quicker.',
    implant: { slot: 'brain', named: true, kind: 'augment', mods: [...ALL_SKILLS.map((s) => add(s, 1)), mul('workSpeed', 1.05)], ...ion(3) },
  },
  'item.halcyon_heart': {
    ...base, name: 'Halcyon Heart', price: 2400,
    description: 'A legendary heart replacement. Bleed-out takes four times as long and the body heals twice as fast.',
    implant: { slot: 'heart', named: true, kind: 'replacement', capacity: 1, bleedOutMul: 4, healMul: 2, ...ion(3) },
  },
  'item.hawkeye_lens': {
    ...base, name: 'Hawkeye Lens', price: 1500,
    description: 'A sniper-grade eye: sharper than flesh, and the aim follows.',
    implant: { slot: 'eye', named: true, kind: 'replacement', capacity: 1.2, mods: [add('gunnery', 3)], ...ion(3) },
  },
  'item.titan_arm': {
    ...base, name: 'Titan Arm', price: 1700,
    description: 'A hauler\'s arm built like a piston: hits hard and carries a crate on its own.',
    implant: { slot: 'arm', named: true, kind: 'replacement', capacity: 1.3, mods: [add('melee', 3), add('carryCapacity', 4)], ...ion(4) },
  },
  'item.strider_leg': {
    ...base, name: 'Strider Leg', price: 1500,
    description: 'A spring-loaded leg that eats the deck in long strides.',
    implant: { slot: 'leg', named: true, kind: 'replacement', capacity: 1.3, mods: [mul('moveSpeed', 1.1)], ...ion(3) },
  },
  'item.abyss_lungs': {
    ...base, name: 'Abyss Lungs', price: 1600,
    description: 'Deep-dive lungs: a suit\'s air lasts two and a half times as long.',
    implant: { slot: 'lungs', named: true, kind: 'replacement', capacity: 1.1, suitAirMul: 2.5, ...ion(3) },
  },
  'item.atlas_frame': {
    ...base, name: 'Atlas Frame', price: 1700,
    description: 'A load-bearing spine that shrugs off a heavy burden.',
    implant: { slot: 'spine', named: true, kind: 'replacement', capacity: 1.1, mods: [add('carryCapacity', 5)], ...ion(4) },
  },
  'item.quicksilver': {
    ...base, tags: ['implant', 'contraband'], name: 'Quicksilver', price: 1800,
    description: 'Military reflex wiring, tuned past any standard: fast on the feet and faster with a blade.',
    implant: { slot: 'spine', named: true, kind: 'augment', mods: [mul('moveSpeed', 1.25), add('melee', 3)], contraband: true, ...ion(4) },
  },
  'item.carapace_weave': {
    ...base, tags: ['implant', 'contraband'], name: 'Carapace Weave', price: 1700,
    description: 'Military skin armour woven under the dermis: a quarter of the damage turned away.',
    implant: { slot: 'dermal', named: true, kind: 'augment', armor: 0.25, contraband: true, ...ion(3) },
  },
} satisfies Record<string, ItemDef>;

export const implantItems = {
  'item.cyber_arm_1': { ...base, name: 'Cyber arm Mk I', price: 140, tier: 1, implant: { slot: 'arm', tier: 1, kind: 'replacement', capacity: 0.8, ...ion(1) } },
  'item.cyber_arm_2': { ...base, name: 'Cyber arm Mk II', price: 360, tier: 2, implant: { slot: 'arm', tier: 2, kind: 'replacement', capacity: 1, mods: [add('melee', 1)], ...ion(2) } },
  'item.cyber_arm_3': { ...base, name: 'Cyber arm Mk III', price: 820, tier: 3, implant: { slot: 'arm', tier: 3, kind: 'replacement', capacity: 1.2, mods: [add('melee', 2), add('carryCapacity', 2)], ...ion(3) } },
  'item.cyber_leg_1': { ...base, name: 'Cyber leg Mk I', price: 130, tier: 1, implant: { slot: 'leg', tier: 1, kind: 'replacement', capacity: 0.8, ...ion(1) } },
  'item.cyber_leg_2': { ...base, name: 'Cyber leg Mk II', price: 330, tier: 2, implant: { slot: 'leg', tier: 2, kind: 'replacement', capacity: 1, ...ion(2) } },
  'item.cyber_leg_3': { ...base, name: 'Cyber leg Mk III', price: 760, tier: 3, implant: { slot: 'leg', tier: 3, kind: 'replacement', capacity: 1.15, ...ion(3) } },
  'item.cyber_eye_1': { ...base, name: 'Cyber eye Mk I', price: 150, tier: 1, implant: { slot: 'eye', tier: 1, kind: 'replacement', capacity: 0.8, ...ion(1) } },
  'item.cyber_eye_2': { ...base, name: 'Cyber eye Mk II', price: 380, tier: 2, implant: { slot: 'eye', tier: 2, kind: 'replacement', capacity: 1, mods: [add('gunnery', 1)], ...ion(2) } },
  'item.cyber_eye_3': { ...base, name: 'Cyber eye Mk III', price: 800, tier: 3, implant: { slot: 'eye', tier: 3, kind: 'replacement', capacity: 1.1, mods: [add('gunnery', 1)], ...ion(3) } },
  'item.cyber_lungs_1': { ...base, name: 'Cyber lungs Mk I', price: 220, tier: 1, implant: { slot: 'lungs', tier: 1, kind: 'replacement', capacity: 0.8, ...ion(1) } },
  'item.cyber_lungs_2': { ...base, name: 'Cyber lungs Mk II', price: 450, tier: 2, implant: { slot: 'lungs', tier: 2, kind: 'replacement', capacity: 1, suitAirMul: 1.25, ...ion(2) } },
  'item.cyber_lungs_3': { ...base, name: 'Cyber lungs Mk III', price: 900, tier: 3, implant: { slot: 'lungs', tier: 3, kind: 'replacement', capacity: 1, suitAirMul: 1.6, ...ion(3) } },
  'item.cyber_heart_1': { ...base, name: 'Cyber heart Mk I', price: 240, tier: 1, implant: { slot: 'heart', tier: 1, kind: 'replacement', capacity: 0.8, ...ion(1) } },
  'item.cyber_heart_2': { ...base, name: 'Cyber heart Mk II', price: 480, tier: 2, implant: { slot: 'heart', tier: 2, kind: 'replacement', capacity: 1, bleedOutMul: 1.5, ...ion(2) } },
  'item.cyber_heart_3': { ...base, name: 'Cyber heart Mk III', price: 950, tier: 3, implant: { slot: 'heart', tier: 3, kind: 'replacement', capacity: 1, bleedOutMul: 2, healMul: 1.5, ...ion(3) } },
  'item.spinal_frame_1': { ...base, name: 'Spinal frame Mk I', price: 300, tier: 1, implant: { slot: 'spine', tier: 1, kind: 'replacement', capacity: 0.8, ...ion(2) } },
  'item.spinal_frame_2': { ...base, name: 'Spinal frame Mk II', price: 600, tier: 2, implant: { slot: 'spine', tier: 2, kind: 'replacement', capacity: 1, mods: [add('carryCapacity', 2)], ...ion(3) } },
  'item.spinal_frame_3': { ...base, name: 'Spinal frame Mk III', price: 1000, tier: 3, implant: { slot: 'spine', tier: 3, kind: 'replacement', capacity: 1.15, mods: [add('carryCapacity', 3)], ...ion(4) } },
  ...chips,
  'item.reflex_booster_1': {
    ...base, name: 'Reflex booster Mk I', price: 260, tier: 1,
    implant: { slot: 'spine', tier: 1, kind: 'augment', mods: [mul('moveSpeed', 1.05)], ...ion(1) },
  },
  'item.reflex_booster_2': {
    ...base, tags: ['implant', 'contraband'], name: 'Reflex booster Mk II', price: 520, tier: 2,
    implant: { slot: 'spine', tier: 2, kind: 'augment', mods: [mul('moveSpeed', 1.1), add('melee', 1)], contraband: true, ...ion(2) },
  },
  'item.reflex_booster_3': {
    ...base, tags: ['implant', 'contraband'], name: 'Reflex booster Mk III', price: 980, tier: 3,
    implant: { slot: 'spine', tier: 3, kind: 'augment', mods: [mul('moveSpeed', 1.15), add('melee', 2)], contraband: true, ...ion(3) },
  },
  'item.dermal_armor_1': { ...base, name: 'Dermal armour Mk I', price: 200, tier: 1, implant: { slot: 'dermal', tier: 1, kind: 'augment', armor: 0.05, ...ion(1) } },
  'item.dermal_armor_2': {
    ...base, tags: ['implant', 'contraband'], name: 'Dermal armour Mk II', price: 480, tier: 2,
    implant: { slot: 'dermal', tier: 2, kind: 'augment', armor: 0.1, contraband: true, ...ion(2) },
  },
  'item.dermal_armor_3': {
    ...base, tags: ['implant', 'contraband'], name: 'Dermal armour Mk III', price: 900, tier: 3,
    implant: { slot: 'dermal', tier: 3, kind: 'augment', armor: 0.15, contraband: true, ...ion(3) },
  },
  ...named,
} satisfies Record<string, ItemDef>;
