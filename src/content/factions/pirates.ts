import type { FactionDef } from '../../sim';
import { scrapper } from './scrapper';

/**
 * The four pirate factions beyond the Scrappers (phase 2b). Their hulls are the Scrappers' own families: every faction is told apart by loadout,
 * budget, crew and doctrine, not by new hull shapes (hull generation belongs to the shipgen session), and they wear the scrapper art until the
 * faction liveries land (#127, the `livery.<id>` hooks below). Weights and numbers are provisional.
 */
const family = (id: string): (typeof scrapper.hullFamilies)[number] => scrapper.hullFamilies.find((f) => f.id === id) as (typeof scrapper.hullFamilies)[number];
const role = (id: string): (typeof scrapper.architecture.roles)[number] => scrapper.architecture.roles.find((r) => r.id === id) as (typeof scrapper.architecture.roles)[number];

const base = {
  motif: scrapper.motif,
  transition: scrapper.transition,
  salvage: scrapper.salvage,
  shields: scrapper.shields,
  living: true,
  aiCore: false,
} as const;

const architecture = (roles: FactionDef['architecture']['roles']): FactionDef['architecture'] => ({ ...scrapper.architecture, roles });

/**
 * Raider clan: fast, light, boarding-minded. Mostly small hulls with extra engines and big crews, ion cannons that disable rather than destroy, and an
 * early boarding party. Once the party is out the ship holds fire (`boarding.prefer`): they want your ship, not its wreck.
 */
export const raider = {
  ...base,
  name: 'Raider clan',
  art: { ...scrapper.art, livery: 'livery.raider' },
  architecture: architecture([{ ...role('raider'), weight: { base: 5, perDepth: 0, max: 5 } }, { ...role('gunrunner'), weight: { base: 0, perDepth: 0.3, max: 2 } }]),
  hullFamilies: [{ ...family('raider'), weight: { base: 5, perDepth: 0, max: 5 } }, { ...family('gunrunner'), weight: { base: 0, perDepth: 0.3, max: 2 } }],
  weapons: { light: [{ value: 'module.ionCannon', weight: 3 }, { value: 'module.burstLaser', weight: 2 }], heavy: [{ value: 'module.massDriver', weight: 1 }] },
  stock: [{ item: 'item.scrap', min: 1, max: 4 }, { item: 'item.metal', min: 0, max: 3 }],
  crew: {
    required: ['role.pilot', 'role.gunner', 'role.security', 'role.security', 'role.security'],
    pool: [{ value: 'role.security', weight: 4 }, { value: 'role.engineer', weight: 1 }],
    species: ['species.human'],
  },
  doctrine: { targeting: 'weapons', boarding: { party: 4, afterSec: 20, losingBelow: 0.6, weapon: 'item.blade', prefer: true } },
  budget: {
    weapons: { base: 1.2, perDepth: 0.3, max: 3.5 },
    heavyPct: { base: 0, perDepth: 3, max: 20 },
    shields: { base: 0, perDepth: 0.2, max: 1 },
    engines: { base: 2, perDepth: 0.4, max: 4 },
    reactors: { base: 2, perDepth: 0.25, max: 3 },
    pointDefense: { base: 0, perDepth: 0, max: 0 },
    crew: { base: 6, perDepth: 0.5, max: 10 },
    crates: { base: 1, perDepth: 0.3, max: 4 },
    size: { base: 0, perDepth: 0.3, max: 2 },
  },
} satisfies FactionDef;

/**
 * Cartel: cargo-heavy ships with missiles. Haulers first, a few gunrunners deeper in; crates in bulk (missiles among them), no boarding party:
 * the cartel would rather be paid than fight.
 */
export const cartel = {
  ...base,
  name: 'Cartel',
  art: { ...scrapper.art, livery: 'livery.cartel' },
  architecture: architecture([{ ...role('hauler'), weight: { base: 5, perDepth: 0, max: 5 }, bonus: { crates: 8, weapons: -1, size: 1 } }, { ...role('gunrunner'), weight: { base: 0, perDepth: 0.35, max: 2 } }]),
  hullFamilies: [{ ...family('hauler'), weight: { base: 5, perDepth: 0, max: 5 }, bonus: { crates: 8, weapons: -1 } }, { ...family('gunrunner'), weight: { base: 0, perDepth: 0.35, max: 2 } }],
  weapons: { light: [{ value: 'module.burstLaser', weight: 2 }, { value: 'module.missileLauncher', weight: 2 }], heavy: [{ value: 'module.missileLauncher', weight: 3 }, { value: 'module.massDriver', weight: 1 }] },
  stock: [{ item: 'item.missile', min: 3, max: 9 }, { item: 'item.metal', min: 1, max: 6 }, { item: 'item.electronics', min: 0, max: 3 }, { item: 'item.parts', min: 0, max: 3 }],
  crew: {
    required: ['role.pilot', 'role.gunner', 'role.security'],
    pool: [{ value: 'role.security', weight: 2 }, { value: 'role.engineer', weight: 2 }, { value: 'role.gunner', weight: 1 }],
    species: ['species.human'],
  },
  doctrine: { targeting: 'random' },
  budget: {
    weapons: { base: 1.4, perDepth: 0.3, max: 4 },
    heavyPct: { base: 25, perDepth: 4, max: 55 },
    shields: { base: 0.3, perDepth: 0.25, max: 2 },
    engines: { base: 1, perDepth: 0.3, max: 3 },
    reactors: { base: 2, perDepth: 0.3, max: 4 },
    pointDefense: { base: 0, perDepth: 0, max: 0 },
    crew: { base: 4, perDepth: 0.4, max: 8 },
    crates: { base: 9, perDepth: 0.9, max: 20 },
    size: { base: 0.5, perDepth: 0.5, max: 4 },
  },
} satisfies FactionDef;

