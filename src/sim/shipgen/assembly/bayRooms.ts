import type { ModuleDef } from '../../registry';
import { reactorSpec, unflat, type RoomSpec, type ShipPlan } from '../plan';
import { bayLayout, type Bay } from './bays';
import { cabinsFor } from './cabinBlock';
import type { Frame } from './frame';
import { gunsAndReactors, programPairs, type Pair } from './pairs';
import { fillers, type Layout, type Part, type Piece, type Placed } from './placeLayout';
import { onHall, opensThrough, roomKind } from './roomAccess';
import { fillerSpec, maxArea, type Filler } from './roomSize';
import { DEPT_FILL, deptOf, zonesOf, type Dept, type Need } from './zones';

/**
 * PROTOTYPE (#581): the plan's rooms on the bays (`bayLayout`). A room takes a run of neighbouring bays at one tier on
 * one side: full depth, the front tier on the spine, or the back tier, whose way in is the dock's corridor beside it, the
 * battery's corridor outboard of it, or the room in front. The sides need not mirror: only the cabin block and the
 * machine pair (all the reactors in one room, all the shield generators in the other) stand opposite each other. Rooms
 * only come from the plan; a bay left over goes to the room beside it at its tier while that stays near its size, else
 * to a filler. Most constrained first, a few tries a level, the best layout by size error and fillers.
 */

type Tier = 'full' | 'front' | 'back';
/** Which side: north, south, or both (a mirrored pair). */
type Side = 0 | 1 | 2;
type Specs = [RoomSpec | null, RoomSpec | null];
/** `split`: a host and its annex's front tier's last row, where they moved the wall between them off the bays' line. */
interface Spot { side: Side; i: number; j: number; tier: Tier; area: number; via?: Part['via']; split?: number }
interface Item { specs: Specs; both: boolean; cabins?: boolean }
/** `strip`: a row of that many single cabins along a lane, off the side corridor. */
interface Put { item: Item; specs: Specs; spot: Spot; annex?: Spot; fill?: boolean; strip?: number }

/** The kinds a leftover back tier may be filled with. */
const FILL_KINDS = (['hold', 'workshop', 'lounge', 'gym', 'farm', 'armoury', 'battery', 'shop', 'lab', 'provisions'] as Filler[]).map((k) => roomKind(fillerSpec(k, 20)));

/** A lane hull's outboard bays by the hangar that are flight ops (`zones.ts`). */
const FLIGHT = 2;

/** Floor a room may take past its plan before a leftover bay goes to a filler instead. */
const GROW = 2.5;
/** Floor a room aims for over its plan: room to move and fit out. */
const TARGET = 1.35;
/** A room's size cost: short of the target dear, past it cheap (spare floor is better in a room than in a filler). */
const sizeCost = (r: number): number => (r < TARGET ? 2 * (TARGET - r) : 0.4 * (r - TARGET));

