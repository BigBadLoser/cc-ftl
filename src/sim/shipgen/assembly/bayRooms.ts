import type { ModuleDef } from '../../registry';
import { reactorSpec, type RoomSpec, type ShipPlan } from '../plan';
import { bayLayout, type Bay } from './bays';
import { cabinsFor } from './cabinBlock';
import type { Frame } from './frame';
import { gunsAndReactors, programPairs } from './pairs';
import { fillers, type Layout, type Part, type Piece, type Placed } from './placeLayout';
import { onHall, opensThrough, roomKind } from './roomAccess';
import { fillerSpec, maxArea, type Filler } from './roomSize';

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
interface Put { item: Item; specs: Specs; spot: Spot; annex?: Spot; fill?: boolean }

/** Floor a room may take past its plan before a leftover bay goes to a filler instead. */
const GROW = 2.5;
/** Floor a room aims for over its plan: room to move and fit out. */
const TARGET = 1.35;
/** A room's size cost: short of the target dear, past it cheap (spare floor is better in a room than in a filler). */
const sizeCost = (r: number): number => (r < TARGET ? 2 * (TARGET - r) : 0.4 * (r - TARGET));

/** All the plan's reactors in one room and all its shield generators in another, a mirrored pair; the rest single. */
function program(plan: ShipPlan, defs: Record<string, ModuleDef>, inBattery: number): Item[] {
  const { gunPairs, cabinPairs } = programPairs(plan, defs);
  const { lone } = gunsAndReactors(plan, defs);
  // (Prototype sizes, here until the plan takes them: a 5x4 brig; the core split into an AI core room and a drone room, 5x4 each.)
  const brig = (r: RoomSpec): RoomSpec => (r.mods.includes('module.stasis_wheel') ? { ...r, w: 5, h: 4 } : r);
  const core = plan.core;
  const cores: RoomSpec[] = !core ? [] : core.mods.includes('module.droneBay')
    ? [{ ...core, mods: core.mods.filter((m) => m !== 'module.droneBay'), w: 5, h: 4 }, { role: 'core', mods: ['module.droneBay'], w: 5, h: 4, ...(core.drones ? { drones: core.drones } : {}) }]
    : [{ ...core, w: 5, h: 4 }];
  if (core?.drones) delete (cores[0] as RoomSpec).drones;
  // (And a mess of 7x5 at least: the crew's commons.)
  const mess = (r: RoomSpec): RoomSpec => (r.mods.includes('module.galley') ? { ...r, w: Math.max(r.w, 7), h: Math.max(r.h, 5) } : r);
  const singles = [...lone, ...cores, ...plan.quarters.filter((q) => !q.block), ...plan.support.map(brig).map(mess), ...plan.cargo.map(brig), ...plan.hangars];
  const items: Item[] = cabinPairs.map((p) => ({ specs: [p[0], p[1]], both: true, cabins: true }));
  const reactor = plan.reactors > 0 ? reactorSpec(plan.reactors, plan.kit) : null;
  const shields: RoomSpec | null = plan.shields.length > 0
    ? { role: 'shields', mods: plan.shields.flatMap((s) => s.mods), w: plan.shields.reduce((t, s) => t + s.w, 0), h: Math.max(...plan.shields.map((s) => s.h)) } : null;
  if (reactor && shields) {
    const w = Math.max(reactor.w, shields.w), h = Math.max(reactor.h, shields.h);
    items.push({ specs: [{ ...reactor, w, h }, { ...shields, w, h }], both: true });
  } else for (const r of [reactor, shields]) if (r) items.push({ specs: [r, null], both: false });
  for (const p of gunPairs.slice(inBattery)) items.push({ specs: [p[0], null], both: false }, { specs: [p[1], null], both: false });
  const size = (r: RoomSpec): number => r.w * r.h + (r.annex ? r.annex.w * r.annex.h : 0);
  return [...items, ...singles.sort((a, b) => size(b) - size(a)).map((r): Item => ({ specs: [r, null], both: false }))];
}

