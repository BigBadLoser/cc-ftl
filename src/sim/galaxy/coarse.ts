import type { Sim } from '../sim';
import { controlOf, sectorOwners, tidyControl } from './control';
import { flipSector, reportFell } from './flip';
import { nodesWithin } from './graph';
import { strHash, unit } from './hash';
import { report } from './news';
import { atWarContent } from './relations';
import { START_NODE, galaxyIndex, nodeOf, type GalaxyIndex } from './state';
import { FLEET_AREA_HOPS } from './tuning';
import {
  COARSE_TURNS, DEFENDER_EDGE, FACTION_MIN_SECTORS, FALLOFF, FLIPS_PER_TICK, FLIP_COOLDOWN, FLIP_THRESHOLD, FLIP_TICKS, NEWS_PER_TICK, OWED_WEIGHT, PIRATE_FLIP_MULT, PIRATE_HOLD,
  PIRATE_RAID, PRESSURE_DECAY, PRESSURE_EPS, PRESSURE_KEEP, PRESSURE_MAX, PUSH_RATE, PUSH_SWING, SECTOR_BASE, SECTOR_HUB, SECTOR_PORT, STRENGTH_LANES,
} from './tuningCoarse';

/**
 * The coarse tier (#604): the far galaxy keeps living. Every COARSE_TURNS turns (`stepCoarse`, from the turn hook) the generated sectors are re-weighed at
 * the fronts, the lane-adjacent sectors held by factions at war (relations.ts):
 * 1. a faction's strength around a sector counts its own sectors within STRENGTH_LANES lanes (hubs and stations weigh more), less what its ports still owe;
 * 2. the stronger side adds pressure to the weaker sector, with a hashed swing; with no push, pressure decays;
 * 3. a sector flips after FLIP_TICKS ticks in a row over the threshold, at most FLIPS_PER_TICK per tick, strongest first (flip.ts);
 * 4. never flipped: the start sector, a cluster's hub, a faction's last FACTION_MIN_SECTORS sectors, the sector the player is in, and one that flipped in the last FLIP_COOLDOWN ticks. Pirates raid
 *    rather than hold: stronger pushing, weaker holding, a higher flip threshold.
 * All rolls are hashes of (seed, sector, tick index): no Rng, no catch-up. Cost is O(sectors) per tick, and it runs wherever the player is.
 * Outside the fleet area it posts summary news (`front`, `held`); a `fell` is posted wherever it happens.
 */

/** The sector the game starts in (its start node's): it never changes hands. */
const START_SECTOR = START_NODE.slice(0, START_NODE.lastIndexOf('.n'));

const lanesCache = new WeakMap<GalaxyIndex, Map<string, string[]>>();

/** Sector -> the sectors a hyperlane joins it to, sorted (cached per galaxy index). */
export function sectorLanes(index: GalaxyIndex): Map<string, string[]> {
  let m = lanesCache.get(index);
  if (m) return m;
  m = new Map();
  for (const e of index.edges.values()) {
    const a = index.nodes.get(e.a)?.sector;
    const b = index.nodes.get(e.b)?.sector;
    if (e.kind !== 'hyperlane' || !a || !b || a === b) continue;
    for (const [x, y] of [[a, b], [b, a]] as const) {
      const list = m.get(x) ?? [];
      if (!list.includes(y)) list.push(y);
      m.set(x, list);
    }
  }
  for (const list of m.values()) list.sort();
  lanesCache.set(index, m);
  return m;
}

/** One coarse tick's working view: owners now, sector weights and strengths (cached for the tick). */
class Field {
  readonly owners: Map<string, string | null>;
  private readonly weights = new Map<string, number>();
  private readonly strengths = new Map<string, number>();
  private readonly owed = new Map<string, number>();

