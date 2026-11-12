import type { RoomSpec } from '../plan';
import { bandUnits, stripsFor, type BandUnit, type Site } from '../stationFlowKit';

/**
 * The band by department. Each room asks for a place near an angle (its department's anchor, 0 = north, clockwise);
 * bigger rooms choose first, each taking the free run of lattice units nearest its angle, so a department's rooms stand
 * together where the flow wants them instead of being dealt round the ring in list order. Units nobody takes become
 * garden galleries (one room a run), counted as spare.
 */

export interface BandAsk { spec: RoomSpec; angle: number }

const TAU = 2 * Math.PI;
const apart = (a: number, b: number): number => { const d = Math.abs(a - b) % TAU; return Math.min(d, TAU - d); };

export function placeBand(s: Site, asks: readonly BandAsk[]): { left: RoomSpec[]; spare: number } {
  const { g } = s;
  const units = bandUnits(s);
  const n = units.length;
  // Units i and i + 1 (round the ring) form one run when they share a face and touch.
  const keys = units.map((u) => new Set(u.tiles.map(([x, y]) => (y + 512) * 1024 + x + 512)));
  const joined = units.map((u, i) => {
    const v = units[(i + 1) % n] as BandUnit, vk = keys[(i + 1) % n] as Set<number>;
    return n > 1 && v.face === u.face && u.tiles.some(([x, y]) => vk.has((y + 512) * 1024 + x + 1 + 512) || vk.has((y + 512) * 1024 + x - 1 + 512) || vk.has((y + 513) * 1024 + x + 512) || vk.has((y + 511) * 1024 + x + 512));
  });
  const give = (spec: RoomSpec | null, idx: number[]): void => {
    const us = idx.map((i) => units[i] as BandUnit);
    const id = spec ? g.room(spec.role, { spec, rank: Math.min(...us.map((u) => u.rank)) }) : g.room('garden', { rank: Math.min(...us.map((u) => u.rank)), dept: 'commons' });
    for (const u of us) { u.used = true; for (const [x, y] of u.tiles) g.set(x, y, id); }
  };
  const order = [...asks].sort((a, c) => (a.spec.cabin ? 0 : stripsFor(a.spec)) < (c.spec.cabin ? 0 : stripsFor(c.spec)) ? 1 : -1);
  const left: RoomSpec[] = [];
  const bunks: RoomSpec[] = [];
  for (const ask of order) {
    const need = ask.spec.cabin ? 1 : stripsFor(ask.spec);
    let best: { idx: number[]; cost: number } | null = null;
    for (let i = 0; i < n; i++) {
      const idx: number[] = [];
      let cap = 0, j = i;
      while (cap < need && idx.length < n && !(units[j] as BandUnit).used) {
        idx.push(j);
        cap += (units[j] as BandUnit).strips;
        if (cap >= need || !joined[j]) break;
        j = (j + 1) % n;
      }
      if (cap < need) continue;
      const mid = idx.reduce((t, k) => t + (units[k] as BandUnit).angle, 0) / idx.length;
      // Nearest its angle; a room wider than it needs (a cabin on a double unit) costs a little.
      const cost = apart(mid, ask.angle) + (cap - need) * 0.4;
      if (!best || cost < best.cost) best = { idx, cost };
    }
    if (!best) { left.push(ask.spec); continue; }
    if (ask.spec.cabin) bunks.push(ask.spec);
    give(ask.spec, best.idx);
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
