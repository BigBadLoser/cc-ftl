import type { ModuleDef } from '../../registry';
import { enginesShort, previewHull } from '../generate';
import type { OutlineRecipe, ShipRoom } from '../outlineRecipe';
import type { RoomSpec } from '../plan';
import { messFloor } from '../rooms/rules/mess';
import type { FactionDef, GenResult, HullFamilyDef, ShipRoleDef } from '../types';
import { SLEEPER, barracksSize, sleepersIn } from './quarters';

/**
 * An outline ship type's program beyond its budget (SHIPGEN_V4, "Ship recipes and layout parts"): its recipe looked up
 * on its faction, the role it plans with, its commons and quarters. Nothing here knows a type: the recipe says.
 */

/** A faction's recipe for outline type `type`. */
export function recipeOf(f: FactionDef, type: string): OutlineRecipe {
  const r = f.outline?.[type];
  if (!r) throw new Error(`no outline recipe ${type} for ${f.name}`);
  return r;
}

/**
 * The outline type a seed builds: its hull family's (`previewHull`), a recipe taking that family's even seeds on them
 * (a destroyer, every other frigate); null where the faction has no recipe for it.
 */
export function outlineTypeOf(f: FactionDef, seed: number, depth: number): string | null {
  const fam = previewHull(f, seed, depth), all = Object.entries(f.outline ?? {}).filter(([, r]) => r.family === fam);
  const pick = all.find(([, r]) => !!r.evenSeeds === (seed % 2 === 0)) ?? all.find(([, r]) => !r.evenSeeds);
  return pick?.[0] ?? null;
}

/** The role a type plans with: its family's budget and the recipe's slant. */
export function outlineRole(f: FactionDef, type: string, r: OutlineRecipe): ShipRoleDef {
  const fam = (f.hullFamilies ?? []).find((h) => h.id === r.family) as HullFamilyDef;
  const bonus = { ...(fam.bonus ?? {}) } as Record<string, number>;
  for (const [k, v] of Object.entries(r.bonus ?? {})) bonus[k] = (bonus[k] ?? 0) + v;
  return { id: type, weight: fam.weight, archetypes: [], bonus, ...((r.bays ?? fam.bays) ? { bays: r.bays ?? fam.bays } : {}), ...(r.gunRooms ? { guns: r.gunRooms } : {}) };
}

/** The passengers a type carries at `depth`. */
const paxOf = (r: OutlineRecipe, depth: number): number => (r.passengers ? r.passengers.base + Math.round(r.passengers.perDepth * depth) : 0);

/** A mess: a galley and tables down a long narrow room, the crew's commons. */
export const MESS: RoomSpec = { role: 'support', dept: 'commons', mods: ['module.galley', 'module.mess_table'], ...messFloor(1) };
/**
 * The bigger ships' extra rooms: a med bay with its trauma room behind (a liner's ward with one beside it), a brig round a stasis wheel, a small farm, the
 * mess's pantry (cold stores always), a lounge (a liner's passengers').
 */
export const SHIP_ROOMS: Record<ShipRoom, RoomSpec> = {
  medbay: { role: 'medbay', mods: ['module.med_bed', 'module.med_bed'], w: 5, h: 4, annex: { role: 'medbay', mods: ['module.recovery', 'module.recovery'], w: 5, h: 4 } },
  sickbay: { role: 'medbay', mods: ['module.med_bed', 'module.med_bed'], w: 5, h: 4 },
  // (A liner's: a ward two bays long, its trauma room a slice off one end, as the pantry off the mess.)
  ward: { role: 'medbay', mods: Array<string>(4).fill('module.med_bed'), w: 10, h: 5, annex: { role: 'medbay', mods: ['module.recovery', 'module.recovery'], w: 5, h: 4 } },
  brig: { role: 'armoury', mods: ['module.stasis_wheel'], w: 7, h: 6 },
  farm: { role: 'farm', mods: Array<string>(4).fill('module.hydroponics_large'), w: 14, h: 4 },
  pantry: { role: 'cargo', dept: 'commons', mods: ['module.storage_cold', 'module.storage_cold', 'module.storage_rack'], w: 4, h: 3 },
  lounge: { role: 'support', use: 'lounge', mods: ['module.gametable', 'module.arcade', 'module.bench', 'module.bench'], w: 7, h: 4 },
};

/**
 * The commons a ship adds to its plan: a mess for three crew or more (its pantry off it where the recipe has one; a table
 * for every four aboard, crew and passengers, up to four, three with a pantry), the recipe's extra rooms.
 */
