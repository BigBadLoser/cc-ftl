import type { ModuleDef } from '../../registry';
import type { RoomSpec, ShipPlan } from '../plan';
import { bayLayout, type Bay } from './bays';
import { cabinsFor } from './cabinBlock';
import type { Frame } from './frame';
import { areaOf, capOf, programPairs, type Pair } from './pairs';
import { fillers, type Layout, type Part, type Piece, type Placed } from './placeLayout';
import { onHall, opensThrough, roomKind } from './roomAccess';
import { fillerSpec, type Filler } from './roomSize';

/**
 * PROTOTYPE (#581): the plan's rooms on the bays (`bayLayout`). Each mirror pair takes a run of neighbouring bays at
 * one tier: full depth, the front tier on the spine, or the back tier, whose way in is the dock's corridor beside it,
 * the battery's corridor outboard of it, or the room in front. Rooms only come from the plan; a bay left over goes to
 * the room beside it at its tier while that stays near its size, else to a filler. Most constrained first, a few tries
 * a level, the best layout by size error and fillers.
 */

type Tier = 'full' | 'front' | 'back';
/** `split`: a host and its annex's front tier's last row, where they moved the wall between them off the bays' line. */
interface Spot { i: number; j: number; tier: Tier; area: number; via?: Part['via']; split?: number }
interface Put { pair: Pair; spot: Spot; annex?: Spot; fill?: boolean; cabins?: boolean }

/** Floor a room may take past its plan before a leftover bay goes to a filler instead. */
const GROW = 1.8;
/** Floor a room aims for over its plan: room to move and fit out. */
const TARGET = 1.35;