  constructor(private readonly sim: Sim, readonly index: GalaxyIndex, readonly lanes: Map<string, string[]>) {
    this.owners = sectorOwners(sim);
    for (const [port, st] of Object.entries(sim.galaxy.ports)) {
      const sector = index.nodes.get(port.slice(0, port.indexOf('#')))?.sector;
      if (sector) this.owed.set(sector, (this.owed.get(sector) ?? 0) + st.queue.length);
    }
  }

  private weight(id: string): number {
    let w = this.weights.get(id);
    if (w !== undefined) return w;
    const s = this.index.sectors.get(id);
    const owner = this.owners.get(id);
    const defs = this.sim.content.galaxy?.structures;
    let stations = 0;
    for (const nid of s?.nodes ?? []) for (const st of this.index.nodes.get(nid)?.structures ?? []) if (st.genOwner === owner && defs?.[st.def]?.kind === 'station') stations++;
    w = Math.max(0.2, SECTOR_BASE + (s?.hub ? SECTOR_HUB : 0) + SECTOR_PORT * stations - OWED_WEIGHT * (this.owed.get(id) ?? 0));
    this.weights.set(id, w);
    return w;
  }

  /** `faction`'s strength around sector `at`: its sectors within STRENGTH_LANES lanes, nearer ones counting more. */
  strength(faction: string, at: string): number {
    const key = `${faction}|${at}`;
    let v = this.strengths.get(key);
    if (v !== undefined) return v;
    v = 0;
    const seen = new Set([at]);
    let ring = [at];
    for (let d = 0; d <= STRENGTH_LANES && ring.length; d++) {
      const next: string[] = [];
      for (const id of ring) {
        if (this.owners.get(id) === faction) v += (FALLOFF[d] ?? 0) * this.weight(id);
        for (const o of this.lanes.get(id) ?? []) {
          if (seen.has(o)) continue;
          seen.add(o);
          next.push(o);
        }
      }
      ring = next;
    }
    this.strengths.set(key, v);
    return v;
  }
}

const isPirate = (sim: Sim, f: string): boolean => sim.content.galaxy?.factions[f]?.kind === 'pirates';

/** The pressure a sector needs to count towards a flip to `by`. */
const thresholdFor = (sim: Sim, by: string): number => FLIP_THRESHOLD * (isPirate(sim, by) ? PIRATE_FLIP_MULT : 1);

/** The strongest push on `target` this tick, from a lane-adjacent sector of an enemy at war with its owner: who and how hard (0..1 of full), or null. */
function bestPush(sim: Sim, f: Field, target: string, owner: string): { by: string; share: number } | null {
  const content = sim.content.galaxy;
  if (!content) return null;
  let best: { by: string; share: number } | null = null;
  const defence = f.strength(owner, target) * DEFENDER_EDGE * (isPirate(sim, owner) ? PIRATE_HOLD : 1);
  for (const a of f.lanes.get(target) ?? []) {
    const by = f.owners.get(a);
    if (!by || by === owner || !atWarContent(content, by, owner)) continue;
    const attack = f.strength(by, a) * (isPirate(sim, by) ? PIRATE_RAID : 1);
    const share = (attack - defence) / (attack + defence);
    if (share > 0 && (!best || share > best.share)) best = { by, share };
  }
  return best;
}

/** Can the sector change hands now? (protected sectors and a faction's last few never do; nor the player's own sector, nor one that changed hands lately; the taker must border it) */
function mayFlip(sim: Sim, f: Field, id: string, owner: string, by: string, count: Map<string, number>, turn: number): boolean {
  const s = f.index.sectors.get(id);
  if (!s || s.hub || id === START_SECTOR) return false;
  if (turn - (sim.galaxy.control[id]?.since || -Infinity) < FLIP_COOLDOWN * COARSE_TURNS) return false;
  if ((count.get(owner) ?? 0) <= FACTION_MIN_SECTORS) return false;
  if (!(f.lanes.get(id) ?? []).some((a) => f.owners.get(a) === by)) return false;
  return nodeOf(sim, sim.galaxy.current)?.sector !== id;
}

