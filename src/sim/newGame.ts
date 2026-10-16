import { CrewC, NeedsC, PathC, PositionC, PrioritiesC } from './crew/components';
import type { ContentRegistry } from './registry';
import { Sim } from './sim';
import { gridFromTemplate } from './ship';
import { Struct } from './structure';

const STARTER_ROLES = ['role.engineer', 'role.engineer', 'role.gunner', 'role.medic'];

/** Create a fresh game: a Sim with the chosen ship as grid 1 and a starting crew. */
export function newGame(seed: number, content: ContentRegistry, shipId = 'ship.starter'): Sim {
  const template = content.ships[shipId];
  if (!template) throw new Error(`Unknown ship "${shipId}"`);
  const sim = new Sim(seed, content);
  const grid = gridFromTemplate(1, template);
  sim.grids.set(1, grid);

  const floor: { x: number; y: number }[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) if (grid.get('struct', x, y) === Struct.Floor) floor.push({ x, y });
  }
  const names = [...content.crewNames];
  for (const roleId of STARTER_ROLES) {
    const role = content.roles[roleId];
    if (!role || names.length === 0 || floor.length === 0) continue;
    const tile = floor.splice(sim.rng.int(0, floor.length - 1), 1)[0] as { x: number; y: number };
    const name = names.splice(sim.rng.int(0, names.length - 1), 1)[0] as string;
    const id = sim.world.createEntity();
    sim.world.add(id, CrewC, {
      name, role: roleId, species: 'species.human', appearanceSeed: sim.rng.int(0, 0x7fffffff), activity: 'idle',
    });
    sim.world.add(id, PositionC, { gridId: 1, x: tile.x, y: tile.y, toX: tile.x, toY: tile.y, progress: 0, facing: 0 });
    sim.world.add(id, PathC, { steps: [] });
    sim.world.add(id, PrioritiesC, { ...role.priorities });
    sim.world.add(id, NeedsC, { rest: sim.rng.int(60, 100) });
  }
  return sim;
}
