import { JobC, WORK_CATEGORIES, type WorkCategory } from '../crew/components';
import { isErrand } from '../eva/errands';
import { shipIdOf } from '../regions';
import { looseOn } from '../salvage/cargoRun';
import type { Sim } from '../sim';
import { AwaySiteC } from './components';

/**
 * Which work categories a site's free seats go to (docs/DESIGN.md "Which categories the seats get"), the same way every time: with fewer
 * seats than categories in demand, the categories with the most demand get one seat each; otherwise each gets one and the rest are shared by
 * largest remainder. Ties go in the priority grid's column order (`WORK_CATEGORIES`). Returns one category per seat, in that order.
 */
export function allocateSeats(demand: Partial<Record<WorkCategory, number>>, seats: number): WorkCategory[] {
  const want = WORK_CATEGORIES.map((c, i) => ({ c, i, n: Math.max(0, Math.floor(demand[c] ?? 0)) })).filter((d) => d.n > 0);
  if (seats <= 0 || want.length === 0) return [];
  const most = [...want].sort((a, b) => b.n - a.n || a.i - b.i);
  if (seats <= want.length) return most.slice(0, seats).sort((a, b) => a.i - b.i).map((d) => d.c);
  const total = want.reduce((s, d) => s + d.n, 0);
  const rest = seats - want.length;
  // One seat each, then the rest by largest remainder of each category's share of the rest (integer arithmetic: share = n * rest / total).
  const got = want.map((d) => ({ ...d, k: 1 + Math.floor((d.n * rest) / total), r: (d.n * rest) % total }));
  let left = seats - got.reduce((s, d) => s + d.k, 0);
  for (const d of [...got].sort((a, b) => b.r - a.r || a.i - b.i)) {
    if (left <= 0) break;
    d.k++;
    left--;
  }
  return got.flatMap((d) => Array.from({ length: d.k }, () => d.c));
}

/**
 * The work waiting on a site, by category: its owner's `demand` when it set one, else the open (unreserved) jobs on the site's grid, with the
 * loose loot lying there counted as hauling (each stack is a haul to the hold).
 */
export function siteDemand(sim: Sim, site: number): Partial<Record<WorkCategory, number>> {
  const set = sim.world.get(site, AwaySiteC)?.demand;
  if (set) return set;
  const out: Partial<Record<WorkCategory, number>> = {};
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC)!;
    if (j.reservedBy !== 0 || isErrand(j) || j.kind === 'passage' || shipIdOf(sim, j) !== site) continue;
    out[j.category] = (out[j.category] ?? 0) + 1;
  }
  if (!out.hauling) {
    const loose = looseOn(sim, site).length;
    if (loose > 0) out.hauling = loose;
  }
  return out;
}
