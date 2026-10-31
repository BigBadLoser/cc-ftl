import { content } from '../../src/content';
import { deserialize, shipGrid } from '../../src/sim';
import { JobC, CrewC, PositionC, AssignmentC } from '../../src/sim/crew/components';
import { shipIdOf } from '../../src/sim/regions';
export function dump2(json: string): unknown {
  const sim = deserialize(json, content);
  const ships = sim.world.query(ShipCx()).map((id) => { const g = shipGrid(sim, id); return { id, w: g?.width, h: g?.height }; });
  const jobs = sim.world.query(JobC).map((id) => { const j = sim.world.get(id, JobC)!; return { id, kind: j.kind, cat: j.category, x: j.x, y: j.y, ship: shipIdOf(sim, j), res: j.reservedBy }; });
  const crew = sim.world.query(CrewC).map((id) => ({ id, ship: shipIdOf(sim, sim.world.get(id, PositionC)!), act: sim.world.get(id, CrewC)!.activity, a: !!sim.world.has(id, AssignmentC) }));
  return { ships, jobs, crew };
}
import { ShipC } from '../../src/sim';
function ShipCx() { return ShipC; }