/** All the plan's reactors in one room and all its shield generators in another, a mirrored pair; the rest single. */
function program(plan: ShipPlan, defs: Record<string, ModuleDef>, inBattery: number, hangars = true, blocks = true, mirror = false): Item[] {
  const { gunPairs, cabinPairs } = programPairs(plan, defs);
  const { lone } = gunsAndReactors(plan, defs);
  // (Prototype sizes, here until the plan takes them: a 5x4 brig; the core split into an AI core room and a drone room, 5x4 each.)
  const brig = (r: RoomSpec): RoomSpec => (r.mods.includes('module.stasis_wheel') ? { ...r, w: 5, h: 4 } : r);
  const core = plan.core;
  const cores: RoomSpec[] = !core ? [] : core.mods.includes('module.droneBay')
    ? [{ ...core, mods: core.mods.filter((m) => m !== 'module.droneBay'), w: 5, h: 4 }, { role: 'core', mods: ['module.droneBay'], w: 5, h: 4, ...(core.drones ? { drones: core.drones } : {}) }]
    : [{ ...core, w: 5, h: 4 }];
  if (core?.drones) delete (cores[0] as RoomSpec).drones;
  // (And a mess of 7x5 at least: the crew's commons. Mirrored, on a lane hull's side hulls four rows deep, 9x4.)
  const [mw, mh] = mirror ? [9, 4] : [7, 5];
  const mess = (r: RoomSpec): RoomSpec => (r.mods.includes('module.galley') ? { ...r, w: Math.max(r.w, mw), h: mirror ? mh : Math.max(r.h, mh) } : r);
  // (A lane hull's escape pods: one room of four, two bays long.)
  const pods: RoomSpec[] = hangars ? [] : [{ ...fillerSpec('pods', 64), mods: Array<string>(4).fill('module.pod_bay'), w: 14, h: 4 }];
  // (Mirrored, the point defence is its pair of turrets only: the plan's own room goes.)
  // (Mirrored, on a lane hull's single-tier side hulls: an annex (the pantry) is part of its host; the med bay keeps its
  // trauma room behind it, in stores' forward bays.)
  const own = (r: RoomSpec): RoomSpec => {
    if (!mirror || !r.annex || r.role === 'medbay') return r;
    const { annex, ...host } = r;
    return { ...host, mods: [...r.mods, ...annex.mods], w: r.w + Math.ceil((annex.w * annex.h) / r.h) };
  };
  const singles = [...lone.filter((r) => !(mirror && r.mods.every((m) => m === 'module.pointDefense'))), ...cores, ...plan.quarters.filter((q) => !q.block), ...plan.support.filter((r) => !(mirror && r.role === 'plant')).map(brig).map(mess).map(own), ...plan.cargo.map(brig), ...(hangars ? plan.hangars : pods)];
  const items: Item[] = blocks ? cabinPairs.map((p) => ({ specs: [p[0], p[1]], both: true, cabins: true })) : [];
  const reactor = plan.reactors > 0 ? reactorSpec(plan.reactors, plan.kit) : null;
  const shields: RoomSpec | null = plan.shields.length > 0
    ? unflat({ role: 'shields', mods: plan.shields.flatMap((s) => s.mods), w: plan.shields.reduce((t, s) => t + s.w, 0), h: Math.max(...plan.shields.map((s) => s.h)) }) : null;
  // (A point-defence turret a side, a mirrored pair of 4x4 rooms.)
  const pd: RoomSpec = { role: 'weapons', mods: ['module.pointDefense'], w: 4, h: 4 };
  // (Mirrored, the pair is fixed beside the guns.)
  if (!mirror) items.push({ specs: [pd, { ...pd }], both: true });
  // (Mirrored, life support is a room a side: the plan's units shared out, rounded up to a pair, the fabricator to one.)
  const plants = mirror ? plan.support.filter((r) => r.role === 'plant') : [];
  if (plants.length > 0) {
    const units = Math.ceil(plants.length / 2), fab = plants.some((r) => r.mods.includes('module.fabricator'));
    const side = (f: boolean): RoomSpec => ({ role: 'plant', mods: [...Array<string>(units).fill('module.lifeSupport'), ...(f ? ['module.fabricator'] : [])], w: 3 * units + (fab ? 1 : 0), h: 3 });
    items.push({ specs: [side(fab), side(false)], both: true });
  }
  if (reactor && shields) {
    const w = Math.max(reactor.w, shields.w), h = Math.max(reactor.h, shields.h);
    items.push({ specs: [{ ...reactor, w, h }, { ...shields, w, h }], both: true });
  } else for (const r of [reactor, shields]) if (r) items.push({ specs: [r, null], both: false });
  // (Each side on its own, or mirrored: the same gun opposite.)
  for (const p of gunPairs.slice(inBattery)) items.push(...(mirror ? [{ specs: [p[0], p[1]] as Specs, both: true }] : [{ specs: [p[0], null] as Specs, both: false }, { specs: [p[1], null] as Specs, both: false }]));
  const size = (r: RoomSpec): number => r.w * r.h + (r.annex ? r.annex.w * r.annex.h : 0);
  return [...items, ...singles.sort((a, b) => size(b) - size(a)).map((r): Item => ({ specs: [r, null], both: false }))];
}

