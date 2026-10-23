import type { Sim } from '../sim';
import type { FleetRole, ShipSize } from './defs';
import { portNode, portsOf, type Port } from './ports';
import { galaxyIndex, nodeOf } from './state';
import type { PortState } from './types';

/** The ports at a node of the map (derived from its structures, see ports.ts). */
export function portsAt(sim: Sim, id: string): Port[] {
  const content = sim.content.galaxy;
  const node = nodeOf(sim, id);
  if (!content || !node) return [];
  return portsOf(sim.seed, content, node, !!galaxyIndex(sim.galaxy).sectors.get(node.sector)?.hub);
}

/** A port by id, or undefined. */
export const portOf = (sim: Sim, id: string): Port | undefined => portsAt(sim, portNode(id)).find((p) => p.id === id);

/** A ship of the port was destroyed at `turn`: the port owes a replacement (the first one starts its build time now). */
export function owe(sim: Sim, id: string, faction: string, role: FleetRole, size: ShipSize, turn: number): void {
  const port = portOf(sim, id);
  const st: PortState = (sim.galaxy.ports[id] ??= { queue: [], next: 0, built: 0 });
  if (!st.queue.length) st.next = turn + (port ? (sim.content.galaxy?.fleet.ports[port.kind].rebuildTurns ?? 0) : 0);
  st.queue.push({ faction, role, size });
  sim.galaxy.rev++;
}
