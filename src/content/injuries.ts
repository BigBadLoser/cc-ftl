import type { InjuryContent } from '../sim';

/**
 * The body map and injury tables (DESIGN.md "Injuries and cyberware", slice 1, #601). First-pass numbers: a part's kinds take `damage` of
 * its condition while fresh; sources pick a part by weight, then a kind that fits it from their minor or serious list.
 */

const ARMS = ['part.arm_left', 'part.arm_right'];
const LEGS = ['part.leg_left', 'part.leg_right'];
const EYES = ['part.eye_left', 'part.eye_right'];
const ALL_SKILLS = { gunnery: 0.6, piloting: 0.6, shielding: 0.6, melee: 0.6, construction: 0.6, hacking: 0.6, medicine: 0.6, science: 0.6, cooking: 0.6, botany: 0.6, industry: 0.6 };

export const injuries = {
  parts: {
    'part.brain': { name: 'Brain', group: 'head', capacity: 'consciousness', share: 1, vital: true, slot: 'brain' },
    'part.eye_right': { name: 'Right eye', group: 'head', capacity: 'sight', share: 0.5, side: 'right', slot: 'eye' },
    'part.eye_left': { name: 'Left eye', group: 'head', capacity: 'sight', share: 0.5, side: 'left', slot: 'eye' },
    'part.heart': { name: 'Heart', group: 'torso', capacity: 'bloodPumping', share: 1, vital: true, slot: 'heart' },
    'part.lungs': { name: 'Lungs', group: 'torso', capacity: 'breathing', share: 1, vital: true, slot: 'lungs' },
    'part.spine': { name: 'Spine', group: 'torso', capacity: 'moving', gate: true, slot: 'spine' },
    'part.arm_right': { name: 'Right arm', group: 'limb', capacity: 'manipulation', share: 0.5, side: 'right', slot: 'arm' },
    'part.arm_left': { name: 'Left arm', group: 'limb', capacity: 'manipulation', share: 0.5, side: 'left', slot: 'arm' },
    'part.leg_right': { name: 'Right leg', group: 'limb', capacity: 'moving', share: 0.5, side: 'right', slot: 'leg' },
    'part.leg_left': { name: 'Left leg', group: 'limb', capacity: 'moving', share: 0.5, side: 'left', slot: 'leg' },
  },
  capacities: {
    manipulation: { name: 'Manipulation', effect: 'slower at work, weaker in a fight', stats: { workSpeed: 0.4, melee: 0.6, construction: 0.6, industry: 0.6, cooking: 0.5 } },
    moving: { name: 'Moving', effect: 'walks slower, carries less', stats: { moveSpeed: 0.8, carryCapacity: 0.5 } },
    // One eye lost costs part of it, both most of it.
    sight: { name: 'Sight', floor: 0.1, effect: 'worse aim, slower research', stats: { gunnery: 0.8, melee: 0.4, science: 0.5 } },
    consciousness: { name: 'Consciousness', effect: 'every skill and all work slower; very low knocks them out', stats: { workSpeed: 0.6, ...ALL_SKILLS } },
    // Suit air (crew/body.ts `breathMult`) and exertion.
    breathing: { name: 'Breathing', effect: 'suit air lasts less, slower when out of breath', stats: { workSpeed: 0.25, moveSpeed: 0.2 } },
    // Bleed-out time and healing speed (crew/body.ts `bleedOutMult`, `healMult`).
    bloodPumping: { name: 'Circulation', effect: 'bleeds out sooner, heals slower', stats: { workSpeed: 0.15 } },
  },
  kinds: {
    'injury.bruise': { name: 'Bruise', severity: 'minor', damage: 0.1, healSec: 300 },
    'injury.cut': { name: 'Cut', severity: 'minor', damage: 0.15, healSec: 420, bleed: 0.2, bleedSec: 90, parts: [...ARMS, ...LEGS, ...EYES] },
    'injury.puncture': { name: 'Puncture', severity: 'minor', damage: 0.2, healSec: 600, bleed: 0.3, bleedSec: 120 },
    'injury.burn': { name: 'Burn', severity: 'minor', damage: 0.15, healSec: 480 },
    'injury.decompression': { name: 'Burst vessels', severity: 'minor', damage: 0.15, healSec: 360, parts: ['part.lungs', ...EYES] },
    'injury.fracture': { name: 'Fracture', severity: 'serious', damage: 0.5, healSec: 1200, scarLoss: 0.15, parts: [...ARMS, ...LEGS, 'part.spine'] },
    'injury.deep_burn': { name: 'Deep burn', severity: 'serious', damage: 0.45, healSec: 1500, scarLoss: 0.15, parts: [...ARMS, ...LEGS, ...EYES, 'part.lungs'] },
    'injury.concussion': { name: 'Concussion', severity: 'serious', damage: 0.4, healSec: 900, scarLoss: 0.1, parts: ['part.brain'] },
    'injury.organ_damage': { name: 'Organ damage', severity: 'serious', damage: 0.4, healSec: 1500, scarLoss: 0.15, parts: ['part.heart', 'part.lungs', ...EYES] },
    // Surgery (#311): a failed operation's wound, and a lost limb taken off (a destroyed entry: the slot is ready for a cyber limb).
    'injury.surgical': { name: 'Surgical wound', severity: 'serious', damage: 0.4, healSec: 1200, scarLoss: 0.1, bleed: 0.2, bleedSec: 60 },
    'injury.amputated': { name: 'Amputated', severity: 'serious', damage: 1, healSec: 1, parts: [...ARMS, ...LEGS] },
  },
  sources: {
    // Bullets mostly hit the torso.
    bullet: {
      name: 'a gunshot',
      threshold: 8, chance: 0.25, seriousAt: 40,
      parts: { 'part.lungs': 3, 'part.heart': 1, 'part.spine': 1.5, 'part.arm_left': 2, 'part.arm_right': 2, 'part.leg_left': 2, 'part.leg_right': 2, 'part.brain': 0.5, 'part.eye_left': 0.25, 'part.eye_right': 0.25 },
      minor: ['injury.puncture', 'injury.bruise'], serious: ['injury.organ_damage', 'injury.fracture', 'injury.concussion'],
    },
    // Blades and blows: arms and head.
    blade: {
      name: 'a blade or a blow',
      threshold: 8, chance: 0.3, seriousAt: 40,
      parts: { 'part.arm_left': 3, 'part.arm_right': 3, 'part.brain': 2, 'part.eye_left': 0.5, 'part.eye_right': 0.5, 'part.leg_left': 1, 'part.leg_right': 1, 'part.lungs': 0.5, 'part.heart': 0.3, 'part.spine': 0.5 },
      minor: ['injury.cut', 'injury.bruise'], serious: ['injury.fracture', 'injury.concussion', 'injury.organ_damage'],
    },
    // Shrapnel and blasts spread.
    blast: {
      name: 'a blast',
      threshold: 4, chance: 0.5, seriousAt: 30,
      parts: { 'part.brain': 1, 'part.eye_left': 0.5, 'part.eye_right': 0.5, 'part.heart': 1, 'part.lungs': 1, 'part.spine': 1, 'part.arm_left': 1, 'part.arm_right': 1, 'part.leg_left': 1, 'part.leg_right': 1 },
      minor: ['injury.bruise', 'injury.cut', 'injury.burn'], serious: ['injury.fracture', 'injury.deep_burn', 'injury.concussion', 'injury.organ_damage'],
    },
    // Fire burns several parts at once, each time its harm adds up to the threshold.
    fire: {
      name: 'fire',
      threshold: 15, chance: 1, seriousAt: Infinity, seriousChance: 0.15, count: 2,
      parts: { 'part.arm_left': 2, 'part.arm_right': 2, 'part.leg_left': 2, 'part.leg_right': 2, 'part.eye_left': 0.5, 'part.eye_right': 0.5, 'part.lungs': 1 },
      minor: ['injury.burn'], serious: ['injury.deep_burn'],
    },
    // Vacuum and thin air: lungs and eyes.
    vacuum: {
      name: 'vacuum',
      threshold: 15, chance: 1, seriousAt: Infinity, seriousChance: 0.1,
      parts: { 'part.lungs': 3, 'part.eye_left': 1, 'part.eye_right': 1 },
      minor: ['injury.decompression'], serious: ['injury.organ_damage'],
    },
    // Going down always adds one serious injury.
    downed: {
      name: 'going down',
      threshold: 0, chance: 1, seriousAt: 0, seriousChance: 1,
      parts: { 'part.arm_left': 1, 'part.arm_right': 1, 'part.leg_left': 1, 'part.leg_right': 1, 'part.spine': 0.5, 'part.lungs': 1, 'part.heart': 0.5, 'part.brain': 0.7, 'part.eye_left': 0.3, 'part.eye_right': 0.3 },
      minor: ['injury.bruise'], serious: ['injury.fracture', 'injury.organ_damage', 'injury.concussion'],
    },
  },
} satisfies InjuryContent;
