import {
  CombatC, DANGER_STEP, FTL_CHARGE_SEC, FUEL_ITEM, edgeBetween, galaxyIndex, isHostileFaction, jumpBlocker,
  planStarRoute, playerShip, playerStock, SENSOR_HOPS, standings, type Sim,
} from '../sim';
import type { UiStarExit, UiStarmap, UiStarNode, UiStarRoute } from '../ui/starmapApi';
import { toneOf } from './starmapTone';
import { nebulaAround } from './starmapNebula';
import { buildClusters, sectorOutline } from './starmapClusters';

/** Nodes within sensor range of the current node (contacts are only shown there). */
function inSensors(sim: Sim): Set<string> {
  const index = galaxyIndex(sim.galaxy);
  const out = new Set([sim.galaxy.current]);
  let frontier = [sim.galaxy.current];
  for (let h = 0; h < SENSOR_HOPS; h++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of index.adjacent.get(id) ?? []) {
        const o = e.a === id ? e.b : e.a;
        if (!out.has(o)) {
          out.add(o);
          next.push(o);
        }
      }
    }
    frontier = next;
  }
  return out;
}

/** The fuel, charge and progress figures (cheap; refreshed often). */
export function starmapStatus(sim: Sim): Pick<UiStarmap, 'fuel' | 'charge' | 'chargeMax' | 'jumps' | 'days' | 'current' | 'ship'> {
  const ship = playerShip(sim);
  const combat = sim.world.get(ship, CombatC);
  return {
    ship,
    fuel: playerStock(sim, FUEL_ITEM), charge: Math.floor(combat?.ftl ?? 0), chargeMax: FTL_CHARGE_SEC,
    jumps: sim.galaxy.jumps, days: sim.galaxy.days, current: sim.galaxy.current,
  };
}

