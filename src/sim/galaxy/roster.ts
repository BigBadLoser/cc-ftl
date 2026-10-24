import { hullChoices, previewHull } from '../shipgen';
import type { Sim } from '../sim';
import type { FleetGroupDef, FleetRole, GalaxyFactionDef, ShipSize, Weighted } from './defs';
import { hash32, strHash, unit } from './hash';
import { shipNameFor } from './names';
import { portsOf, type Port } from './ports';
import { pickWeighted } from './sector';
import { FLEET_START_REST, SEED_TRIES, TRADE_GUESTS } from './tuning';
import type { ChunkData, Contact, Fleet } from './types';

/**
 * Rosters (user decisions 2026-10-22: a living world). When a chunk is generated, each port in it gets its fleets (`populate`), deterministically
 * from the world seed and the port: the port's kind and size set how many groups it fields (`PortKindDef.groups`), the owner's `FleetGroupDef`
 * for the role sets each group's size budget, and the generator's hull families give the ships (`FleetContent.classes`: family -> size class).
 * A slot asks for a size, and a generator seed is searched whose first attempt builds a family of that size (`previewHull`), so a "heavy" ship really
 * is a cruiser. Ships only become real in the player's node (fleetShips.ts); here they are descriptors with a name. Replacements for lost ships
 * come from `makeFleet` too (rebuild.ts).
 */
const SIZES: readonly ShipSize[] = ['small', 'medium', 'heavy'];

interface Candidate {
  shipgen: string;
  family: string;
}
type Table = Record<ShipSize, Weighted<Candidate>[]>;

/** The hull families that can fly as `role` for the owner at this depth, by size class, weighted by the owner's generator pool and the family's depth weight. */
function tableFor(sim: Sim, owner: GalaxyFactionDef, role: FleetRole, depth: number): Table {
  const out: Table = { small: [], medium: [], heavy: [] };
  const fleet = sim.content.galaxy?.fleet;
  for (const pool of owner.ships) {
    const gen = sim.content.factions?.[pool.value];
    const classes = fleet?.classes[pool.value];
    if (!gen || !classes) continue;
    for (const c of hullChoices(gen, depth)) {
      const cls = classes[c.value.id];
      if (!cls || c.weight <= 0 || (cls.roles && !cls.roles.includes(role))) continue;
      out[cls.size].push({ value: { shipgen: pool.value, family: c.value.id }, weight: pool.weight * c.weight });
    }
  }
  return out;
}

/** The sizes of a group's ships: a drawn budget spent on sizes that exist for this role and depth (see `FleetGroupDef`); at least one ship. */
function groupSizes(sim: Sim, group: FleetGroupDef, table: Table, h: (salt: number) => number): ShipSize[] {
  const cost = (sim.content.galaxy as NonNullable<typeof sim.content.galaxy>).fleet.sizeCost;
  const sizes = group.sizes.filter((w) => table[w.value].length > 0);
  if (!sizes.length) return [];
  let left = pickWeighted(group.budget, h(1)) ?? 0;
  const out: ShipSize[] = [];
  while (out.length < group.maxShips) {
    const fit = sizes.filter((w) => cost[w.value] <= left);
    const next = fit.length ? pickWeighted(fit, h(2 + out.length)) : null;
    if (!next) break;
    out.push(next);
    left -= cost[next];
  }
  if (!out.length) out.push(sizes.reduce((a, b) => (cost[b.value] < cost[a.value] ? b : a)).value);
  return out;
}

/**
 * Whose ships a roster slot at the port is, and in which role: the port's fixed role for the owner, else (a station) the owner's groups by weight -
 * at a market, plus the free traders' trader group at TRADE_GUESTS - drawn with `u`. Null when there is no one.
 */
function whoFor(sim: Sim, port: Port, u: number): { faction: string; role: FleetRole } | null {
  const factions = sim.content.galaxy?.factions ?? {};
  const own = factions[port.owner]?.fleet?.groups ?? {};
  if (port.role) return own[port.role] ? { faction: port.owner, role: port.role } : null;
  const pool: Weighted<{ faction: string; role: FleetRole }>[] = (Object.keys(own) as FleetRole[]).sort().map((role) => ({
    value: { faction: port.owner, role }, weight: (own[role] as FleetGroupDef).weight,
  }));
  const guest = Object.keys(factions).sort().find((id) => id !== port.owner && factions[id]?.kind === 'civilian' && factions[id]?.fleet?.groups.trader);
  if (port.trade && guest && !own.trader) pool.push({ value: { faction: guest, role: 'trader' }, weight: TRADE_GUESTS });
  return pickWeighted(pool, u);
}

/** One ship of `size` from the table: a candidate family, a seed that builds it, a unique name. */
function makeShip(sim: Sim, owner: GalaxyFactionDef, ownerId: string, table: Table, size: ShipSize, depth: number, key: readonly number[], used: Set<string>): Contact | null {
  const cand = pickWeighted(table[size], unit(...key, 3));
  const gen = cand ? sim.content.factions?.[cand.shipgen] : undefined;
  if (!cand || !gen) return null;
  let seed = hash32(sim.seed, ...key, 4, 0) & 0x7fffffff;
  for (let k = 0; k < SEED_TRIES; k++) {
    const s = hash32(sim.seed, ...key, 4, k) & 0x7fffffff;
    if (previewHull(gen, s, depth) !== cand.family) continue;
    seed = s;
    break;
  }
  const name = shipNameFor((owner.fleet as NonNullable<typeof owner.fleet>).names, key, used);
  return { id: sim.galaxy.nextFleet++, faction: ownerId, shipgen: cand.shipgen, seed, depth, since: 0, name, size };
}