export function shipCommons(r: OutlineRecipe, crew: number, depth: number): RoomSpec[] {
  // (With passengers: a table for every four aboard (four seats each), up to four (three with a pantry beside it, the two in two bays), sized by `messFloor`.)
  const extra = r.rooms ?? [], pax = paxOf(r, depth), tables = Math.min(extra.includes('pantry') ? 3 : 4, Math.ceil((crew + pax) / 4));
  const sized: RoomSpec = pax > 0 ? { ...MESS, mods: ['module.galley', ...Array<string>(tables).fill('module.mess_table')], ...messFloor(tables) } : MESS;
  const mess: RoomSpec = extra.includes('pantry') ? { ...sized, annex: SHIP_ROOMS.pantry } : sized;
  return [...(crew >= 3 ? [mess] : []), ...extra.filter((k) => k !== 'pantry').map((k) => SHIP_ROOMS[k])];
}

/**
 * Single cabins for `n` sleepers: the beds made even, in blocks of four (two cabins each side of the corridor, two rows
 * deep), the last of two where that is all that is left: the layout claims deep floor for them as one block a side
 * (blockLayout.ts), or lays these as rows of cabins where no floor is deep enough (a lane's or a deck's strip).
 */
export function cabinBeds(n: number): RoomSpec[] {
  const beds = 2 * Math.ceil(n / 2);
  return Array.from({ length: Math.ceil(beds / 4) }, (_, i) => Math.min(4, beds - 4 * i))
    .map((k) => ({ role: 'quarters', mods: Array<string>(k).fill('module.bed'), w: 4 * k - 5, h: 7, block: true, cabins: false }));
}

/**
 * The crew's quarters as the recipe sleeps them: the plan's barracks (bunks, or single beds; the recipe's number of rooms),
 * or every bed a cabin in a pair of cabin blocks (one each side, cut by the layout: cabinBlock.ts). `spare` beds past the
 * crew's. Then the passengers' cabins, where it carries them.
 */
export function shipQuarters(r: OutlineRecipe, planned: readonly RoomSpec[], crew: number, spare: number, depth: number): RoomSpec[] {
  const pax = r.passengers ? cabinBeds(paxOf(r, depth)) : [];
  const sleep = r.crew.sleep;
  if (sleep === 'cabins') return [...cabinBeds(crew + spare), ...pax];
  // Barracks: the spare beds shared out, a bunk sleeping two (single beds where the type has them, a piece each).
  const per = sleep === 'beds' ? 1 : SLEEPER.sleepers;
  const rooms = planned.map((q, i) => {
    const n = Math.ceil((sleepersIn(q.mods) + Math.floor(spare / planned.length) + (i < spare % planned.length ? 1 : 0)) / per);
    return { ...q, mods: Array<string>(n).fill(sleep === 'beds' ? 'module.bed' : SLEEPER.def), ...barracksSize(n, true) };
  });
  // (A recipe's number of rooms: the pieces shared out between them, along two walls.)
  const all = rooms.flatMap((q) => q.mods), k = Math.min(r.crew.rooms ?? 0, all.length);
  const shared = Array.from({ length: k }, (_, i) => all.slice(Math.round((i * all.length) / k), Math.round(((i + 1) * all.length) / k)));
  return [...(k > 0 && rooms[0] ? shared.map((mods) => ({ ...(rooms[0] as RoomSpec), mods, ...barracksSize(mods.length) })) : rooms), ...pax];
}

/**
 * Attempts until one passes (as `generateShip`), the last otherwise: `assemble(n, extra)` is attempt `n`, built again
 * with `extra` engines where its hull's engines cannot carry it (as `generateAttempt`).
 */
export function outlineAttempts(defs: Record<string, ModuleDef>, assemble: (n: number, extra: number) => GenResult): GenResult {
  const failures: string[] = [];
  let last: GenResult | null = null;
  let error: unknown = null;
  // An attempt that throws (its rooms fit no hull) is a failure like any other; more engines that no hull holds keep
  // the attempt before them.
  const tryAssemble = (n: number, extra: number): GenResult | null => {
    try { return assemble(n, extra); } catch (e) { error = e; failures.push(e instanceof Error ? e.message : String(e)); return null; }
  };
  for (let n = 0; n < 24; n++) {
    let r = tryAssemble(n, 0);
    if (!r) continue;
    for (let k = 0, extra = 0; k < 3 && r.problems[0]?.startsWith('engines carry'); k++) {
      extra += Math.max(1, enginesShort(defs, r.template));
      const more = tryAssemble(n, extra);
      if (!more) break;
      r = more;
    }
    last = { ...r, failures: [...failures] };
    if (r.problems.length === 0) return last;
    failures.push(r.problems[0] as string);
  }
  if (!last) throw error;
  return last;
}