export function bayRooms(plan: ShipPlan, fr: Frame, defs: Record<string, ModuleDef>, budget = 3000): Placed & { puts: number } {
  const bays = bayLayout(fr), n = bays.length;
  const { gunPairs, others, cabinPairs } = programPairs(plan, defs);
  const inBattery = fr.maint ? gunPairs.length : 0;
  const order = [...cabinPairs, ...gunPairs.slice(inBattery), ...others.sort((a, b) => areaOf(b) - areaOf(a))];
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
  const fits = (r: RoomSpec, len: number, rows: number): boolean => (len >= r.w && rows >= r.h) || (len >= r.h && rows >= r.w);

  // Slots taken: per bay, the full depth or its two tiers.
  type Occ = { front: Put | null; back: Put | null }[];
  const free = (o: Occ, i: number, j: number, tier: Tier): boolean => {
    for (let k = i; k < j; k++) {
      const s = o[k] as Occ[number];
      if (tier === 'full' ? s.front || s.back : tier === 'front' ? s.front : s.back) return false;
      if (tier !== 'full' && !twoTier(k)) return false;
    }
    for (let k = i; k + 1 < j; k++) if (!joined(k)) return false;
    return tier === 'full' || sameSplit(i, j);
  };
  const take = (o: Occ, sp: Spot, p: Put): Occ => o.map((s, k) => (k < sp.i || k >= sp.j ? s : sp.tier === 'full' ? { front: p, back: p } : sp.tier === 'front' ? { ...s, front: p } : { ...s, back: p }));
  const len = (i: number, j: number): number => bay(j - 1).x1 - bay(i).x0;
  const rows = (i: number, j: number, tier: Tier): number => Math.round(area(i, j, tier) / Math.max(1, len(i, j)));

  /** A way in for a back-tier room over bays [i, j): its own corridor, else through the room in front (once placed). */
  const backVia = (o: Occ, i: number, j: number, pr: Pair): Part['via'] | null => {
    const hall = pr.every((h) => onHall(roomKind(h)));
    if (hall && byDock(i, j)) return 'dock';
    if (hall && byMaint(i, j)) return 'maint';
    const f = o[i]?.front;
    if (!f || f.spot.tier !== 'front') return null;
    for (let k = i; k < j; k++) if (o[k]?.front !== f) return null;
    return pr.every((h, s) => opensThrough(roomKind(h), roomKind(f.pair[s] as RoomSpec))) ? 'front' : null;
  };

  function spots(o: Occ, p: Pair): { spot: Spot; annex?: Spot; cost: number }[] {
    const out: { spot: Spot; annex?: Spot; cost: number }[] = [];
    const want = areaOf(p), cap = Math.max(capOf(p), want * 1.25), block = !!p[0].block, annex = p[0].annex;
    const hallOk = p.every((h) => onHall(roomKind(h)));
    for (let i = 0; i < n; i++) for (let j = i + 1; j <= n && j - i <= 4; j++) {
      for (const tier of ['full', 'front', 'back'] as Tier[]) {
        if (!free(o, i, j, tier)) continue;
        if (block) {
          if (tier !== 'full' || !p.every((h) => cabinsFor(h, len(i, j), Math.min(...Array.from({ length: j - i }, (_, k) => minDepth(bay(i + k)))))?.stubs.length === 1)) continue;
          out.push({ spot: { i, j, tier, area: area(i, j, tier) }, cost: Math.abs(len(i, j) - 11) / 4 });
          continue;
        }
        const a = area(i, j, tier), rw = rows(i, j, tier), ln = len(i, j);
        if (annex) {
          // The host in front, its annex behind it over the same bays (through the host), the wall between them moved
          // up to two rows off the bays' line: the annex as small as it may be, the host taking the rest.
          if (tier !== 'front' || !free(o, i, j, 'back')) continue;
          const line = (bay(i).tiers[0] as [number, number])[1], hostWant = p[0].w * p[0].h, annexWant = annex.w * annex.h;
          let bestSplit: { split: number; a: number; b: number; cost: number } | null = null;
          for (let split = line - 2; split <= line + 2; split++) {
            const a2 = area(i, j, 'front', split), b2 = area(i, j, 'back', split), back = Math.min(...Array.from({ length: j - i }, (_, k) => minDepth(bay(i + k)))) - split - 1;
            if (split < 3 || back < 3 || a2 < hostWant || b2 < 0.85 * annexWant || !p.every((h) => fits(h, len(i, j), split))) continue;
            const cost = Math.abs(a2 / hostWant - TARGET) + 0.5 * Math.abs(b2 / annexWant - 1);
            if (!bestSplit || cost < bestSplit.cost) bestSplit = { split, a: a2, b: b2, cost };
          }
          if (!bestSplit) continue;
          const { split } = bestSplit;
          out.push({ spot: { i, j, tier, area: bestSplit.a, split }, annex: { i, j, tier: 'back', area: bestSplit.b, via: 'front', split }, cost: bestSplit.cost });
          continue;
        }
        // (A bay tier is coarse: a small room may take up to about two and a half times its plan, at a cost.)
        if (a < want || a > Math.max(cap * 1.3, want * 2.5) || !p.every((h) => fits(h, ln, rw))) continue;
        let via: Part['via'] | undefined;
        if (tier === 'back') { const v = backVia(o, i, j, p); if (!v) continue; via = v; } else if (!hallOk) continue;
        // Small rooms prefer a tier; a room past its cap costs more.
        out.push({ spot: { i, j, tier, area: a, ...(via ? { via } : {}) }, cost: Math.abs(a / want - TARGET) + (a > cap * 1.3 ? 1 : 0) + (tier === 'full' && want < 30 ? 0.3 : 0) });
      }
    }
    return out.sort((u, v) => u.cost - v.cost);
  }
  function minDepth(b: Bay): number { let d = Infinity; for (let x = b.x0; x < b.x1; x++) d = Math.min(d, fr.depth(x)); return d; }

  let best: { o: Occ; puts: Put[]; score: number } | null = null, nodes = 0, viable = 0;
  const why = new Map<string, number>();
  const note = (k: string): void => { why.set(k, (why.get(k) ?? 0) + 1); };
  const empty: Occ = bays.map(() => ({ front: null, back: null }));
  function dfs(o: Occ, puts: Put[], left: Pair[], cost: number): void {
    if (++nodes > budget) return;
    if (left.length === 0) {
      const done = finish(o, puts);
      if (!done) return;
      viable++;
      if (!best || done.score + cost < best.score) best = { ...done, score: done.score + cost };
      return;
    }
    // Most constrained first: the pair with the fewest spots.
    // (A room with no spot yet may get one behind a room still to come: it waits, unless nothing else has one.)
    let pi = -1, cs: ReturnType<typeof spots> = [];
    for (const [k, p] of left.entries()) { const c = spots(o, p); if (c.length > 0 && (pi < 0 || c.length < cs.length)) { pi = k; cs = c; } }
    if (pi < 0) { note(`no spot ${left.map((p) => p[0].role).join(',')}`); return; }
    const p = left[pi] as Pair;
    for (const c of cs.slice(0, 3)) {
      const put: Put = { pair: p, spot: c.spot, ...(c.annex ? { annex: c.annex } : {}), ...(p[0].block ? { cabins: true } : {}) };
      let o2 = take(o, c.spot, put);
      if (c.annex) o2 = take(o2, c.annex, put);
      dfs(o2, [...puts, put], left.filter((_, k) => k !== pi), cost + c.cost);
    }
  }

  /** Bays left over: the room beside at that tier grows over them while near its size, else a filler. */
  function finish(o0: Occ, puts0: Put[]): { o: Occ; puts: Put[]; score: number } | null {
    let o = o0.map((s) => ({ ...s }));
    const puts = [...puts0];
    const swap = (from: Put, to: Put): void => { o = o.map((s) => ({ front: s.front === from ? to : s.front, back: s.back === from ? to : s.back })); };
    let score = 0, nFill = 0;
    const left: Filler[] = ['workshop', 'lounge', 'gym', 'farm'];
    for (let k = 0; k < n; k++) for (const tier of (twoTier(k) ? ['front', 'back'] : ['full']) as Tier[]) {
      const s = o[k] as Occ[number];
      if (tier === 'full' ? s.front || s.back : tier === 'front' ? s.front : s.back) continue;
      // A neighbour at this tier (or full depth over a one-tier bay) grows over it.
      const near = [k - 1, k + 1].filter((m) => m >= 0 && m < n && joined(Math.min(m, k))).map((m) => (tier === 'back' ? o[m]?.back : o[m]?.front)).filter((p): p is Put => !!p && !p.fill && !p.cabins && !p.annex && p.spot.tier === tier);
      const grow = near.find((p) => (p.spot.area + area(k, k + 1, tier)) <= GROW * areaOf(p.pair) && (sameSplit(Math.min(p.spot.i, k), Math.max(p.spot.j, k + 1)) || tier === 'full'));
      if (grow) {
        const old = grow, nw: Put = { ...old, spot: { ...old.spot, i: Math.min(old.spot.i, k), j: Math.max(old.spot.j, k + 1), area: old.spot.area + area(k, k + 1, tier) } };
        puts[puts.indexOf(old)] = nw; swap(old, nw); o = take(o, { ...nw.spot, i: k, j: k + 1 }, nw);
        score += 2 * Math.max(0, nw.spot.area / areaOf(nw.pair) - 1);
        continue;
      }
      const a = area(k, k + 1, tier);
      if (a < 9) { score += 5; continue; }
      // The next filler kind left; behind a room, the first kind that may open through it.
      const kinds: Filler[] = [...(a >= 12 ? left : []), 'hold'];
      let f: RoomSpec | null = null, via: Part['via'] | undefined;
      for (const kd of kinds) {
        const c = fillerSpec(kd, a), v = tier === 'back' ? backVia(o, k, k + 1, [c, c]) : undefined;
        if (tier === 'back' && !v) continue;
        f = c; via = v ?? undefined;
        if (left.includes(kd)) left.splice(left.indexOf(kd), 1);
        break;
      }
      if (!f) {
        // No filler may open through the room in front: that room takes the bay's full depth, if it is that bay's alone.
        const fr0 = o[k]?.front;
        if (!fr0 || fr0.fill || fr0.cabins || fr0.annex || fr0.spot.i !== k || fr0.spot.j !== k + 1 || fr0.spot.tier !== 'front') { note(`back pocket x${bay(k).x0}`); return null; }
        const nw: Put = { ...fr0, spot: { i: k, j: k + 1, tier: 'full', area: area(k, k + 1, 'full') } };
        puts[puts.indexOf(fr0)] = nw; swap(fr0, nw); o = take(o, nw.spot, nw);
        score += 2 * Math.max(0, nw.spot.area / areaOf(nw.pair) - 1);
        continue;
      }
      fillers.add(f);
      const put: Put = { pair: [f, f], spot: { i: k, j: k + 1, tier, area: a, ...(via ? { via } : {}) }, fill: true };
      puts.push(put); o = take(o, put.spot, put);
      nFill++; score += 1 + (nFill > 2 ? 4 : 0);
    }
    return { o, puts, score };
  }

  dfs(empty, [], order, 0);
  const got = best as { puts: Put[]; score: number } | null;
  const lay: Layout = { blocks: [{ a: fr.xBand, b: fr.xS, crossL: false, crossR: false, free: [], pieces: toPieces(got?.puts ?? []) }], stern: null, stubs: [], done: [] };
  const battery = fr.maint ? gunPairs.slice(0, fr.maint.guns.length + fr.maint.inner.length) : [];
  return { fr, lay, score: got?.score ?? Infinity, viable, nodes, why, pins: battery.length, sites: fr.maint?.guns.length ?? 0, battery, puts: got?.puts.length ?? 0 };

  function toPieces(puts: Put[]): Piece[] {
    const part = (sp: Spot, spec: Part['spec'], fill?: boolean): Part => {
      const [f, k] = bay(sp.i).tiers;
      const line = sp.split ?? (f as [number, number])[1];
      const [r0, r1] = sp.tier === 'full' || !k ? [1, Infinity] : sp.tier === 'front' ? [1, line] : [line + 2, Infinity];
      return { x0: bay(sp.i).x0, x1: bay(sp.j - 1).x1, r0, r1, spec, ...(fill ? { fill } : {}), ...(sp.via ? { via: sp.via } : {}) };
    };
    // Front and full-depth rooms first: a back room's way in may be the room in front.
    const sorted = [...puts].sort((u, v) => Number(u.spot.tier === 'back') - Number(v.spot.tier === 'back'));
    return sorted.map((p) => {
      const parts = [part(p.spot, [p.pair[0], p.pair[1]], p.fill)];
      if (p.annex) parts.push(part(p.annex, [p.pair[0].annex ?? null, p.pair[1].annex ?? null]));
      return { x0: parts[0]?.x0 ?? 0, x1: parts[0]?.x1 ?? 0, parts, ...(p.cabins ? { cabins: true } : {}) };
    });
  }
}