/** Mercenaries: balanced, well-equipped professionals. Shields, a mix of guns, a medic in the crew; they fight to win and do not board. */
export const mercenary = {
  ...base,
  name: 'Mercenary',
  art: { ...scrapper.art, livery: 'livery.mercenary' },
  architecture: architecture([{ ...role('raider'), weight: { base: 3, perDepth: 0, max: 3 } }, { ...role('gunrunner'), weight: { base: 1, perDepth: 0.3, max: 3 } }]),
  hullFamilies: [{ ...family('raider'), weight: { base: 3, perDepth: 0, max: 3 } }, { ...family('gunrunner'), weight: { base: 1, perDepth: 0.3, max: 3 } }],
  weapons: { light: [{ value: 'module.burstLaser', weight: 3 }, { value: 'module.ionCannon', weight: 1 }], heavy: [{ value: 'module.massDriver', weight: 2 }, { value: 'module.missileLauncher', weight: 1 }] },
  stock: [{ item: 'item.missile', min: 0, max: 4 }, { item: 'item.metal', min: 0, max: 4 }, { item: 'item.electronics', min: 0, max: 2 }],
  crew: {
    required: ['role.pilot', 'role.gunner', 'role.security', 'role.engineer'],
    pool: [{ value: 'role.security', weight: 2 }, { value: 'role.gunner', weight: 2 }, { value: 'role.engineer', weight: 1 }, { value: 'role.medic', weight: 1 }],
    species: ['species.human'],
  },
  doctrine: { targeting: 'weapons' },
  budget: {
    weapons: { base: 2, perDepth: 0.4, max: 5 },
    heavyPct: { base: 15, perDepth: 5, max: 45 },
    shields: { base: 1, perDepth: 0.3, max: 3 },
    engines: { base: 1.5, perDepth: 0.3, max: 3 },
    reactors: { base: 2, perDepth: 0.3, max: 4 },
    pointDefense: { base: 0, perDepth: 0, max: 0 },
    crew: { base: 5, perDepth: 0.5, max: 9 },
    crates: { base: 2, perDepth: 0.3, max: 6 },
    size: { base: 0, perDepth: 0.4, max: 3 },
  },
} satisfies FactionDef;

/**
 * Zealots: a machine-god cult. Augmented crews (`species.augmented`, fearless) with fire weapons; the boarding party goes for the target's AI core and
 * tears it out if it holds it (sim/capture/coreRaid.ts). They never surrender, so a fight with them ends in a derelict. Flies on the Rogue AI's side.
 */
export const zealot = {
  ...base,
  name: 'Zealot',
  side: 'rogue',
  art: { ...scrapper.art, livery: 'livery.zealot' },
  architecture: architecture([{ ...role('raider'), weight: { base: 3, perDepth: 0, max: 3 } }, { ...role('gunrunner'), weight: { base: 1, perDepth: 0.3, max: 3 } }]),
  hullFamilies: [{ ...family('raider'), weight: { base: 3, perDepth: 0, max: 3 } }, { ...family('gunrunner'), weight: { base: 1, perDepth: 0.3, max: 3 } }],
  weapons: { light: [{ value: 'module.incendiaryLauncher', weight: 4 }, { value: 'module.burstLaser', weight: 1 }], heavy: [{ value: 'module.incendiaryLauncher', weight: 2 }, { value: 'module.massDriver', weight: 1 }] },
  stock: [{ item: 'item.electronics', min: 0, max: 3 }, { item: 'item.parts', min: 0, max: 3 }],
  neverSurrender: true,
  crew: {
    required: ['role.zealot_pilot', 'role.zealot_gunner', 'role.zealot_guard', 'role.zealot_guard'],
    pool: [{ value: 'role.zealot_guard', weight: 3 }, { value: 'role.zealot_engineer', weight: 2 }, { value: 'role.zealot_gunner', weight: 1 }],
    species: ['species.augmented'],
  },
  doctrine: { targeting: 'weapons', boarding: { party: 3, afterSec: 30, losingBelow: 0.6, weapon: 'item.blade', coreRaid: true } },
  budget: {
    weapons: { base: 1.6, perDepth: 0.35, max: 4.5 },
    heavyPct: { base: 10, perDepth: 5, max: 40 },
    shields: { base: 0, perDepth: 0.25, max: 2 },
    engines: { base: 1, perDepth: 0.3, max: 3 },
    reactors: { base: 2, perDepth: 0.3, max: 4 },
    pointDefense: { base: 0, perDepth: 0, max: 0 },
    crew: { base: 5, perDepth: 0.5, max: 9 },
    crates: { base: 1, perDepth: 0.3, max: 4 },
    size: { base: 0, perDepth: 0.4, max: 3 },
  },
} satisfies FactionDef;
