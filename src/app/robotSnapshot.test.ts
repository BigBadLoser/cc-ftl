import { describe, expect, it } from 'vitest';
import { ModuleC, newGame, openTilesOf, PLAYER_START, type Sim } from '../sim';
import { cradleOf } from '../sim/robots/bay';
import { content } from '../content';
import { buildRobotBay } from './robotSnapshot';

const run = (sim: Sim, n: number) => {
  for (let i = 0; i < n; i++) sim.step();
  sim.events.drain();
};
/** Place a bay at starter-ship tile (x, y) (the ship is stamped at PLAYER_START). */
const place = (sim: Sim, x: number, y: number, rot: number): number => {
  sim.enqueue({ type: 'debug.spawnModule', gridId: 1, x: PLAYER_START.x + x, y: PLAYER_START.y + y, def: 'module.robotBay', rot });
  run(sim, 2);
  return sim.world.query(ModuleC).find((i) => {
    const m = sim.world.get(i, ModuleC)!;
    return m.def === 'module.robotBay' && m.x === PLAYER_START.x + x && m.y === PLAYER_START.y + y;
  })!;
};

describe('robot bay snapshot', () => {
  it('offers the three robot types, then shows the assembly under way', () => {
    const sim = newGame(7, content);
    run(sim, 2);
    const bay = place(sim, 13, 6, 0);
    const empty = buildRobotBay(sim, bay)!;
    expect(empty.occupant).toBeNull();
    expect(empty.assembling).toBeNull();
    expect(empty.options.map((o) => o.role).sort()).toEqual(['role.robot_repair', 'role.robot_security', 'role.robot_worker']);
    expect(empty.options[0]!.cost.length).toBe(3);
    sim.enqueue({ type: 'module.assembleRobot', moduleId: bay, role: 'role.robot_worker' });
    run(sim, 2);
    expect(buildRobotBay(sim, bay)!.assembling?.role).toBe('role.robot_worker');
    sim.enqueue({ type: 'module.cancelAssembly', moduleId: bay });
    run(sim, 2);
    expect(buildRobotBay(sim, bay)!.assembling).toBeNull();
  });

  it('the cradle is the open tile of the rotated footprint', () => {
    const sim = newGame(7, content);
    run(sim, 2);
    const bay = place(sim, 13, 6, 0);
    const m = sim.world.get(bay, ModuleC)!;
    const def = content.modules['module.robotBay'];
    expect(cradleOf(sim, bay)).toEqual(openTilesOf(def, m.x, m.y, m.rot)[0]);
    expect(cradleOf(sim, bay)).toEqual({ x: PLAYER_START.x + 13, y: PLAYER_START.y + 6 });
    m.rot = 2; // rotated half a turn: the cradle moves to the other end of the 1x2
    expect(cradleOf(sim, bay)).toEqual({ x: PLAYER_START.x + 13, y: PLAYER_START.y + 7 });
  });
});
