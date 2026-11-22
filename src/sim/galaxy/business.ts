import { AsteroidC } from '../asteroids/components';
import { ShipC } from '../combat/components';
import type { Sim } from '../sim';
import { isStation } from '../trade/stationDock';
import { TraderC } from '../trade/types';
import { dockPort } from './dock';
import { portsAt } from './portIndex';
import type { Fleet } from './types';

/** Where NPC ships' business is in the player's node (#603): apart from fleetShips.ts and traffic.ts, which both ask. */

/** The asteroid field NPC miners in the player's node work: the node's first. Placement (`businessAnchor`) and the pods' orders share it. */
export function minersField(sim: Sim): number | undefined {
  return [...sim.world.query(AsteroidC)].sort((a, b) => a - b)[0];
}

/**
 * The station a trader fleet calls at in `node`: the port its descriptor trade docks at (`dockPort`), else (no port of the node in play: a station
 * set down by a scene) the node's first trading station. Undefined when there is none.
 */
export function callingStation(sim: Sim, f: Fleet, node: string): number | undefined {
  if (f.role !== 'trader') return undefined;
  const stations = sim.world.query(TraderC, ShipC).filter((id) => isStation(sim, id)).sort((a, b) => a - b);
  const port = dockPort(portsAt(sim, node), f.role);
  return stations.find((id) => port && sim.world.get(id, TraderC)?.port === port.id) ?? stations[0];
}
