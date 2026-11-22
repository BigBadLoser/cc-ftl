import type { Sim } from '../sim';
import type { GalaxyContent } from './defs';
import { sectorNeighbours, sectorOwners, simulatedSectors } from './control';
import { strHash, unit } from './hash';
import { report } from './news';
import { baselineStance, mayChange, pairKey, stanceOf } from './relations';
import { galaxyIndex } from './state';
import { COARSE_TURNS } from './tuningCoarse';
import {
  END_BASE, END_TIRED, FRICTION_CAP, FRICTION_GAIN, HEAT_DECAY, HEAT_FLIP, HEAT_GAIN, HEAT_LOSS, NO_BORDER_END_MULT, RIVAL_MULT, START_BASE, STANCE_COOLDOWN, STANCE_EPS,
  STANCE_PER_TICK, TIRED_FLIP, TIRED_LOSS, TIRED_TICK,
} from './tuningStance';
import type { PairState } from './types';

/**
 * Dynamic wars (#604). The relations table is the baseline; how two factions stand now is `GalaxyState.war` (only pairs that differ or carry history), read through
 * `stanceOf` / `atWar` (relations.ts), so fleets, jobs and fronts all follow. On every coarse tick (`stepWar`, from coarse.ts):
 * - a pair at peace that borders (sectors touching, `sectorNeighbours`) may start a war, with a small hashed chance raised by friction (the border's length and
 *   the heat of recent fights) and by old rivalry (a pair the table lists at war);
 * - a war may end, the chance raised by war weariness (time at war, sectors lost, ships lost) and when the two no longer border;
 * - a pair that changed rests STANCE_COOLDOWN ticks, and only STANCE_PER_TICK pairs change per tick galaxy-wide: a handful per day of play, not churn.
 * Only pairs the table lists without `fixed` can change (relations.ts `mayChange`). Fights and flips between the pair feed weariness and heat (`strain`).
 */

/** The pair's entry, made at its current stance (and kept only while it says something: `tidyPair`). */
function pairOf(sim: Sim, a: string, b: string): PairState {
  return (sim.galaxy.war[pairKey(a, b)] ??= { stance: stanceOf(sim, a, b), since: 0, tired: 0, heat: 0 });
}

/** Drop the pair's entry when it says nothing the table does not: the baseline stance, no history, and rested. */
function tidyPair(sim: Sim, key: string, content: GalaxyContent): void {
  const e = sim.galaxy.war[key];
  if (!e) return;
  const [a, b] = key.split('|') as [string, string];
  const rested = e.since === 0 || sim.galaxy.turn - e.since >= STANCE_COOLDOWN * COARSE_TURNS;
  if (e.stance === baselineStance(content, a, b) && e.tired < STANCE_EPS && e.heat < STANCE_EPS && rested) delete sim.galaxy.war[key];
}

/** Fights between `a` and `b` (sectors taken, ships lost) wear them down and heat their border. Nothing happens for a pair that cannot change. */
export function strain(sim: Sim, a: string, b: string, sectors: number, ships: number): void {
  const content = sim.content.galaxy;
  if (!content || !mayChange(content, a, b)) return;
  const e = pairOf(sim, a, b);
  if (e.stance === 'war') e.tired += TIRED_FLIP * sectors + TIRED_LOSS * ships;
  e.heat += HEAT_FLIP * sectors + HEAT_LOSS * ships;
}

interface Border {
  /** Sector pairs that touch. */
  n: number;
  /** A sector of each side on the border. */
  at: Map<string, string>;
}

/** The border of every pair of factions (by pair key), and the factions that hold something. */
function contacts(sim: Sim): { border: Map<string, Border>; alive: Set<string> } {
  const owners = sectorOwners(sim);
  const nbrs = sectorNeighbours(galaxyIndex(sim.galaxy));
  const border = new Map<string, Border>();
  const area = simulatedSectors(sim);
  for (const [id, list] of [...nbrs].filter(([s]) => area.has(s)).sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
    const a = owners.get(id);
    if (!a) continue;
    for (const o of list) {
      const b = owners.get(o);
      if (!b || b === a || o < id) continue;
      const k = pairKey(a, b);
      const e = border.get(k) ?? { n: 0, at: new Map() };
      e.n++;
      if (!e.at.has(a)) e.at.set(a, id);
      if (!e.at.has(b)) e.at.set(b, o);
      border.set(k, e);
    }
  }
  return { border, alive: new Set([...owners.values()].filter((o): o is string => !!o)) };
}

interface Option {
  key: string;
  a: string;
  b: string;
  start: boolean;
  /** roll / chance: the smaller, the likelier it was. */
  ratio: number;
}

/**
 * The coarse tick's war step: ages weariness and heat, then makes at most STANCE_PER_TICK pairs start or end a war. `flips` are the sectors that changed hands
 * this tick (taker and loser). The first faction of the table's row is named as the one who started or asked for it.
 */
export function stepWar(sim: Sim, turn: number, tick: number, flips: readonly { by: string; from: string | null }[]): void {
  const content = sim.content.galaxy;
  if (!content) return;
  const g = sim.galaxy;
  for (const f of flips) if (f.from) strain(sim, f.by, f.from, 1, 0);
  const { border, alive } = contacts(sim);
  const seen = new Set<string>();
  const options: Option[] = [];
  for (const r of content.relations) {
    const key = pairKey(r.a, r.b);
    if (seen.has(key) || !mayChange(content, r.a, r.b)) continue;
    seen.add(key);
    // A war that has run quietly since the start has no entry yet: make one so time at war wears it down like any other.
    const e = g.war[key] ?? (alive.has(r.a) && alive.has(r.b) && stanceOf(sim, r.a, r.b) === 'war' ? pairOf(sim, r.a, r.b) : undefined);
    if (e) {
      e.heat *= HEAT_DECAY;
      if (e.stance === 'war') e.tired += TIRED_TICK;
    }
    if (!alive.has(r.a) || !alive.has(r.b) || (e && e.since !== 0 && turn - e.since < STANCE_COOLDOWN * COARSE_TURNS)) continue;
    const n = border.get(key)?.n ?? 0;
    const roll = unit(sim.seed, strHash(key), tick, 605);
    if (stanceOf(sim, r.a, r.b) === 'war') {
      const p = (END_BASE + END_TIRED * (e?.tired ?? 0)) * (n ? 1 : NO_BORDER_END_MULT);
      if (roll < p) options.push({ key, a: r.a, b: r.b, start: false, ratio: roll / p });
    } else if (n > 0) {
      const rival = baselineStance(content, r.a, r.b) === 'war' ? RIVAL_MULT : 1;
      const p = START_BASE * (1 + FRICTION_GAIN * Math.min(n, FRICTION_CAP) + HEAT_GAIN * (e?.heat ?? 0)) * rival;
      if (roll < p) options.push({ key, a: r.a, b: r.b, start: true, ratio: roll / p });
    }
  }
  options.sort((p, q) => p.ratio - q.ratio || (p.key < q.key ? -1 : 1));
  const index = galaxyIndex(g);
  for (const o of options.slice(0, STANCE_PER_TICK)) {
    const e = pairOf(sim, o.a, o.b);
    e.stance = o.start ? 'war' : 'neutral';
    e.since = turn;
    e.tired = 0;
    const sector = border.get(o.key)?.at.get(o.a);
    const node = (sector && index.sectors.get(sector)?.nodes[0]) || g.current;
    report(sim, { kind: o.start ? 'war' : 'peace', node, who: '', faction: o.a, foeFaction: o.b }, turn);
  }
  for (const key of Object.keys(g.war)) tidyPair(sim, key, content);
}