/** The whole generated starmap as the view draws it. Rebuilt only when `galaxy.rev` changes. */
export function buildStarmap(sim: Sim): UiStarmap {
  const g = sim.galaxy;
  const index = galaxyIndex(g);
  const content = sim.content.galaxy;
  const sensors = inSensors(sim);
  const known = (id: string) => g.discovered[id] !== undefined;
  const nodes: UiStarNode[] = [];
  const knownSectors = new Set<string>();
  const reachable = new Set((index.adjacent.get(g.current) ?? []).map((e) => (e.a === g.current ? e.b : e.a)));
  for (const n of index.nodes.values()) {
    const k = known(n.id);
    if (k) knownSectors.add(n.sector);
    const contacts = sensors.has(n.id) ? (g.nodes[n.id]?.contacts ?? n.contacts) : [];
    const hostiles = contacts.filter((c) => isHostileFaction(sim, c.faction)).length;
    nodes.push({
      id: n.id, sector: n.sector, x: Math.round(n.x), y: Math.round(n.y), name: n.name, known: k,
      visited: g.visited[n.id] !== undefined, current: n.id === g.current, danger: n.danger, faction: n.faction,
      badges: k ? n.structures.map((s) => content?.structures[s.def]?.badge ?? '?') : [],
      structures: k ? n.structures.map((s) => content?.structures[s.def]?.name ?? s.def) : [],
      resources: k ? n.resources.map((r) => sim.content.items[r]?.name ?? r) : [],
      hostiles, others: contacts.length - hostiles, reachable: reachable.has(n.id),
    });
  }
  const sectors = [...index.sectors.values()].map((s) => {
    const k = knownSectors.has(s.id);
    return {
      id: s.id, name: s.name, x: Math.round(s.x), y: Math.round(s.y), faction: k ? s.faction : null, danger: s.danger, known: k,
      top: Math.round(Math.min(...s.hull.map((p) => p.y))), r: Math.round(s.r),
      tone: k && s.faction ? toneOf(content?.factions[s.faction]?.kind) : 'dim',
      outline: sectorOutline(index, s), body: s.body ?? null, cluster: s.cluster ?? null, hub: !!s.hub, nodes: s.nodes.length,
    };
  });
  const edges = [...index.edges.values()].filter((e) => known(e.a) && known(e.b)).map((e) => {
    const a = index.nodes.get(e.a);
    const b = index.nodes.get(e.b);
    return { id: e.id, kind: e.kind, ax: Math.round(a?.x ?? 0), ay: Math.round(a?.y ?? 0), bx: Math.round(b?.x ?? 0), by: Math.round(b?.y ?? 0), anchor: !!e.anchor, gate: !!e.gate, rift: !!e.rift };
  });
  const factions = standings(sim).map((s) => ({
    id: s.faction, name: content?.factions[s.faction]?.name ?? s.faction, tone: toneOf(content?.factions[s.faction]?.kind),
    tier: s.tier, standing: s.value,
  }));
  const here = index.sectors.get(index.nodes.get(g.current)?.sector ?? '');
  const outer = buildClusters(index, content, (id) => knownSectors.has(id), here);
  // Exits: every hyperlane from a node of the player's sector to another sector.
  const exits: UiStarExit[] = [];
  for (const id of here?.nodes ?? []) {
    for (const e of index.adjacent.get(id) ?? []) {
      if (e.kind !== 'hyperlane') continue;
      const a = index.nodes.get(id)!;
      const b = index.nodes.get(e.a === id ? e.b : e.a);
      const to = b && index.sectors.get(b.sector);
      if (!b || !to || to.id === here?.id) continue;
      const k = knownSectors.has(to.id);
      exits.push({
        id: e.id, ax: Math.round(a.x), ay: Math.round(a.y), bx: Math.round(b.x), by: Math.round(b.y), to: to.id,
        name: k ? to.name : null, tone: k && to.faction ? toneOf(content?.factions[to.faction]?.kind) : 'dim', danger: to.danger,
        kind: e.rift ? 'rift' : e.gate ? 'gate' : 'lane', fuel: e.fuel,
      });
    }
  }
  return {
    rev: g.rev, ...starmapStatus(sim), dangerStep: DANGER_STEP, sectors, nodes, edges, factions,
    currentSector: here?.id ?? '', currentCluster: here?.cluster ?? null, exits, ...outer,
    nebula: here ? nebulaAround(sim, here.x, here.y) : [],
  };
}

const BLOCKERS: Record<string, string> = {
  noRoute: 'No route there.', noShip: 'Your ship cannot jump.', notCharged: 'The FTL drive is still charging (a pilot at the helm charges it).',
  noFuel: 'Not enough fuel for the next jump.',
};

/** The route preview to a node: path, total fuel and time, next jump's charge, and whether it can go. */
export function planStarmapRoute(sim: Sim, to: string): UiStarRoute | null {
  const r = planStarRoute(sim.galaxy, sim.galaxy.current, to);
  if (!r || r.path.length < 2) return null;
  const status = starmapStatus(sim);
  const first = edgeBetween(sim.galaxy, r.path[0] as string, r.path[1] as string);
  const block = jumpBlocker(sim, first);
  return {
    to, path: r.path, hops: r.path.length - 1, fuel: r.fuel, time: r.time, nextCharge: first?.charge ?? 0,
    fuelOk: status.fuel >= r.fuel, chargeOk: (first?.charge ?? Infinity) <= status.charge + 1e-9,
    blocker: block ? BLOCKERS[block] ?? block : null,
  };
}

/** A starmap with nothing in it (rev -1): what the store holds until the screen is first built. */
export function emptyStarmap(): UiStarmap {
  return {
    rev: -1, current: '', ship: 0, fuel: 0, charge: 0, chargeMax: FTL_CHARGE_SEC, jumps: 0, days: 0, dangerStep: DANGER_STEP, sectors: [], nodes: [],
    edges: [], factions: [], currentSector: '', currentCluster: null, clusters: [], exits: [], sectorLinks: [], clusterLinks: [], nebula: [],
  };
}