export function bayRooms(plan: ShipPlan, fr: Frame, defs: Record<string, ModuleDef>, budget = 3000): Placed & { puts: number; zone: (Dept | undefined)[] } {
  const bays = bayLayout(fr), n = bays.length;
  const { gunPairs } = gunsAndReactors(plan, defs);
  // (A lane hull's hangar is its frame's, at the lane's head.)
  const order = program(plan, defs, fr.maint ? gunPairs.length : 0, !fr.lane, true, !!fr.lane);
  const bay = (k: number): Bay => bays[k] as Bay;
  const rowsAt = (b: Bay, x: number, tier: Tier, split?: number): number => {
    const d = (b.row?.depth ?? fr.depth)(x), [f, k] = b.tiers;
    if (tier === 'full' || !k) return Math.max(0, d);
    const r = split ?? (f as [number, number])[1];
    return tier === 'front' ? Math.min(r, d) : Math.max(0, d - r - 1);
  };
  // (Asked again and again in the search: kept.)
  const areas = new Map<string, number>(), depths = new Map<number, number>();
  const area = (i: number, j: number, tier: Tier, split?: number): number => {
    const key = `${i},${j},${tier},${split ?? ''}`, got = areas.get(key);
    if (got !== undefined) return got;
    let a = 0;
    for (let k = i; k < j; k++) { const b = bay(k); for (let x = b.x0; x < b.x1; x++) a += rowsAt(b, x, tier, split); }
    areas.set(key, a);
    return a;
  };
  const minDepth = (i: number, j: number): number => {
    const got = depths.get(i * 1024 + j);
    if (got !== undefined) return got;
    let d = Infinity;
    for (let k = i; k < j; k++) for (let x = bay(k).x0; x < bay(k).x1; x++) d = Math.min(d, (bay(k).row?.depth ?? fr.depth)(x));
    depths.set(i * 1024 + j, d);
    return d;
  };
  // Neighbouring bays: no corridor between (the dock's, or a doubled gun's column), on the same rows.
  const joined = (k: number): boolean => bay(k + 1).x0 === bay(k).x1 + 1 && bay(k + 1).row === bay(k).row;
  const twoTier = (k: number): boolean => bay(k).tiers.length > 1;
  const sameSplit = (i: number, j: number): boolean => { for (let k = i + 1; k < j; k++) if (bay(k).tiers[0]?.[1] !== bay(i).tiers[0]?.[1]) return false; return true; };
  const byDock = (i: number, j: number): boolean => bay(j - 1).x1 === fr.dockAt - 1 || bay(i).x0 === fr.dockAt + fr.CW + 1;
  const gunCol = (x: number): boolean => !!fr.maint?.guns.some(([s0, s1]) => x >= s0 && x < s1);
  const byMaint = (i: number, j: number): boolean => {
    const m = fr.maint;
    if (!m) return false;
    for (let k = i; k < j; k++) for (let x = bay(k).x0; x < bay(k).x1; x++) if (x >= m.a && x < m.b && !gunCol(x)) return true;
    return false;
  };
  const fits = (r: RoomSpec, ln: number, rw: number): boolean => (ln >= r.w && rw >= r.h) || (ln >= r.h && rw >= r.w);
  const len = (i: number, j: number): number => bay(j - 1).x1 - bay(i).x0;
  const rows = (i: number, j: number, tier: Tier): number => Math.round(area(i, j, tier) / Math.max(1, len(i, j)));
  const sidesOf = (s: Side): (0 | 1)[] => (s === 2 ? [0, 1] : [s]);
  const real = (sp: Specs): RoomSpec[] => sp.filter((r): r is RoomSpec => !!r);
  const planOf = (sp: Specs): number => Math.max(...real(sp).map((r) => r.w * r.h));
  /** A single room's specs on side `s`. */
  const on = (r: RoomSpec, s: 0 | 1): Specs => (s === 0 ? [r, null] : [null, r]);

  // Slots taken: per side, per bay, its front and back tiers (full depth takes both).
  type Slot = { front: Put | null; back: Put | null };
  type Occ = [Slot[], Slot[]];
  const taken = (t: Slot, tier: Tier): boolean => !!(tier === 'full' ? t.front || t.back : tier === 'front' ? t.front : t.back);
  const freeOn = (o: Occ, s: 0 | 1, i: number, j: number, tier: Tier): boolean => {
    for (let k = i; k < j; k++) if (taken(o[s][k] as Slot, tier) || (tier !== 'full' && !twoTier(k))) return false;
    for (let k = i; k + 1 < j; k++) if (!joined(k)) return false;
    return tier === 'full' || sameSplit(i, j);
  };
  const free = (o: Occ, side: Side, i: number, j: number, tier: Tier): boolean => sidesOf(side).every((s) => freeOn(o, s, i, j, tier));
  const take = (o: Occ, sp: Spot, p: Put): Occ => {
    const put = (t: Slot): Slot => (sp.tier === 'full' ? { front: p, back: p } : sp.tier === 'front' ? { ...t, front: p } : { ...t, back: p });
    return [0, 1].map((s) => (sidesOf(sp.side).includes(s as 0 | 1) ? o[s as 0 | 1].map((t, k) => (k < sp.i || k >= sp.j ? t : put(t))) : o[s as 0 | 1])) as Occ;
  };

  /** A way in for back-tier rooms over bays [i, j): their own corridor, else through the room in front (once placed). */
  const backVia = (o: Occ, side: Side, i: number, j: number, specs: Specs): Part['via'] | null => {
    const hall = real(specs).every((h) => onHall(roomKind(h)));
    if (hall && byDock(i, j)) return 'dock';
    if (hall && byMaint(i, j)) return 'maint';
    for (const s of sidesOf(side)) {
      const f = o[s][i]?.front, me = specs[s], fs = f?.specs[s];
      if (!f || !me || !fs || f.spot.tier !== 'front') return null;
      for (let k = i; k < j; k++) if (o[s][k]?.front !== f) return null;
      if (!opensThrough(roomKind(me), roomKind(fs))) return null;
    }
    return 'front';
  };

  type Cand = { spot: Spot; specs: Specs; annex?: Spot; cost: number };
  /** A lane hull's bays' departments (`zones.ts`), set before the search; a room only in its own. */
  let zone: (Dept | undefined)[] = [];
  let alone = new Set<Dept>();
  const inZone = (i: number, j: number, rs: RoomSpec[]): boolean => {
    if (zone.length === 0) return true;
    for (let k = i; k < j; k++) if (!rs.every((h) => deptOf(h) === zone[k])) return false;
    return true;
  };
  /** Every column of the bays at that tier the same depth: a rectangle. */
  const square = (sp: Spot): boolean => {
    let lo = Infinity, hi = -Infinity;
    for (let k = sp.i; k < sp.j; k++) { const b = bay(k); for (let x = b.x0; x < b.x1; x++) { const r = rowsAt(b, x, sp.tier, sp.split); lo = Math.min(lo, r); hi = Math.max(hi, r); } }
    return hi - lo <= 0;
  };
  /** A hangar takes a rectangle of bays; where one holds it, a second shuttle bay beside the first (an option, a little preferred). */
  function spots(o: Occ, it: Item): Cand[] {
    const h = it.specs[0];
    if (!h?.mods.includes('module.vehicle_bay')) return spotsOf(o, it);
    const two: RoomSpec = { ...h, mods: [...h.mods, 'module.vehicle_bay'], w: 10, h: 7 };
    return [...spotsOf(o, it), ...spotsOf(o, { ...it, specs: [two, null] }).map((c) => ({ ...c, cost: c.cost - 0.5 }))]
      .filter((c) => square(c.spot)).sort((u, v) => u.cost - v.cost);
  }
  function spotsOf(o: Occ, it: Item): Cand[] {
    const out: Cand[] = [];
    const rs = real(it.specs), want = Math.max(...rs.map((r) => r.w * r.h + (r.annex ? r.annex.w * r.annex.h : 0)));
    const cap = Math.max(want * 1.25, Math.min(...rs.map(maxArea)));
    const hallOk = rs.every((h) => onHall(roomKind(h))), host = rs[0] as RoomSpec, annex = host.annex;
    for (const side of (it.both ? [2] : [0, 1]) as Side[]) {
      const specs: Specs = it.both ? it.specs : on(host, side as 0 | 1);
      for (let i = 0; i < n; i++) for (let j = i + 1; j <= n && j - i <= 4; j++) for (const tier of ['full', 'front', 'back'] as Tier[]) {
        if (!free(o, side, i, j, tier) || !inZone(i, j, rs)) continue;
        if (it.cabins) {
          // (Never under the battery: its corridor runs out to the hull and would meet the battery's.)
          const m = fr.maint, under = !!m && bay(i).x0 < m.b && bay(j - 1).x1 > m.a;
          if (tier !== 'full' || under || !rs.every((h) => cabinsFor(h, len(i, j), minDepth(i, j))?.stubs.length === 1)) continue;
          out.push({ spot: { side, i, j, tier, area: area(i, j, tier) }, specs, cost: Math.abs(len(i, j) - 11) / 4 });
          continue;
        }
        const a = area(i, j, tier), rw = rows(i, j, tier), ln = len(i, j);
        if (annex) {
          // The host in front, its annex behind it over the same bays (through the host), the wall between them moved
          // up to two rows off the bays' line: the annex as small as it may be (never past three quarters of the host), the host taking the rest.
          if (tier !== 'front' || !free(o, side, i, j, 'back')) continue;
          const line = (bay(i).tiers[0] as [number, number])[1], hostWant = host.w * host.h, annexWant = annex.w * annex.h, deep = minDepth(i, j);
          let best: { split: number; a: number; b: number; cost: number } | null = null;
          for (let split = line - 2; split <= line + 2; split++) {
            const a2 = area(i, j, 'front', split), b2 = area(i, j, 'back', split);
            if (split < 3 || deep - split - 1 < 3 || a2 < hostWant || b2 < 0.85 * annexWant || b2 > 0.75 * a2 || !fits(host, ln, split)) continue;
            const cost = Math.abs(a2 / hostWant - TARGET) + 0.5 * Math.abs(b2 / annexWant - 1);
            if (!best || cost < best.cost) best = { split, a: a2, b: b2, cost };
          }
          if (!best) continue;
          out.push({ spot: { side, i, j, tier, area: best.a, split: best.split }, specs, annex: { side, i, j, tier: 'back', area: best.b, via: 'front', split: best.split }, cost: best.cost });
          continue;
        }
        // (A bay tier is coarse: a small room may take up to about two and a half times its plan, at a cost.)
        // (A lane hull's bays run bigger: a small room there may take up to four times its plan.)
        // (A department's one room a side may take all its bays; on a lane hull, so may a hold: spare floor is storage.)
        const sole = rs.every((h) => alone.has(deptOf(h)) || (fr.lane && roomKind(h) === 'cargo'));
        if (a < want || (a > Math.max(cap * 1.3, want * (fr.lane ? 4 : 2.5)) && !sole) || !rs.every((h) => fits(h, ln, rw))) continue;
        let via: Part['via'] | undefined;
        if (tier === 'back') { const v = backVia(o, side, i, j, specs); if (!v) continue; via = v; } else if (!hallOk) continue;
        // A front room nothing may open through, over back tiers still free with no corridor beside them, leaves a
        // pocket behind it no room can reach.
        if (tier === 'front' && !byDock(i, j) && !byMaint(i, j) && !rs.every((h) => FILL_KINDS.some((f) => opensThrough(f, roomKind(h))))) {
          let open = false;
          for (let k = i; k < j; k++) for (const s0 of sidesOf(side)) if (!(o[s0][k] as Slot).back) open = true;
          if (open) continue;
        }
        out.push({ spot: { side, i, j, tier, area: a, ...(via ? { via } : {}) }, specs, cost: sizeCost(a / want) + (a > cap * 1.3 ? 1 : 0) + (tier === 'full' && want < 30 ? 0.3 : 0) });
      }
    }
    return out.sort((u, v) => u.cost - v.cost);
  }

  let best: { puts: Put[]; score: number } | null = null, nodes = 0, viable = 0;
  const why = new Map<string, number>();
  const note = (k: string): void => { why.set(k, (why.get(k) ?? 0) + 1); };
  const emptySide = (): Slot[] => bays.map(() => ({ front: null, back: null }));
  function dfs(o: Occ, puts: Put[], left: Item[], cost: number): void {
    if (++nodes > budget) return;
    if (left.length === 0) {
      const done = finish(o, puts);
      if (!done) return;
      viable++;
      if (!best || done.score + cost < best.score) best = { puts: done.puts, score: done.score + cost };
      return;
    }
    // Most constrained first. (A room with no spot yet may get one behind a room still to come: it waits, unless
    // nothing else has one.)
    let pi = -1, cs: Cand[] = [];
    for (const [k, it] of left.entries()) { const c = spots(o, it); if (c.length > 0 && (pi < 0 || c.length < cs.length)) { pi = k; cs = c; } }
    if (pi < 0) { note(`no spot ${left.map((it) => real(it.specs)[0]?.role).join(',')}`); return; }
    const it = left[pi] as Item;
    for (const c of cs.slice(0, 3)) {
      const put: Put = { item: it, specs: c.specs, spot: c.spot, ...(c.annex ? { annex: c.annex } : {}) };
      let o2 = take(o, c.spot, put);
      if (c.annex) o2 = take(o2, c.annex, put);
      dfs(o2, [...puts, put], left.filter((_, k) => k !== pi), cost + c.cost);
    }
  }

  /** Bays left over: the room beside at that tier grows over them while near its size, else a filler. */
  function finish(o0: Occ, puts0: Put[]): { puts: Put[]; score: number } | null {
    let o: Occ = [o0[0].map((t) => ({ ...t })), o0[1].map((t) => ({ ...t }))];
    const puts = [...puts0];
    const replace = (old: Put, nw: Put, grown: Spot): void => {
      puts[puts.indexOf(old)] = nw;
      o = o.map((sd) => sd.map((t) => ({ front: t.front === old ? nw : t.front, back: t.back === old ? nw : t.back }))) as Occ;
      o = take(o, grown, nw);
    };
    let score = 0, nFill = 0;
    // (Prototype: a big ship's spare-floor rooms first, then the fillers.)
    const left: Filler[] = ['armoury', 'battery', 'shop', 'lab', 'provisions', 'workshop', 'lounge', 'gym', 'farm'];
    // (By department: its own kinds in turn, the same turn on both sides.)
    const turn = new Map<string, number>();
    for (const s of [0, 1] as const) for (let k = 0; k < n; k++) for (const tier of (twoTier(k) ? ['front', 'back'] : ['full']) as Tier[]) {
      if (taken(o[s][k] as Slot, tier)) continue;
      const a = area(k, k + 1, tier), here: Spot = { side: s, i: k, j: k + 1, tier, area: a };
      // A single room beside it on this side at this tier grows over it, not past its size.
      const near = [k - 1, k + 1].filter((m) => m >= 0 && m < n && joined(Math.min(m, k))).map((m) => (tier === 'back' ? o[s][m]?.back : o[s][m]?.front))
        .filter((p): p is Put => !!p && !p.fill && !p.item.cabins && !p.annex && !p.item.both && p.spot.tier === tier && !real(p.specs).some((h) => h.mods.includes('module.vehicle_bay')) && zone[p.spot.i] === zone[k]);
      // (A back room grows only where it still has a way in over the wider span: one room in front it opens through, or its corridor.)
      const wayIn = (p: Put): Part['via'] | null => backVia(o, s, Math.min(p.spot.i, k), Math.max(p.spot.j, k + 1), p.specs);
      const grow = near.find((p) => p.spot.area + a <= GROW * planOf(p.specs) && (tier === 'full' || sameSplit(Math.min(p.spot.i, k), Math.max(p.spot.j, k + 1))) && (tier !== 'back' || !!wayIn(p)));
      if (grow) {
        const via = tier === 'back' ? wayIn(grow) : undefined;
        const nw: Put = { ...grow, spot: { ...grow.spot, i: Math.min(grow.spot.i, k), j: Math.max(grow.spot.j, k + 1), area: grow.spot.area + a, ...(via ? { via } : {}) } };
        replace(grow, nw, here);
        score += 2 * Math.max(0, nw.spot.area / planOf(nw.specs) - 1);
        continue;
      }
      if (a < 9) { score += 5; continue; }
      // The next filler kind left; behind a room, the first kind that may open through it.
      let f: RoomSpec | null = null, via: Part['via'] | undefined;
      const z = zone[k], own = z ? DEPT_FILL[z] : [], t = turn.get(`${z}${s}`) ?? 0;
      if (z) turn.set(`${z}${s}`, t + 1);
      const kinds: Filler[] = z ? [...own.slice(t % own.length), ...own.slice(0, t % own.length)] : a >= 12 ? left : [];
      for (const kd of [...kinds, 'hold'] as Filler[]) {
        const c = fillerSpec(kd, a), v = tier === 'back' ? backVia(o, s, k, k + 1, on(c, s)) : undefined;
        if (tier === 'back' && !v) continue;
        f = c; via = v ?? undefined;
        if (left.includes(kd)) left.splice(left.indexOf(kd), 1);
        break;
      }
      if (!f) {
        // No filler may open through the room in front: that room takes the bay's full depth, if it is that bay's alone.
        const f0 = o[s][k]?.front;
        if (!f0 || f0.fill || f0.item.cabins || f0.annex || f0.item.both || f0.spot.i !== k || f0.spot.j !== k + 1 || f0.spot.tier !== 'front') { note(`back pocket x${bay(k).x0}`); return null; }
        const full: Spot = { side: s, i: k, j: k + 1, tier: 'full', area: area(k, k + 1, 'full') };
        if (full.area > 2.5 * planOf(f0.specs)) { note(`back pocket x${bay(k).x0} (front too small to take it)`); return null; }
        replace(f0, { ...f0, spot: full }, full);
        continue;
      }
      fillers.add(f);
      const put: Put = { item: { specs: on(f, s), both: false }, specs: on(f, s), spot: { ...here, ...(via ? { via } : {}) }, fill: true };
      puts.push(put); o = take(o, put.spot, put);
      nFill++; score += 3 + (nFill > 4 ? 4 : 0);
    }
    return { puts, score };
  }

  // A lane hull's cabins: single cabins along the lane, inboard of the side corridors from the hangar aft, the beds
  // shared between the sides; where the strip is too short for them even two to a cabin, cabin blocks as anywhere.
  const strip: Put[] = [];
  if (fr.lane) {
    const beds = plan.quarters.filter((q) => q.block).reduce((t, q) => t + q.mods.length, 0);
    // (Inboard only: where it holds too few cabins, two beds to a cabin.)
    const ks = bays.flatMap((b, k) => (b.row && b.row.dir < 0 ? [k] : []));
    const room = ks.reduce((t, k) => t + Math.max(1, Math.floor((bay(k).x1 - bay(k).x0 + 1) / 4)), 0);
    for (const s of [0, 1] as const) {
      let need = s === 0 ? Math.ceil(beds / 2) : Math.floor(beds / 2);
      const per = need > room ? 2 : 1;
      for (const k of ks) {
        if (need <= 0) break;
        const c = Math.min(Math.ceil(need / per), Math.max(1, Math.floor((bay(k).x1 - bay(k).x0 + 1) / 4))), b = Math.min(need, c * per);
        const cab: RoomSpec = { role: 'quarters', mods: Array<string>(b).fill('module.bed'), w: 3 * c, h: 3 };
        strip.push({ item: { specs: on(cab, s), both: false, cabins: true }, specs: on(cab, s), spot: { side: s, i: k, j: k + 1, tier: 'full', area: area(k, k + 1, 'full') }, strip: c });
        need -= b;
      }
      if (need > 0) strip.length = 0;
      if (need > 0) break;
    }
  }
  // A lane hull's guns, fixed before the rest: a mirrored pair a bay, the bays evenly spaced down the side hulls outboard
  // (out to the hull, on the side corridor).
  // (And the point-defence pair after them, its own bay.)
  const pdSpec: RoomSpec = { role: 'weapons', mods: ['module.pointDefense'], w: 4, h: 4 }, mounts: Pair[] = [...gunPairs, [pdSpec, { ...pdSpec }]];
  // (Aft of flight ops' two bays by the hangar.)
  const ob = fr.lane ? bays.map((b, k) => ((b.row?.dir ?? 1) > 0 && b.row ? k : -1)).filter((k) => k >= 0).slice(FLIGHT) : [];
  // (The outboard bays by the engines.)
  const at = new Set(ob.slice(-mounts.length));
  const guns0: Put[] = fr.lane && ob.length >= mounts.length && at.size === mounts.length ? mounts.map((p, i) => {
    const k = [...at][i] as number, specs: Specs = [p[0], p[1]];
    return { item: { specs, both: true }, specs, spot: { side: 2, i: k, j: k + 1, tier: 'full', area: area(k, k + 1, 'full') } };
  }) : [];
  const pre = [...strip, ...guns0], occ0 = pre.reduce<Occ>((o, p) => take(o, p.spot, p), [emptySide(), emptySide()]);
  const inBattery = fr.maint || guns0.length > 0 ? gunPairs.length : 0;
  const rest = pre.length > 0 ? program(plan, defs, inBattery, !fr.lane, strip.length === 0, !!fr.lane) : order;
  // (Each department's rooms' floor and slots a side: half each room's, a mirrored pair's both; an annex its own slot.)
  const need: Partial<Record<Dept, Need>> = {};
  for (const r of rest.flatMap((it) => real(it.specs))) {
    const n = need[deptOf(r)] ?? { area: 0, rooms: 0 };
    need[deptOf(r)] = { area: n.area + 0.5 * (r.w * r.h + (r.annex ? r.annex.w * r.annex.h : 0)), rooms: n.rooms + (r.annex ? 1 : 0.5), ...(n.deep || r.annex ? { deep: true } : {}) };
  }
  alone = new Set((Object.keys(need) as Dept[]).filter((d) => (need[d]?.rooms ?? 0) <= 1));
  zone = zonesOf(fr, bays, new Set(guns0.map((p) => p.spot.i)), FLIGHT, need, (k) => area(k, k + 1, 'full'));
  dfs(occ0, pre, rest, 0);
  const got = best as { puts: Put[]; score: number } | null;
  const lay: Layout = { blocks: [{ a: fr.xBand, b: fr.xS, crossL: false, crossR: false, free: [], pieces: toPieces(got?.puts ?? []) }], stern: null, stubs: [], done: [] };
  const battery = fr.maint ? gunPairs.slice(0, fr.maint.guns.length + fr.maint.inner.length) : [];
  // A doubled column's inner room (the bigger: the column's depth under the blister) takes the pair with more guns.
  const guns = (p: Pair | undefined): number => p?.[0].mods.filter((m) => defs[m]?.weapon).length ?? 0;
  for (const [j, site] of (fr.maint?.inner ?? []).entries()) {
    const k = (fr.maint?.guns.length ?? 0) + j, out = battery[site], inn = battery[k];
    if (out && inn && guns(out) > guns(inn)) { battery[site] = inn; battery[k] = out; }
  }
  return { fr, lay, zone, score: got?.score ?? Infinity, viable, nodes, why, pins: battery.length, sites: fr.maint?.guns.length ?? 0, battery, puts: got?.puts.length ?? 0 };

  function toPieces(puts: Put[]): Piece[] {
    const part = (sp: Spot, spec: Specs, fill?: boolean): Part => {
      const [f, k] = bay(sp.i).tiers, line = sp.split ?? (f as [number, number])[1];
      const [r0, r1] = sp.tier === 'full' || !k ? [1, Infinity] : sp.tier === 'front' ? [1, line] : [line + 2, Infinity];
      const row = bay(sp.i).row;
      return { x0: bay(sp.i).x0, x1: bay(sp.j - 1).x1, r0, r1, spec, ...(fill ? { fill } : {}), ...(sp.via ? { via: sp.via } : {}), ...(row ? { row } : {}) };
    };
    // Front and full-depth rooms first: a back room's way in may be the room in front.
    const sorted = [...puts].sort((u, v) => Number(u.spot.tier === 'back') - Number(v.spot.tier === 'back'));
    return sorted.map((p) => {
      const parts = [part(p.spot, p.specs, p.fill)];
      if (p.annex) parts.push(part(p.annex, [p.specs[0]?.annex ?? null, p.specs[1]?.annex ?? null]));
      return { x0: parts[0]?.x0 ?? 0, x1: parts[0]?.x1 ?? 0, parts, ...(p.item.cabins ? { cabins: true } : {}), ...(p.strip ? { strip: p.strip } : {}) };
    });
  }
}
