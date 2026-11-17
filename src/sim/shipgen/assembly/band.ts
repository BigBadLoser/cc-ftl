import type { RoomSpec } from '../plan';
import { bandUnits, stripsFor, type BandUnit, type Site } from './lattice';

/**
 * The band by department. Each room asks for a place near an angle (its department's anchor, 0 = north, clockwise);
 * bigger rooms choose first, each taking the free run of lattice units nearest its angle, so a department's rooms stand
 * together where the flow wants them instead of being dealt round the ring in list order. Units nobody takes become
 * garden galleries (one room a run), counted as spare.
 */

export interface BandAsk { spec: RoomSpec; angle: number }

const TAU = 2 * Math.PI;
const apart = (a: number, b: number): number => { const d = Math.abs(a - b) % TAU; return Math.min(d, TAU - d); };

export function placeBand(s: Site, asks: readonly BandAsk[], first?: (r: RoomSpec) => number): { left: RoomSpec[]; spare: number } {
  const { g } = s;
  const units = bandUnits(s);
  const n = units.length;
  // Units i and i + 1 (round the ring) form one run when they share a face and touch.
  const keys = units.map((u) => new Set(u.tiles.map(([x, y]) => (y + 512) * 1024 + x + 512)));
  const joined = units.map((u, i) => {
    const v = units[(i + 1) % n] as BandUnit, vk = keys[(i + 1) % n] as Set<number>;
    return n > 1 && v.face === u.face && u.tiles.some(([x, y]) => vk.has((y + 512) * 1024 + x + 1 + 512) || vk.has((y + 512) * 1024 + x - 1 + 512) || vk.has((y + 513) * 1024 + x + 512) || vk.has((y + 511) * 1024 + x + 512));
  });
  const give = (spec: RoomSpec | null, idx: number[], access?: number[]): number => {
    const us = idx.map((i) => units[i] as BandUnit);
    const id = spec ? g.room(spec.role, { spec, rank: Math.min(...us.map((u) => u.rank)), ...(access ? { access } : {}) }) : g.room('garden', { rank: Math.min(...us.map((u) => u.rank)), dept: 'commons' });
    for (const u of us) { u.used = true; for (const [x, y] of u.tiles) g.set(x, y, id); }
    return id;
  };
  // Bigger rooms choose first; a room with an annex counts as both and goes before a plain one its size, since it
  // needs a run of two units.
  const size = (r: RoomSpec): number => (r.cabin ? 0 : stripsFor(r)) + (r.annex ? 1.5 : 0);
  // `first`: a rank; higher choose before the rest whatever their size (rooms that must stand in the band).
  const ahead = (r: RoomSpec): number => first?.(r) ?? 0;
  const order = [...asks].sort((a, c) => ahead(c.spec) - ahead(a.spec) || (size(a.spec) < size(c.spec) ? 1 : -1));
  const left: RoomSpec[] = [];
  const bunks: RoomSpec[] = [];
  for (const ask of order) {
    // A room with an annex takes a run for both, of two units at least: the annex is the run's last unit, one strip
    // of the band (a small room, whatever its planned shape).
    const annex = ask.spec.annex, extra = annex ? 1 : 0;
    const need = (ask.spec.cabin ? 1 : stripsFor(ask.spec)) + extra;
    let best: { idx: number[]; cost: number } | null = null;
    for (let i = 0; i < n; i++) {
      const idx: number[] = [];
      let cap = 0, j = i;
      const enough = (): boolean => cap >= need && (!annex || idx.length >= 2);
      while (!enough() && idx.length < n && !(units[j] as BandUnit).used) {
        idx.push(j);
        cap += (units[j] as BandUnit).strips;
        if (enough() || !joined[j]) break;
        j = (j + 1) % n;
      }
      if (!enough()) continue;
      const mid = idx.reduce((t, k) => t + (units[k] as BandUnit).angle, 0) / idx.length;
      // Nearest its angle; a room wider than it needs (a cabin on a double unit) costs a little.
      const cost = apart(mid, ask.angle) + (cap - need) * 0.4;
      if (!best || cost < best.cost) best = { idx, cost };
    }
    if (!best) { left.push(ask.spec); continue; }
    if (ask.spec.cabin) bunks.push(ask.spec);
    if (annex) {
      // The annex opens into its room, through the wall between their units.
      const tail = [best.idx.pop() as number];
      give(annex, tail, [give(ask.spec, best.idx)]);
    } else give(ask.spec, best.idx);
  }
  // A cabin or two over: they double up (a second bed in a cabin already placed) before the whole ring grows a step.
  const cabinsLeft = left.filter((r) => r.cabin);
  if (cabinsLeft.length === left.length && left.length <= 2 && bunks.length >= left.length) {
    for (const [k, extra] of left.splice(0).entries()) (bunks[k] as RoomSpec).mods.push(...extra.mods);
  }
  // What nobody took: one garden gallery a run.
  let spare = 0;
  for (let i = 0; i < n; i++) {
    if ((units[i] as BandUnit).used) continue;
    const idx = [i];
    while (joined[idx[idx.length - 1] as number] && !(units[((idx[idx.length - 1] as number) + 1) % n] as BandUnit).used && idx.length < n) idx.push(((idx[idx.length - 1] as number) + 1) % n);
    spare += idx.reduce((t, k) => t + (units[k] as BandUnit).strips, 0);
    give(null, idx);
  }
  return { left, spare };
}
