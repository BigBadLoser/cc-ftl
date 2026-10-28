import { CrewC, ModuleC, PositionC, roomTiles, Struct, homeShip, type Command, type Sim } from '../sim';
import { shipGrid } from '../sim/regions';

/**
 * `?scenario=damage`: playtest damage control. Three burning tiles in one room, a hole in the hull of another, and the reactor
 * badly damaged. Everything is set through debug commands; the caller pauses the game so the first look is the untouched scene.
 */
export function damageScenarioCommands(sim: Sim): Command[] {
  const ship = homeShip(sim);
  const grid = shipGrid(sim, ship);
  if (!grid) return [];
  const out: Command[] = [];
  // Nobody answers on their own (firefighting, repair and construction off), so the damage waits for an order.
  for (const id of sim.world.query(CrewC)) for (const category of ['firefighting', 'repair', 'construction'] as const) out.push({ type: 'crew.setPriority', id, category, value: 0 });
  const crew = sim.world.query(CrewC).flatMap((id) => { const p = sim.world.get(id, PositionC); return p ? [p] : []; });
  const dist = (x: number, y: number): number => Math.min(...crew.map((p) => Math.abs(p.x - x) + Math.abs(p.y - y)), 99);
  const rooms = [...roomTiles(grid).entries()].sort((a, b) => b[1].length - a[1].length);
  const at = (i: number): { x: number; y: number } => ({ x: grid.x0 + (i % grid.width), y: grid.y0 + Math.floor(i / grid.width) });

  // Fire: the biggest room, two floor tiles far from the crew.
  const [fireRoom, ...rest] = rooms;
  if (fireRoom) {
    const floor = fireRoom[1].map(at).filter((t) => grid.get('struct', t.x, t.y) === Struct.Floor && !grid.get('module', t.x, t.y));
    floor.sort((a, b) => dist(b.x, b.y) - dist(a.x, a.y));
    for (const t of floor.slice(0, 3)) out.push({ type: 'debug.ignite', ship, x: t.x, y: t.y });
  }
  // Breach: a hull wall of another room (the biggest first) with open space, or the edge of the grid, straight behind it.
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (const [, tiles] of rest) {
    const wall = tiles.map(at).flatMap((t) => dirs.map(([dx, dy]) => ({ x: t.x + dx, y: t.y + dy, bx: t.x + 2 * dx, by: t.y + 2 * dy })))
      .find((n) => grid.inBounds(n.x, n.y) && grid.get('struct', n.x, n.y) === Struct.Wall && !grid.get('module', n.x, n.y) && (!grid.inBounds(n.bx, n.by) || grid.get('struct', n.bx, n.by) === Struct.Space));
    if (wall) {
      out.push({ type: 'debug.setStruct', ship, x: wall.x, y: wall.y, kind: Struct.Space });
      break;
    }
  }
  // The reactor (the module that supplies the most power) is down to a third.
  let reactor = 0;
  let best = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const p = m ? sim.content.modules[m.def]?.power ?? 0 : 0;
    if (p > best) { best = p; reactor = id; }
  }
  const rm = sim.world.get(reactor, ModuleC);
  if (rm) out.push({ type: 'debug.setModuleHp', id: reactor, hp: Math.round((sim.content.modules[rm.def]?.maxHp ?? 100) / 3) });
  return out;
}
