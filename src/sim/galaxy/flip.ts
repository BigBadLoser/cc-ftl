import type { Sim } from '../sim';
import { headHome } from './agenda';
import { controlOf, tidyControl } from './control';
import { nodesWithin } from './graph';
import { owe, portsAt } from './portIndex';
import { portNode, type Port } from './ports';
import { report } from './news';
import { rosterOrders } from './roster';
import { galaxyIndex } from './state';
import { FLEET_AREA_HOPS } from './tuning';
import { REHOME_HOPS } from './tuningCoarse';
import type { Fleet } from './types';

/**
 * A sector changes hands (the coarse tick, coarse.ts). Its stations follow (`structureOwner`), and the handover reaches the fine tier through the paths
 * that already exist:
 * - the old owner's fleets homed at a port that changed owner go home to another port of theirs (in the fleet area), or are disbanded (frozen far away);
 * - the port forgets what the old owner owed and its market resets to the new owner's baseline;
 * - the port owes its new owner's roster (`PortState.queue`, built by rebuild.ts), so fleets appear as they are built: no snap, no spawn.
 * Stations already made real (a populated node) keep their look until the player next sees them (slice 2 of #604).
 */

/** Another port of the fleet's faction near `from` that can host it (not one of `not`), nearest first; null when there is none within REHOME_HOPS. */
function newHome(sim: Sim, f: Fleet, from: string, not: ReadonlySet<string>): Port | null {
  for (const id of nodesWithin(sim, from, REHOME_HOPS).keys()) {
    const port = portsAt(sim, id).find((p) => p.owner === f.faction && !not.has(p.id) && (p.role === null || p.role === f.role));
    if (port) return port;
  }
  return null;
}

/** Change the owner of a sector at `turn`: control, ports, fleets, markets. */
export function flipSector(sim: Sim, sectorId: string, to: string, turn: number): void {
  const g = sim.galaxy;
  const sector = galaxyIndex(g).sectors.get(sectorId);
  if (!sector || !sim.content.galaxy) return;
  const portsOfSector = (): Map<string, Port> => new Map(sector.nodes.flatMap((id) => portsAt(sim, id)).map((p) => [p.id, p]));
  const before = portsOfSector();
  const c = controlOf(sim, sectorId);
  c.owner = to;
  c.since = turn;
  delete c.pressure;
  tidyControl(sim, sectorId);
  g.rev++;
  const after = portsOfSector();
  const changed = new Set([
    ...[...before.values()].filter((p) => after.get(p.id)?.owner !== p.owner),
    ...[...after.values()].filter((p) => before.get(p.id)?.owner !== p.owner),
  ].map((p) => p.id));
  const area = nodesWithin(sim, g.current, FLEET_AREA_HOPS);
  g.fleets = g.fleets.filter((f) => {
    const old = before.get(f.home);
    if (!old || !changed.has(old.id) || f.faction !== old.owner) return true;
    // A fleet with real ships in the player's node only changes its home; the rest go home (in the area) or are disbanded (frozen).
    const live = f.ships.some((s) => s.ship !== undefined);
    const home = area.has(f.node) || live ? newHome(sim, f, portNode(f.home), changed) : null;
    if (!home) return live;
    f.home = home.id;
    if (!live) headHome(sim, f);
    return true;
  });
  for (const id of changed) {
    delete g.ports[id];
    delete g.markets[id];
    const port = after.get(id);
    const node = port && galaxyIndex(g).nodes.get(port.node);
    if (!port || !node) continue;
    for (const o of rosterOrders(sim, port, node.danger, turn)) owe(sim, id, o.faction, o.role, o.size, turn);
  }
}

/** The news line of a flip: the sector, who took it and from whom. */
export function reportFell(sim: Sim, sectorId: string, to: string, from: string | null, turn: number): void {
  const sector = galaxyIndex(sim.galaxy).sectors.get(sectorId);
  if (!sector) return;
  report(sim, { kind: 'fell', node: sector.nodes[0] as string, who: sector.name, faction: to, ...(from ? { foeFaction: from } : {}) }, turn);
}