/** The coarse tick, on every COARSE_TURNS-th turn. Wherever the player is; only generated sectors take part. */
export function stepCoarse(sim: Sim, turn: number): void {
  if (turn <= 0 || turn % COARSE_TURNS !== 0 || !sim.content.galaxy) return;
  const g = sim.galaxy;
  const tick = turn / COARSE_TURNS;
  const index = galaxyIndex(g);
  const f = new Field(sim, index, sectorLanes(index));
  const targets = [...f.owners.keys()].sort();
  const area = nodesWithin(sim, g.current, FLEET_AREA_HOPS);
  const news: { value: number; kind: 'front' | 'held'; sector: string; faction: string; foe: string }[] = [];
  const ready: { id: string; value: number; by: string }[] = [];
  for (const id of targets) {
    const owner = f.owners.get(id) ?? null;
    const cur = g.control[id]?.pressure;
    const push = owner ? bestPush(sim, f, id, owner) : null;
    if (!push && !cur) continue;
    const c = controlOf(sim, id);
    if (!owner) {
      delete c.pressure;
      tidyControl(sim, id);
      continue;
    }
    if (push) {
      const swing = 1 + PUSH_SWING * (2 * unit(sim.seed, strHash(id), tick, 604) - 1);
      const add = PUSH_RATE * push.share * swing;
      const same = cur?.by === push.by;
      const value = Math.min(PRESSURE_MAX, (same ? cur.value * PRESSURE_KEEP : 0) + add);
      const over = value >= thresholdFor(sim, push.by);
      c.pressure = { by: push.by, value, ticks: over ? (same ? cur.ticks : 0) + 1 : 0 };
      const p = c.pressure;
      if (p.ticks === 1) news.push({ value, kind: 'front', sector: id, faction: push.by, foe: owner });
      if (p.ticks >= FLIP_TICKS) ready.push({ id, value, by: push.by });
    } else if (cur) {
      // No push this tick: it wears off, though it still counts towards a flip while it stays over the threshold (pressure the fine tier added).
      const value = cur.value * PRESSURE_DECAY;
      const over = value >= thresholdFor(sim, cur.by);
      if (cur.ticks >= 1 && !over) news.push({ value: cur.value, kind: 'held', sector: id, faction: owner, foe: cur.by });
      if (value < PRESSURE_EPS) delete c.pressure;
      else c.pressure = { by: cur.by, value, ticks: over ? cur.ticks + 1 : 0 };
      if (c.pressure && c.pressure.ticks >= FLIP_TICKS) ready.push({ id, value, by: cur.by });
    }
    tidyControl(sim, id);
  }
  for (const id of Object.keys(g.control)) tidyControl(sim, id);
  // Flips: the strongest pressure first, within the cap and the protections.
  const count = new Map<string, number>();
  for (const o of f.owners.values()) if (o) count.set(o, (count.get(o) ?? 0) + 1);
  ready.sort((a, b) => b.value - a.value || (a.id < b.id ? -1 : 1));
  let flips = 0;
  for (const r of ready) {
    if (flips >= FLIPS_PER_TICK) break;
    const owner = f.owners.get(r.id) as string;
    if (!mayFlip(sim, f, r.id, owner, r.by, count, turn)) continue;
    flipSector(sim, r.id, r.by, turn);
    reportFell(sim, r.id, r.by, owner, turn);
    count.set(owner, (count.get(owner) ?? 0) - 1);
    count.set(r.by, (count.get(r.by) ?? 0) + 1);
    flips++;
  }
  // Summary news for what the fine tier does not show (outside the fleet area), a few per tick.
  news.sort((a, b) => b.value - a.value || (a.sector < b.sector ? -1 : 1));
  let posted = 0;
  for (const n of news) {
    const s = index.sectors.get(n.sector);
    if (!s || posted >= NEWS_PER_TICK || s.nodes.some((id) => area.has(id))) continue;
    report(sim, { kind: n.kind, node: s.nodes[0] as string, who: s.name, faction: n.faction, foeFaction: n.foe }, turn);
    posted++;
  }
}