/** Names in use by living fleet ships (so new ships take unused ones). */
export const usedNames = (sim: Sim): Set<string> => new Set(sim.galaxy.fleets.flatMap((f) => f.ships.flatMap((c) => (c.name ? [c.name] : []))));

/**
 * A new fleet for a port, resting at its node: `key` makes it unique. `want` asks for one ship of a role and size (a replacement); otherwise the role
 * is the port's (or drawn from the owner's group weights) and the group is drawn from the budget. Null when the owner has no ship that fits.
 */
export function makeFleet(
  sim: Sim, port: Port, depth: number, key: readonly number[], used: Set<string>, turn: number, want?: { faction: string; role: FleetRole; size: ShipSize },
): Fleet | null {
  const h = (salt: number): number => unit(sim.seed, ...key, salt);
  const pick = want ?? whoFor(sim, port, h(1));
  const owner = pick ? sim.content.galaxy?.factions[pick.faction] : undefined;
  const group = pick ? owner?.fleet?.groups[pick.role] : undefined;
  if (!pick || !owner || !group) return null;
  const role = pick.role;
  const table = tableFor(sim, owner, role, depth);
  let sizes: ShipSize[];
  if (want) {
    const near = [want.size, ...SIZES.filter((s) => s !== want.size)].find((s) => table[s].length > 0);
    sizes = near ? [near] : [];
  } else {
    sizes = groupSizes(sim, group, table, (salt) => h(10 + salt));
  }
  const ships: Contact[] = [];
  sizes.forEach((size, i) => {
    const c = makeShip(sim, owner, pick.faction, table, size, depth, [...key, i], used);
    if (c) ships.push(c);
  });
  if (!ships.length) return null;
  return {
    id: sim.galaxy.nextFleet++, faction: pick.faction, role, ships, home: port.id, node: port.node, from: port.node, moved: -1, route: [], dest: port.node,
    dwell: 0, legs: 0, synced: turn,
  };
}

/**
 * A hunter fleet (hunters.ts) for the owner's armed `role` at a port: the owner's group for the role with its budget and ship count replaced, so the ships
 * are the faction's usual hulls for this depth, only more of them. Null when the owner fields no such group or no ship fits.
 */
export function makeHunters(
  sim: Sim, port: Port, faction: string, role: FleetRole, depth: number, key: readonly number[], budget: number, maxShips: number, turn: number,
): Fleet | null {
  const owner = sim.content.galaxy?.factions[faction];
  const base = owner?.fleet?.groups[role];
  if (!owner || !base) return null;
  const table = tableFor(sim, owner, role, depth);
  const h = (salt: number): number => unit(sim.seed, ...key, salt);
  const sizes = groupSizes(sim, { ...base, budget: [{ value: budget, weight: 1 }], maxShips }, table, (salt) => h(10 + salt));
  const used = usedNames(sim);
  const ships: Contact[] = [];
  sizes.forEach((size, i) => {
    const c = makeShip(sim, owner, faction, table, size, depth, [...key, i], used);
    if (c) ships.push(c);
  });
  if (!ships.length) return null;
  return {
    id: sim.galaxy.nextFleet++, faction, role, ships, home: port.id, node: port.node, from: port.node, moved: -1, route: [], dest: port.node,
    dwell: 0, legs: 0, synced: turn,
  };
}

/** A node of the same chunk next to `node` (for a fleet that should arrive rather than already be there). */
function neighbour(chunk: ChunkData, node: string): string | null {
  const ids = new Set(chunk.nodes.map((n) => n.id));
  const edge = chunk.edges.filter((e) => (e.a === node || e.b === node) && ids.has(e.a) && ids.has(e.b)).sort((p, q) => (p.id < q.id ? -1 : 1))[0];
  return edge ? (edge.a === node ? edge.b : edge.a) : null;
}

/**
 * Create the fleets of a freshly generated chunk. They rest at their home ports for a hashed number of turns, so departures are staggered.
 * Nothing is created in the player's own node: a port there starts with its fleets one hop out and coming home (nothing materialises around a new game).
 */
export function populate(sim: Sim, chunk: ChunkData): void {
  const content = sim.content.galaxy;
  if (!content) return;
  const g = sim.galaxy;
  const hubs = new Set(chunk.sectors.filter((s) => s.hub).map((s) => s.id));
  const used = usedNames(sim);
  for (const node of [...chunk.nodes].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    for (const port of portsOf(sim.seed, content, node, hubs.has(node.sector))) {
      const count = content.fleet.ports[port.kind].groups[port.size - 1] as number;
      for (let slot = 0; slot < count; slot++) {
        const key = [strHash(port.id), slot];
        const f = makeFleet(sim, port, node.danger, key, used, g.turn);
        if (!f) continue;
        f.dwell = Math.floor(unit(sim.seed, ...key, 5) * (FLEET_START_REST + 1));
        const out = node.id === g.current ? neighbour(chunk, node.id) : null;
        if (out) Object.assign(f, { node: out, from: out, route: [node.id], dest: node.id, dwell: 0 });
        g.fleets.push(f);
      }
    }
  }
}
