import type { Sim } from '../sim';
import { atWar } from './clash';
import { nodesWithin } from './graph';
import { hash32, strHash, unit } from './hash';
import { shipNameFor } from './names';
import { usedNames } from './roster';
import { pickWeighted } from './sector';
import { portsAt } from './portIndex';
import type { Port } from './ports';
import { tierOf } from './standing';
import { nodeOf } from './state';
import {
  BOUNTY_BASE, BOUNTY_HOPS, BOUNTY_PER_DANGER, BOUNTY_PER_HOP, BOUNTY_TURNS_BASE, BOUNTY_TURNS_PER_HOP, DELIVERY_BASE, DELIVERY_COUNT, DELIVERY_HOPS, DELIVERY_ITEMS, DELIVERY_PER_DANGER,
  DELIVERY_PER_HOP, DELIVERY_TURNS_BASE, DELIVERY_TURNS_PER_HOP, OFFERS_PER_PORT, OFFER_TURNS,
} from './tuningJobs';
import type { StationJob } from './types';

/**
 * StationJob offers (see tuningJobs.ts). Nothing is stored: the offers of a port are drawn from hashes of (seed, port, OFFER_TURNS window, slot), against the world as it is
 * (which stations are in reach, which enemy fleets are about), so the same offer keeps its key while it stands. Taken and finished keys are in `GalaxyState.jobLog`.
 */

/** An offer as the board shows it: a job not yet taken (no id). */
export type JobOffer = Omit<StationJob, 'id'>;

const SALT = 0x10b5;
const PORT_KINDS = new Set(['station', 'depot', 'den']);

const intIn = (r: { readonly min: number; readonly max: number }, u: number): number => r.min + Math.floor(u * (r.max - r.min + 1));

/** Stations of other ports within the delivery range, by hops, in id order. */
function destinations(sim: Sim, port: Port): { node: string; hops: number }[] {
  const out: { node: string; hops: number }[] = [];
  for (const [node, hops] of nodesWithin(sim, port.node, DELIVERY_HOPS.max)) {
    if (hops < DELIVERY_HOPS.min) continue;
    if (portsAt(sim, node).some((p) => PORT_KINDS.has(p.kind) && !isHostileTo(sim, p.owner))) out.push({ node, hops });
  }
  return out.sort((a, b) => (a.node < b.node ? -1 : 1));
}

const isHostileTo = (sim: Sim, faction: string): boolean => tierOf(sim, faction) === 'hostile';

function delivery(sim: Sim, port: Port, key: string, h: (salt: number) => number, turn: number): JobOffer | null {
  const dest = destinations(sim, port);
  if (!dest.length) return null;
  const d = dest[Math.floor(h(2) * dest.length)] as { node: string; hops: number };
  const items = DELIVERY_ITEMS.filter((i) => sim.content.items[i]);
  const item = items[Math.floor(h(3) * items.length)];
  if (!item) return null;
  const danger = nodeOf(sim, d.node)?.danger ?? 0;
  return {
    key, kind: 'delivery', issuer: port.owner, from: port.id, to: d.node, item, count: intIn(DELIVERY_COUNT, h(4)),
    reward: Math.round(DELIVERY_BASE + DELIVERY_PER_HOP * d.hops + DELIVERY_PER_DANGER * danger), due: turn + DELIVERY_TURNS_BASE + DELIVERY_TURNS_PER_HOP * d.hops,
  };
}

/** Factions the issuer would pay to see a ship of destroyed: at war with it, fielding armed groups and ships of their own. In id order. */
function enemies(sim: Sim, issuer: string): string[] {
  const fs = sim.content.galaxy?.factions ?? {};
  return Object.keys(fs).sort().filter((f) => {
    const groups = fs[f]?.fleet?.groups ?? {};
    return atWar(sim, issuer, f) && (groups.pirate || groups.raider || groups.patrol) && (fs[f]?.ships.length ?? 0) > 0;
  });
}

/** A bounty: one named ship of an enemy of the issuer, to be placed at a node BOUNTY_HOPS away that the player has never entered (so it is there when they arrive). */
function bounty(sim: Sim, port: Port, key: string, h: (salt: number) => number, turn: number): JobOffer | null {
  const foes = enemies(sim, port.owner);
  const nodes: { node: string; hops: number }[] = [];
  for (const [node, hops] of nodesWithin(sim, port.node, BOUNTY_HOPS.max)) if (hops >= BOUNTY_HOPS.min && !sim.galaxy.nodes[node]?.entered) nodes.push({ node, hops });
  if (!foes.length || !nodes.length) return null;
  nodes.sort((a, b) => (a.node < b.node ? -1 : 1));
  const at = nodes[Math.floor(h(6) * nodes.length)] as { node: string; hops: number };
  const faction = foes[Math.floor(h(7) * foes.length)] as string;
  const def = sim.content.galaxy?.factions[faction];
  const shipgen = pickWeighted(def?.ships ?? [], h(8));
  if (!def?.fleet || !shipgen) return null;
  const danger = nodeOf(sim, at.node)?.danger ?? 0;
  const name = shipNameFor(def.fleet.names, [strHash(key), 0xb0], usedNames(sim));
  return {
    key, kind: 'bounty', issuer: port.owner, from: port.id, node: at.node, target: name, targetFaction: faction, shipgen,
    seed: hash32(sim.seed, strHash(key), 0xb1) & 0x7fffffff, depth: Math.max(1, danger),
    reward: Math.round(BOUNTY_BASE + BOUNTY_PER_HOP * at.hops + BOUNTY_PER_DANGER * danger), due: turn + BOUNTY_TURNS_BASE + BOUNTY_TURNS_PER_HOP * at.hops,
  };
}

/** The offers of one port now: none from a faction hostile to the player. Each slot is a bounty half the time (when one can be placed), else a delivery. */
export function portOffers(sim: Sim, port: Port): JobOffer[] {
  if (!PORT_KINDS.has(port.kind) || isHostileTo(sim, port.owner)) return [];
  const g = sim.galaxy;
  const window = Math.floor(g.turn / OFFER_TURNS);
  const placed = new Set(g.jobs.flatMap((j) => (j.kind === 'bounty' && j.node ? [j.node] : [])));
  const out: JobOffer[] = [];
  for (let slot = 0; slot < OFFERS_PER_PORT; slot++) {
    const key = `${port.id}|${window}|${slot}`;
    if (g.jobLog.includes(key)) continue;
    const h = (salt: number): number => unit(sim.seed, strHash(port.id), window, slot, SALT, salt);
    const b = h(1) < 0.5 ? bounty(sim, port, key, h, g.turn) : null;
    // One bounty per node at a time.
    const o = b && !placed.has(b.node as string) ? b : delivery(sim, port, key, h, g.turn);
    if (!o) continue;
    if (o.kind === 'bounty') placed.add(o.node as string);
    out.push(o);
  }
  return out;
}

/** Every offer at the player's node. */
export const offersHere = (sim: Sim): JobOffer[] => portsAt(sim, sim.galaxy.current).flatMap((p) => portOffers(sim, p));