export function bayRooms(plan: ShipPlan, fr: Frame, defs: Record<string, ModuleDef>, budget = 3000): Placed & { puts: number } {
  const bays = bayLayout(fr), n = bays.length;
  const { gunPairs } = gunsAndReactors(plan, defs);
  const order = program(plan, defs, fr.maint ? gunPairs.length : 0);
  const bay = (k: number): Bay => bays[k] as Bay;
  const rowsAt = (b: Bay, x: number, tier: Tier, split?: number): number => {
    const d = fr.depth(x), [f, k] = b.tiers;
    if (tier === 'full' || !k) return Math.max(0, d);
    const r = split ?? (f as [number, number])[1];
    return tier === 'front' ? Math.min(r, d) : Math.max(0, d - r - 1);
  };
  const area = (i: number, j: number, tier: Tier, split?: number): number => {
    let a = 0;
    for (let k = i; k < j; k++) { const b = bay(k); for (let x = b.x0; x < b.x1; x++) a += rowsAt(b, x, tier, split); }
    return a;
  };
  const minDepth = (i: number, j: number): number => { let d = Infinity; for (let k = i; k < j; k++) for (let x = bay(k).x0; x < bay(k).x1; x++) d = Math.min(d, fr.depth(x)); return d; };
  // Neighbouring bays: no corridor between (the dock's, or a doubled gun's column).
  const joined = (k: number): boolean => bay(k + 1).x0 === bay(k).x1 + 1;
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
  function spots(o: Occ, it: Item): Cand[] {
    const out: Cand[] = [];
    const rs = real(it.specs), want = Math.max(...rs.map((r) => r.w * r.h + (r.annex ? r.annex.w * r.annex.h : 0)));
    const cap = Math.max(want * 1.25, Math.min(...rs.map(maxArea)));
    const hallOk = rs.every((h) => onHall(roomKind(h))), host = rs[0] as RoomSpec, annex = host.annex;
    for (const side of (it.both ? [2] : [0, 1]) as Side[]) {
      const specs: Specs = it.both ? it.specs : on(host, side as 0 | 1);
      for (let i = 0; i < n; i++) for (let j = i + 1; j <= n && j - i <= 4; j++) for (const tier of ['full', 'front', 'back'] as Tier[]) {
        if (!free(o, side, i, j, tier)) continue;
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
        if (a < want || a > Math.max(cap * 1.3, want * 2.5) || !rs.every((h) => fits(h, ln, rw))) continue;
        let via: Part['via'] | undefined;
        if (tier === 'back') { const v = backVia(o, side, i, j, specs); if (!v) continue; via = v; } else if (!hallOk) continue;
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
    const left: Filler[] = ['workshop', 'lounge', 'gym', 'farm'];
    for (const s of [0, 1] as const) for (let k = 0; k < n; k++) for (const tier of (twoTier(k) ? ['front', 'back'] : ['full']) as Tier[]) {
      if (taken(o[s][k] as Slot, tier)) continue;
      const a = area(k, k + 1, tier), here: Spot = { side: s, i: k, j: k + 1, tier, area: a };
      // A single room beside it on this side at this tier grows over it, not past its size.
      const near = [k - 1, k + 1].filter((m) => m >= 0 && m < n && joined(Math.min(m, k))).map((m) => (tier === 'back' ? o[s][m]?.back : o[s][m]?.front))
        .filter((p): p is Put => !!p && !p.fill && !p.item.cabins && !p.annex && !p.item.both && p.spot.tier === tier);
      const grow = near.find((p) => p.spot.area + a <= GROW * planOf(p.specs) && (tier === 'full' || sameSplit(Math.min(p.spot.i, k), Math.max(p.spot.j, k + 1))));
      if (grow) {
        const nw: Put = { ...grow, spot: { ...grow.spot, i: Math.min(grow.spot.i, k), j: Math.max(grow.spot.j, k + 1), area: grow.spot.area + a } };
        replace(grow, nw, here);
        score += 2 * Math.max(0, nw.spot.area / planOf(nw.specs) - 1);
        continue;
      }
      if (a < 9) { score += 5; continue; }
      // The next filler kind left; behind a room, the first kind that may open through it.
      let f: RoomSpec | null = null, via: Part['via'] | undefined;
      for (const kd of [...(a >= 12 ? left : []), 'hold'] as Filler[]) {
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

  dfs([emptySide(), emptySide()], [], order, 0);
  const got = best as { puts: Put[]; score: number } | null;
  const lay: Layout = { blocks: [{ a: fr.xBand, b: fr.xS, crossL: false, crossR: false, free: [], pieces: toPieces(got?.puts ?? []) }], stern: null, stubs: [], done: [] };
  const battery = fr.maint ? gunPairs.slice(0, fr.maint.guns.length + fr.maint.inner.length) : [];
  return { fr, lay, score: got?.score ?? Infinity, viable, nodes, why, pins: battery.length, sites: fr.maint?.guns.length ?? 0, battery, puts: got?.puts.length ?? 0 };

  function toPieces(puts: Put[]): Piece[] {
    const part = (sp: Spot, spec: Specs, fill?: boolean): Part => {
      const [f, k] = bay(sp.i).tiers, line = sp.split ?? (f as [number, number])[1];
      const [r0, r1] = sp.tier === 'full' || !k ? [1, Infinity] : sp.tier === 'front' ? [1, line] : [line + 2, Infinity];
      return { x0: bay(sp.i).x0, x1: bay(sp.j - 1).x1, r0, r1, spec, ...(fill ? { fill } : {}), ...(sp.via ? { via: sp.via } : {}) };
    };
    // Front and full-depth rooms first: a back room's way in may be the room in front.
    const sorted = [...puts].sort((u, v) => Number(u.spot.tier === 'back') - Number(v.spot.tier === 'back'));
    return sorted.map((p) => {
      const parts = [part(p.spot, p.specs, p.fill)];
      if (p.annex) parts.push(part(p.annex, [p.specs[0]?.annex ?? null, p.specs[1]?.annex ?? null]));
      return { x0: parts[0]?.x0 ?? 0, x1: parts[0]?.x1 ?? 0, parts, ...(p.item.cabins ? { cabins: true } : {}) };
    });
  }
}
