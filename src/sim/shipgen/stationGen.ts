import { airlockTiles } from '../modules/airlock';
import { footprintTiles } from '../modules/footprint';
import type { ModuleDef, ShipTemplate } from '../registry';
import { Rng } from '../rng';
import { GEN_ATTEMPTS, finishLayout, seedOf } from './generate';
import { widthProblem } from './validate';
import { arrangeHull } from './navyLayouts';
import { SECURITY_ROLE, planStation } from './stationPlan';
import { STATION_MAX, type StationDef, type StationGrammar, type StationInfo, type StationSize } from './stationTypes';
import { pickWeighted, type ShipPlan } from './plan';
import { stationV2 } from './station2/gen2';
import type { Family } from './station2/template';
import type { FactionDef, GenResult, HullFamilyDef, ShipRoleDef } from './types';

/**
 * Station generator: a size tier and a kind's doctrine (`StationDef`) become a normal shipgen template. The plan comes
 * from `stationPlan.ts`, the structure from the station grammars on the shared arranger (`stationGrammars.ts`), then the
 * ship fit-out and validators run unchanged, with the engine rule off (immobile) and the station rules on top: enough
 * airlock docks and everything inside the template rect, which stays within STATION_MAX.
 */

/** The FactionDef the shared pipeline reads (fit-out stock, transitions, crew species); budgets are unused here. */
export function stationFaction(def: StationDef, size: StationSize): FactionDef {
  const zero = { base: 0, perDepth: 0, max: 0 };
  const fam: HullFamilyDef = {
    id: size, weight: { base: 1, perDepth: 0, max: 1 }, grammars: def.tiers[size].grammars, aspect: [0.7, 1.5], depth: {},
    batteryCols: [1, 1], sponsonChance: 0, sectionRooms: 3, propulsion: ['bank'], ...(def.tiers[size].cages ? { cages: def.tiers[size].cages } : {}), ...(def.atrium ? { atrium: def.atrium } : {}),
    command: def.kind === 'military' ? 'heart' : 'office',
    ...(def.kind === 'trading' ? { market: true } : {}),
  };
  return {
    name: def.name, side: def.side, motif: def.motif, ...(def.berths ? { berths: def.berths } : {}),
    art: { hull: 'hull.clean', wall: 'wall.clean', roof: 'roof.grid', livery: 'livery.navy', signature: [] },
    architecture: { roles: [], symmetry: 0, corridorWidth: [1, 2], strutLength: [1, 3], battery: 2, noses: [] },
    hullFamilies: [fam], transition: def.transition, weapons: def.weapons, shields: def.shields, stock: def.stock,
    living: true, aiCore: true, crew: { required: def.crew.required, pool: def.crew.pool, species: def.crew.species },
    doctrine: { targeting: 'random' },
    budget: { weapons: zero, heavyPct: zero, shields: zero, engines: zero, reactors: zero, pointDefense: zero, crew: zero, crates: zero, size: zero },
  };
}

/** Station rules on top of the ship validators: docks, bounds, size limit. */
export function stationProblems(t: ShipTemplate, defs: Record<string, ModuleDef>, minDocks: number): string[] {
  const out: string[] = [];
  const h = t.rows.length;
  const w = Math.max(...t.rows.map((r) => r.length));
  if (w > STATION_MAX || h > STATION_MAX) out.push(`too big: ${w}x${h} > ${STATION_MAX}`);
  const mods = t.modules ?? [];
  const docks = mods.filter((m) => defs[m.def]?.airlock).length;
  if (docks < minDocks) out.push(`docks: ${docks} < ${minDocks}`);
  for (const m of mods) {
    const def = defs[m.def];
    if (!def) continue;
    const tiles = [...footprintTiles(def, m.x, m.y, m.rot), ...(def.airlock ? ((a) => [a.outer, a.inner, a.inside])(airlockTiles(def, m)) : [])];
    if (tiles.some((p) => p.x < 0 || p.y < 0 || p.x >= w || p.y >= h)) out.push(`${m.def}@${m.x},${m.y}: outside the template`);
  }
  if (mods.some((m) => defs[m.def]?.engine)) out.push('station has an engine');
  const cells: string[] = [];
  for (const r of t.rows) for (let x = 0; x < w; x++) cells.push(r[x] ?? '.');
  const narrow = widthProblem(cells, w, h);
  if (narrow) out.push(narrow);
  return out;
}

/**
 * One v2 attempt: rank candidate layouts (station2/gen2.ts), fit out the best, the next if that fails. The problems of
 * the last one tried stay on the result: a station returned with problems is a failure.
 */
