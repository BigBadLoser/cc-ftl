import type { Sim } from '../sim';
import { catchUp } from './agenda';
import { materialiseFleet } from './fleetShips';
import { strHash, unit } from './hash';
import { portOf } from './portIndex';
import { portNode } from './ports';
import { fleetName } from './names';
import { report } from './news';
import { makeFleet, usedNames } from './roster';
import { nodeOf } from './state';
import { FLEET_REST } from './tuning';

/**
 * Port rebuilds. A port that lost ships owes replacements (`GalaxyState.ports`): one ship every `PortKindDef.rebuildTurns` turns, starting
 * that long after the first loss. A replacement is a fresh single-ship fleet of the lost ship's role and size, resting at the port, created at the
 * turn it was due (so its own timeline does not depend on when the port was looked at). Only ports in the simulated area are processed; one
 * that was frozen builds everything that fell due in the meantime when the player comes near (exact, since each build only depends on its turn).
 */
export function rebuildPorts(sim: Sim, turn: number, area: ReadonlyMap<string, number>): void {
  const g = sim.galaxy;
  const content = sim.content.galaxy;
  if (!content) return;
  let used: Set<string> | null = null;
  for (const id of Object.keys(g.ports).sort()) {
    const st = g.ports[id];
    const node = nodeOf(sim, portNode(id));
    const port = portOf(sim, id);
    if (!st || !node || !area.has(node.id)) continue;
    while (st.queue.length && st.next <= turn) {
      const want = st.queue.shift() as (typeof st.queue)[number];
      const at = st.next;
      const key = [strHash(id), 1000 + st.built];
      const f = port ? makeFleet(sim, port, node.danger, key, (used ??= usedNames(sim)), at, want) : null;
      if (f) {
        f.dwell = Math.floor(unit(sim.seed, ...key, 5) * (FLEET_REST.max + 1));
        g.fleets.push(f);
        report(sim, { kind: 'rebuilt', node: node.id, who: fleetName(f), faction: f.faction }, at);
        catchUp(sim, f, turn);
        if (sim.sector.state === 'active' && f.node === g.current) materialiseFleet(sim, f);
      }
      st.built++;
      st.next = at + (port ? content.fleet.ports[port.kind].rebuildTurns : 1);
    }
    if (!st.queue.length) delete g.ports[id];
    g.rev++;
  }
}
