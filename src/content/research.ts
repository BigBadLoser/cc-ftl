import type { ResearchDef } from '../sim';

/**
 * Research projects: the Mk II and Mk III core modules, the alternative to buying their blueprints at a station. Costs are taken from the
 * ship's stock when the project becomes the active one; `work` is ticks at workSpeed 1 (20 per second), sped up by science and by a second
 * research module. All the numbers are here, provisional.
 *
 * Mk II needs electronics and data cores, Mk III more of both plus rarer finds (artifacts, alien tissue). Neither of those three items exists
 * yet: spare parts (`item.parts`, the electronics-grade salvage) stand in for data cores and rare ore (`item.rare_ore`) for the rare finds,
 * until the items come.
 */
const DATA_CORE = 'item.parts';
const RARE = 'item.rare_ore';

interface Family { base: string; name: string; band: string; mk2: number; mk3: number }
const FAMILIES: Family[] = [
  { base: 'module.reactor', name: 'Reactor', band: 'power', mk2: 2400, mk3: 4800 },
  { base: 'module.shieldGen', name: 'Shield gen', band: 'defence', mk2: 2400, mk3: 4800 },
  { base: 'module.engine', name: 'Engine', band: 'propulsion', mk2: 2400, mk3: 4800 },
];

function project(f: Family, n: 2 | 3): [string, ResearchDef] {
  const id = `research.${f.base.slice('module.'.length)}.mk${n}`;
  const cost = n === 2
    ? [{ item: 'item.electronics', count: 20 }, { item: DATA_CORE, count: 6 }]
    : [{ item: 'item.electronics', count: 40 }, { item: DATA_CORE, count: 12 }, { item: RARE, count: 8 }];
  return [id, {
    name: `${f.name} Mk ${n === 2 ? 'II' : 'III'}`,
    cost,
    work: n === 2 ? f.mk2 : f.mk3,
    category: f.band,
    unlocks: [`${f.base}.mk${n}`],
    requires: [n === 2 ? f.base : `${f.base}.mk2`],
  }];
}

/** The tree's bands, top to bottom (ids are `ResearchDef.category`). */
export const researchBands = [
  { id: 'power', name: 'Power' },
  { id: 'defence', name: 'Defence' },
  { id: 'propulsion', name: 'Propulsion' },
] as const;

export const research: Record<string, ResearchDef> = Object.fromEntries(FAMILIES.flatMap((f) => [project(f, 2), project(f, 3)]));