function v2Attempt(
  rng: Rng, def: StationDef, id: string, size: StationSize, seed: number, n: number, plan: ShipPlan, fam: Family,
  role: ShipRoleDef, defs: Record<string, ModuleDef>, failures: string[],
): { result: StationResult | null; power: boolean } {
  const v = stationV2(rng, fam, plan, def.tiers[size].docks);
  if (v.candidates.length === 0) { failures.push(`v2 ${fam}: ${v.why[0] ?? 'no candidate'}`); return { result: null, power: false }; }
  let result: StationResult | null = null;
  let power = false;
  for (const cand of v.candidates.slice(0, 2)) {
    const topo = `${cand.profile} draws ${v.draws} rejected ${v.rejected}`;
    const g = finishLayout(rng, stationFaction(def, size), id, seed, role, 'sections', plan, cand.b, topo, null, topo, defs, n, {
      immobile: true, check: (t, d) => stationProblems(t, d, def.tiers[size].docks),
      swapRoles: false, doorSlide: false, pruneDoors: false, negative: (x, y) => cand.open.has(`${x},${y}`),
    });
    g.template.name = `${def.name} ${size === 'station' ? '' : `${size} `}${(seed >>> 0).toString(16).toUpperCase().padStart(4, '0').slice(-4)}`;
    result = { ...g, failures: [...failures], station: infoOf(def, size, g.template, defs) };
    if (g.problems.length === 0) return { result, power };
    if (g.problems.some((p) => p.includes('power'))) power = true;
    failures.push(`v2 ${fam}: ${g.problems[0]}`);
  }
  return { result, power };
}

export interface StationResult extends GenResult {
  station: StationInfo;
}

const infoOf = (def: StationDef, size: StationSize, t: ShipTemplate, defs: Record<string, ModuleDef>): StationInfo => {
  const mods = t.modules ?? [];
  const n = (p: (d: ModuleDef) => boolean): number => mods.filter((m) => defs[m.def] && p(defs[m.def] as ModuleDef)).length;
  return {
    kind: def.kind, size, crew: (t.crew ?? []).length, security: (t.crew ?? []).filter((r) => r === SECURITY_ROLE).length,
    docks: n((d) => !!d.airlock), guns: n((d) => !!d.weapon), shields: n((d) => !!d.shieldGen),
  };
};

/** Station v2 layouts and the structure each builds. */
const V2: Partial<Record<StationGrammar, Family>> = { stationConcentric2: 'concentric', stationWheel2: 'wheel', stationConcourse2: 'concourse' };

/**
 * The v2 layout attempt `n` builds, if the tier lists any: drawn from its own seed, so tiers without v2 layouts draw
 * nothing and stay exactly as they were.
 */
function v2Family(def: StationDef, size: StationSize, seed: number, n: number): Family | undefined {
  const gs = def.tiers[size].grammars;
  if (!gs.some((g) => V2[g.value])) return undefined;
  return V2[pickWeighted(new Rng(seedOf(seed, n) ^ 0x5bd1e995), gs)];
}

/** Generate a station of `def`'s kind at a size tier, deterministically from `seed`; bad layouts are reseeded. */
export function generateStation(def: StationDef, id: string, size: StationSize, seed: number, defs: Record<string, ModuleDef>): StationResult {
  const f = stationFaction(def, size);
  const fam = (f.hullFamilies as HullFamilyDef[])[0] as HullFamilyDef;
  const role: ShipRoleDef = { id: size, weight: fam.weight, archetypes: [] };
  const failures: string[] = [];
  let last: StationResult | null = null;
  // A layout short of power designates one more reactor room on the next attempt (never reactors in other rooms).
  let extra = 0;
  for (let n = 0; n < GEN_ATTEMPTS; n++) {
    const rng = new Rng(seedOf(seed, n));
    const plan = planStation(rng, def, size, role, defs, extra);
    const fam2 = v2Family(def, size, seed, n);
    if (fam2) {
      const v = v2Attempt(rng, def, id, size, seed, n, plan, fam2, role, defs, failures);
      if (v.result) last = v.result;
      if (v.result && v.result.problems.length === 0) return v.result;
      if (v.power) extra++;
      continue;
    }
    const r = arrangeHull(rng, f, fam, plan, defs, size === 'hub' ? 3 : 4);
    if (typeof r === 'string') { failures.push(`${size}: ${r}`); continue; }
    const g = finishLayout(rng, f, id, seed, role, 'sections', r.plan, r.b, r.profile, r.A, r.profile, defs, n, {
      immobile: true, check: (t, d) => stationProblems(t, d, def.tiers[size].docks),
    });
    g.template.name = `${def.name} ${size === 'station' ? '' : `${size} `}${(seed >>> 0).toString(16).toUpperCase().padStart(4, '0').slice(-4)}`;
    last = { ...g, failures: [...failures], station: infoOf(def, size, g.template, defs) };
    if (g.problems.length === 0) return last;
    if (g.problems.some((p) => p.includes('power'))) extra++;
    failures.push(`${g.topology.split(' ')[0]}: ${g.problems[0]}`);
  }
  if (last) return { ...last, failures };
  throw new Error(`generateStation: no layout for ${id} ${size} seed ${seed}: ${failures.join(', ')}`);
}
