import type { Rng } from '../../rng';
import type { Builder } from '../builder';
import type { ShipPlan } from '../plan';
import { assign, type Assignment } from './assign';
import { K } from './grid';
import { harbourStrategy } from './harbour';
import { PREC, addRoom, type Ctx2 } from './kit';
import { bayStrategy, machineStrategy, warehouseStrategy } from './machine';
import { program, type Dept, type DeptId } from './program';
import { cabinsStrategy, storefrontStrategy } from './rows';
import { rasterise, type Structure } from './structure';
import { sampleTemplate, templateSig, type Family } from './template';
import { build, emit } from './walls';

/**
 * Station v2 (docs/STATIONGEN2.md): department-driven ring stations. Per draw: a structure template, the departments
 * (functional plan), the hull radius solved from their floor, a small search assigning departments to regions, then
 * the strategies lay every parcel out and the walls and doors are drawn. A draw that cannot give a good station is
 * rejected and redrawn (never forced for variety); the feasible candidates are ranked, and the caller fits out the
 * best, falling back to the next when fit-out fails.
 */

export interface Candidate {
  b: Builder;
  score: number;
  profile: string;
  /** Tiles left open on purpose (canvas coordinates). */
  open: Set<string>;
}

export interface V2Result { candidates: Candidate[]; draws: number; rejected: number; why: string[] }

/** Draws tried per station, feasible candidates wanted, assignments searched per draw. */
const DRAWS = 12, WANT = 3, SEARCH = 24;
/** A draw whose best assignment scores below this is rejected. */
const FLOOR = -6;

/** Lay out every parcel of an assignment on a fresh raster; the context, or why it failed. */
export function layOut(rng: Rng, a: Assignment, depts: readonly Dept[]): Ctx2 | string {
  const s = rasterise(a.s.t, a.s.R) as Structure;
  const g = s.g;
  const c: Ctx2 = { rng, s, g, rooms: [], publics: [], halls: new Map(), owner: new Map() };
  for (const ts of a.courts) for (const i of ts) g.pub[i] = 2;
  addRoom(c, { tiles: g.tiles((k) => k === K.Hall), spec: { role: 'hall', mods: [], w: 1, h: 1 }, dept: 'public', prec: PREC.hall, doors: [] });
  c.publics.push(0);
  const courts = [...g.components(g.tiles((k) => k === K.Court)), ...a.courts];
  for (const ts of courts) {
    const id = addRoom(c, { tiles: ts, spec: { role: 'plaza', mods: [], w: 1, h: 1 }, dept: 'public', prec: PREC.court + c.rooms.length, doors: [0, 0] });
    c.publics.push(id);
  }
  for (const p of a.parcels) for (const i of p.tiles) c.owner.set(i, p.dept);
  const dept = (id: DeptId): Dept | undefined => depts.find((d) => d.id === id);
  const parts = (id: DeptId): number[][] => a.parcels.filter((p) => p.dept === id).sort((x, y) => x.part - y.part).map((p) => p.tiles);
  for (const [k, id] of (['harbour', 'harbour2'] as const).entries()) {
    const d = dept(id), ts = parts(id)[0], f = s.faces[k];
    if (d && ts && f && !harbourStrategy(c, id, ts, f, d.facilities)) return `${id} strategy`;
  }
  const fr = dept('freight'), frT = parts('freight')[0];
  if (fr && frT && !warehouseStrategy(c, frT, fr.facilities)) return 'freight strategy';
  const en = dept('engineering'), enT = parts('engineering')[0];
  if (en && enT && !machineStrategy(c, enT, en.facilities)) return 'engineering strategy';
  const df = dept('defence'), dfT = parts('defence')[0];
  if (df && dfT && !bayStrategy(c, dfT, df.facilities)) return 'defence strategy';
  const hab = dept('habitation');
  if (hab) {
    const ps = parts('habitation');
    const beds = hab.facilities.filter((f) => f.spec.role === 'quarters').length;
    const extras = hab.facilities.filter((f) => f.spec.role !== 'quarters');
    const total = ps.reduce((t, p) => t + p.length, 0);
    let left = beds;
    for (const [k, ts] of ps.entries()) {
      const n = k === ps.length - 1 ? left : Math.round((beds * ts.length) / total);
      left -= n;
      if (!cabinsStrategy(c, ts, n, k === 0 ? extras : [])) return 'habitation strategy';
    }
  }
  const mk = dept('market');
  if (mk) {
    const ps = parts('market');
    const shops = mk.facilities.filter((f) => f.spec.role === 'shop');
    const others = mk.facilities.filter((f) => f.spec.role !== 'shop');
    for (const [k, ts] of ps.entries()) {
      const mine = [...(k === 0 ? others : []), ...shops.filter((_, j) => j % ps.length === k)];
      if (!storefrontStrategy(c, ts, mine)) return 'market strategy';
    }
  }
  return c;
}

export function stationV2(rng: Rng, family: Family, plan: ShipPlan, docks: number): V2Result {
  const out: V2Result = { candidates: [], draws: 0, rejected: 0, why: [] };
  for (let n = 0; n < DRAWS && out.candidates.length < WANT; n++) {
    out.draws++;
    const t = sampleTemplate(rng, family, docks);
    const depts = program(rng, plan, t.harbours.map((h) => h.docks));
    const ok: Assignment[] = [];
    let why = '';
    for (let k = 0; k < SEARCH; k++) {
      const a = assign(rng, t, depts);
      if (typeof a === 'string') why ||= a; else ok.push(a);
    }
    ok.sort((a, b) => b.score - a.score);
    if (ok.length === 0 || (ok[0] as Assignment).score < FLOOR) {
      out.rejected++;
      out.why.push(ok.length === 0 ? why || 'infeasible' : `low score ${(ok[0] as Assignment).score.toFixed(1)}`);
      continue;
    }
    let made = false;
    for (const a of ok.slice(0, 4)) {
      const c = layOut(rng, a, depts);
      if (typeof c === 'string') { out.why.push(c); continue; }
      const d = build(c);
      if (typeof d === 'string') { out.why.push(d); continue; }
      const s = a.s;
      const open = new Set(s.open.map((i) => `${s.g.x(i)},${s.g.y(i)}`));
      out.candidates.push({ b: emit(c, d, rng), score: a.score, profile: `${templateSig(s.t)} R${s.R}`, open });
      made = true;
      break;
    }
    if (!made) out.rejected++;
  }
  out.candidates.sort((a, b) => b.score - a.score);
  return out;
}
