import {
  DANGER_STEP, FTL_CHARGE_SEC, edgeBetween, ftlCharge, fuelStock, galaxyIndex, isHostileFaction, planStarRoute, playerShip,
  nodeOf, routeBlocker, routeCharge, sensorNodes, standings, visibleFleets, type Sim,
} from '../sim';
import type { UiStarExit, UiStarFleet, UiTravel, UiStarmap, UiStarNode, UiStarRoute } from '../ui/starmapApi';
import { toneOf } from './starmapTone';
import { ROLE_LABEL, encountersOf, eventOf, resultOf } from './encounterSnapshot';
import { nebulaAround } from './starmapNebula';
import { buildClusters, sectorOutline } from './starmapClusters';


/** The NPC fleets the sensors see, with where each is heading. */
function fleetsOf(sim: Sim, nodeName: (id: string) => string): UiStarFleet[] {
  const index = galaxyIndex(sim.galaxy);
  const content = sim.content.galaxy;
  return visibleFleets(sim).flatMap((f) => {
    const at = index.nodes.get(f.node);
    const next = f.route.length ? index.nodes.get(f.route[0] as string) : undefined;
    if (!at) return [];
    return [{
      id: f.id, node: f.node, x: Math.round(at.x), y: Math.round(at.y), tx: next ? Math.round(next.x) : null, ty: next ? Math.round(next.y) : null,
      faction: content?.factions[f.faction]?.name ?? f.faction, role: ROLE_LABEL[f.role] ?? f.role, ships: f.ships.length,
      tone: toneOf(content?.factions[f.faction]?.kind), hostile: isHostileFaction(sim, f.faction), damaged: !!f.damaged,
      heading: f.damaged ? 'Adrift' : f.route.length ? `Heading to ${nodeName(f.route[0] as string)}` : 'Resting',
    }];
  });
}

/** The trip in progress as the view draws it. */
function travelOf(sim: Sim): UiTravel | null {
  const t = sim.galaxy.travel;
  if (!t) return null;
  const next = t.phase === 'noFuel' ? edgeBetween(sim.galaxy, sim.galaxy.current, t.route[t.at + 1] as string) : undefined;
  const names = t.route.map((id) => (sim.galaxy.discovered[id] !== undefined ? nodeOf(sim, id)?.name : undefined) ?? 'Uncharted');
  return { route: [...t.route], at: t.at, phase: t.phase, stopping: !!t.stopping, need: next?.fuel ?? 0, names };
}

/** The fuel, charge and progress figures (cheap; refreshed often). */
export function starmapStatus(sim: Sim): Pick<UiStarmap, 'fuel' | 'charge' | 'chargeMax' | 'jumps' | 'turn' | 'state' | 'travel' | 'current' | 'ship' | 'credits' | 'encounters' | 'event' | 'result'> {
  return {
    ship: playerShip(sim), fuel: fuelStock(sim), charge: Math.floor(ftlCharge(sim) ?? 0), chargeMax: FTL_CHARGE_SEC,
    jumps: sim.galaxy.jumps, turn: sim.galaxy.turn, state: sim.sector.state, travel: travelOf(sim), current: sim.galaxy.current,
    credits: Math.floor(sim.trade.credits), encounters: encountersOf(sim), event: eventOf(sim), result: resultOf(sim),
  };
}

/** The whole generated starmap as the view draws it. Rebuilt only when `galaxy.rev` changes. */
export function buildStarmap(sim: Sim): UiStarmap {
  const g = sim.galaxy;
  const index = galaxyIndex(g);
  const content = sim.content.galaxy;
  const sensors = sensorNodes(sim);
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
    rev: g.rev, ...starmapStatus(sim), dangerStep: DANGER_STEP, sectors, nodes, fleets: fleetsOf(sim, (id) => (known(id) ? index.nodes.get(id)?.name : undefined) ?? 'uncharted space'), edges, factions,
    currentSector: here?.id ?? '', currentCluster: here?.cluster ?? null, exits, ...outer,
    nebula: here ? nebulaAround(sim, here.x, here.y) : [],
  };
}

const BLOCKERS: Record<string, string> = {
  noRoute: 'No route there.', noShip: 'Your ship cannot jump.', notCharged: 'The FTL drive is still charging (a pilot at the helm charges it).',
  noFuel: 'Not enough fuel for the first hop.',
};

/** The route preview to a node: the hops with their fuel and days, the charge to enter hyperspace, and whether it can go. */
export function planStarmapRoute(sim: Sim, to: string): UiStarRoute | null {
  const r = planStarRoute(sim.galaxy, sim.galaxy.current, to);
  if (!r || r.path.length < 2) return null;
  const status = starmapStatus(sim);
  const block = routeBlocker(sim, r.edges);
  const charge = routeCharge(r.edges);
  return {
    to, path: r.path, hops: r.path.length - 1, fuel: r.fuel, time: r.time,
    legs: r.edges.map((e, i) => ({ to: r.path[i + 1] as string, fuel: e.fuel, time: e.time, kind: e.kind, gate: !!e.gate })),
    nextCharge: charge, fuelOk: status.fuel >= r.fuel, chargeOk: charge <= status.charge + 1e-9,
    blocker: block ? BLOCKERS[block] ?? block : null,
  };
}

/** A starmap with nothing in it (rev -1): what the store holds until the screen is first built. */
export function emptyStarmap(): UiStarmap {
  return {
    rev: -1, current: '', ship: 0, fuel: 0, charge: 0, chargeMax: FTL_CHARGE_SEC, jumps: 0, turn: 0, state: 'active', travel: null, credits: 0, encounters: [], event: null, result: null, dangerStep: DANGER_STEP, sectors: [], nodes: [], fleets: [],
    edges: [], factions: [], currentSector: '', currentCluster: null, clusters: [], exits: [], sectorLinks: [], clusterLinks: [], nebula: [],
  };
}
