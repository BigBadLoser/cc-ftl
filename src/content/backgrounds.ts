import type { CareerDef, UpbringingDef } from '../sim';

/**
 * Backgrounds (docs/TRAITS.md 10.5). A person rolls one upbringing (about 3 points) and one career (about 7), then noise, a rare knack,
 * interests, a rare won't-do and traits (crew/backgroundRoll.ts). Weights: 10 common, 5 uncommon, 2 rare.
 */
export const upbringings = {
  'upbringing.station_brat': {
    name: 'Station brat', line: 'grew up in a dockside hab', weight: 10,
    skills: { hacking: 2, construction: 1 }, interests: { hacking: 1 }, traitWeights: { 'trait.social': 2 },
  },
  'upbringing.belt_born': {
    name: 'Belt-born', line: 'grew up on a mining rock', weight: 10,
    skills: { piloting: 1, construction: 1, shielding: 1 }, interests: { piloting: 1 }, traitWeights: { 'trait.void_born': 3, 'trait.space_sick': 0 },
  },
  'upbringing.colony_farmer': {
    name: 'Colony farmer', line: 'grew up on a farm colony', weight: 10,
    skills: { botany: 2, cooking: 1 }, interests: { botany: 1 }, traitWeights: { 'trait.strong': 2 },
  },
  'upbringing.factory_district': {
    name: 'Factory district', line: 'grew up between the smelters', weight: 10,
    skills: { industry: 2, construction: 1 }, interests: { industry: 1 }, traitWeights: { 'trait.workaholic': 2 },
  },
  'upbringing.navy_family': {
    name: 'Navy family', line: 'grew up on a navy base', weight: 5,
    skills: { gunnery: 2, piloting: 1 }, interests: { gunnery: 1 }, traitWeights: { 'trait.brave': 2 },
  },
  'upbringing.academy': {
    name: 'Core-world academy', line: 'was schooled on a core world', weight: 5,
    skills: { science: 2, medicine: 1 }, interests: { science: 1 }, traitWeights: { 'trait.bookish': 3 },
  },
  'upbringing.frontier_settler': {
    name: 'Frontier settler', line: 'grew up on the frontier', weight: 10,
    skills: { construction: 1, melee: 1, botany: 1 }, interests: { construction: 1 }, traitWeights: { 'trait.tough': 2 },
  },
  'upbringing.monastery_ward': {
    name: 'Monastery ward', line: 'was raised by a quiet order', weight: 2,
    skills: { medicine: 2, botany: 1 }, interests: { medicine: 1 }, wontDo: { id: 'violence', chance: 0.4 },
    traitWeights: { 'trait.stoic': 2, 'trait.hot_headed': 0.5 },
  },
  'upbringing.gang_runner': {
    name: 'Gang runner', line: 'ran with a station gang', weight: 5,
    skills: { melee: 2, hacking: 1 }, interests: { melee: 1 }, traitWeights: { 'trait.hot_headed': 2 },
  },
} satisfies Record<string, UpbringingDef>;

export const careers = {
  'career.salvage_diver': {
    name: 'Salvage diver', line: 'cut wrecks for a living', weight: 10,
    skills: { construction: 5, piloting: 2 }, interests: { construction: 1 }, upbringings: { 'upbringing.belt_born': 3, 'upbringing.station_brat': 2 },
  },
  'career.dock_mechanic': {
    name: 'Dock mechanic', line: 'kept freighters flying at a dock', weight: 10,
    skills: { construction: 5, hacking: 1, industry: 1 }, interests: { construction: 1 }, upbringings: { 'upbringing.station_brat': 3, 'upbringing.factory_district': 2 },
  },
  'career.factory_hand': {
    name: 'Factory hand', line: 'worked a fabricator line', weight: 10,
    skills: { industry: 5, construction: 2 }, interests: { industry: 1 }, upbringings: { 'upbringing.factory_district': 3 },
  },
  'career.hydroponics_tech': {
    name: 'Hydroponics tech', line: 'ran a hydroponics deck', weight: 10,
    skills: { botany: 5, cooking: 1, science: 1 }, interests: { botany: 1 }, upbringings: { 'upbringing.colony_farmer': 3 },
  },
  'career.navy_gunner': {
    name: 'Navy gunner', line: 'served a navy gun deck', weight: 10,
    skills: { gunnery: 5, melee: 2 }, interests: { gunnery: 1 }, upbringings: { 'upbringing.navy_family': 3 },
  },
  'career.freight_pilot': {
    name: 'Freight pilot', line: 'flew freight on the long lanes', weight: 10,
    skills: { piloting: 5, shielding: 2 }, interests: { piloting: 1 }, upbringings: { 'upbringing.belt_born': 3 },
  },
  'career.field_medic': {
    name: 'Field medic', line: 'patched people up under fire', weight: 10,
    skills: { medicine: 5, cooking: 1, melee: 1 }, interests: { medicine: 1 }, upbringings: { 'upbringing.navy_family': 2, 'upbringing.monastery_ward': 3 },
  },
  'career.lab_tech': {
    name: 'Lab tech', line: 'ran samples in a research lab', weight: 10,
    skills: { science: 5, hacking: 2 }, interests: { science: 1 }, upbringings: { 'upbringing.academy': 3 },
  },
  'career.galley_cook': {
    name: 'Galley cook', line: 'cooked in a ship’s galley', weight: 10,
    skills: { cooking: 5, botany: 1, melee: 1 }, interests: { cooking: 1 }, wontDo: { id: 'hauling', chance: 0.15 }, upbringings: { 'upbringing.colony_farmer': 3 },
  },
  'career.bouncer': {
    name: 'Bouncer', line: 'kept the peace in a dockside bar', weight: 10,
    skills: { melee: 5, gunnery: 2 }, interests: { melee: 1 }, wontDo: { id: 'hauling', chance: 0.1 }, upbringings: { 'upbringing.gang_runner': 3 },
  },
  'career.systems_tech': {
    name: 'Systems tech', line: 'tuned shield and power systems', weight: 10,
    skills: { shielding: 4, construction: 2, industry: 1 }, interests: { shielding: 1 }, upbringings: { 'upbringing.academy': 2, 'upbringing.factory_district': 2 },
  },
  'career.data_broker': {
    name: 'Data broker', line: 'bought and sold other people’s secrets', weight: 5,
    skills: { hacking: 5, science: 2 }, interests: { hacking: 1 }, wontDo: { id: 'violence', chance: 0.1 }, upbringings: { 'upbringing.station_brat': 3 },
  },
  'career.mercenary': {
    name: 'Mercenary', line: 'fought for whoever paid', weight: 5,
    skills: { gunnery: 3, melee: 3, medicine: 1 }, interests: { gunnery: 1 }, wontDo: { id: 'medical', chance: 0.1 },
    upbringings: { 'upbringing.gang_runner': 3, 'upbringing.frontier_settler': 2 },
  },
  'career.drifter': { name: 'Drifter', line: 'drifted from job to job', weight: 2, skills: {}, drifter: true },
} satisfies Record<string, CareerDef>;
