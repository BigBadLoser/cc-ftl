import { describe, expect, it } from 'vitest';
import { JobC, storageCount, ModuleC, VehicleBayC, VehicleC, homeShip, newGame, placementError, shipGrid, storageAdd, StorageC, type Sim } from '../../sim';
import { content } from '../index';

describe('pod bay with its pod', () => {
  it('crew build a pod bay from the build menu and it comes with a mining pod', () => {
    const sim: Sim = newGame(4, content);
    const ship = homeShip(sim);
    const g = shipGrid(sim, ship)!;
    // enough material in the first crate
    const crate = [...sim.world.query(StorageC)].sort((a, b) => a - b)[0]!;
    for (const q of content.modules['module.pod_bay'].cost) storageAdd(sim, crate, q.item, q.count);
    let at: { x: number; y: number } | null = null;
    for (let y = g.y0 + g.height - 1; y >= g.y0 && !at; y--) for (let x = g.x0 + g.width - 1; x >= g.x0 && !at; x--) if (!placementError(sim, ship, 'module.pod_bay', x, y, 0)) at = { x, y };
    sim.enqueue({ type: 'job.buildModule', ship, def: 'module.pod_bay', x: at!.x, y: at!.y, rot: 0 });
    let bay = 0;
    for (let i = 0; i < 5 * 60 * 20 && !bay; i++) {
      sim.step();
      sim.events.drain();
      bay = [...sim.world.query(VehicleBayC)].find((id) => sim.world.get(id, ModuleC)?.def === 'module.pod_bay') ?? 0;
    }
    const jobs = [...sim.world.query(JobC)].map((j) => sim.world.get(j, JobC)).filter((j) => j?.kind === "module");
    expect(bay, JSON.stringify({ at, jobs, added: content.modules["module.pod_bay"].cost.map((q) => storageCount(sim, crate, q.item)) })).not.toBe(0);
    const pod = sim.world.get(bay, VehicleBayC)!.vehicle;
    expect(sim.world.get(pod, VehicleC)).toMatchObject({ def: 'vehicle.mining_pod', state: 'stowed', home: bay });
  });
});
