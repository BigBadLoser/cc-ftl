import { describe, expect, it } from 'vitest';
import { InspectionC, inspections } from '../sim/inspect/types';
import { MiningPodC } from '../sim/mining/components';
import type { Sim } from '../sim/sim';
import { cargoCount } from '../sim/vehicles/cargo';
import { VehicleC } from '../sim/vehicles/components';
import { run, runLog } from '../../test/support/run';
import { cachedScenario } from '../../test/support/scenario';

/**
 * NPC traffic in the player's node (#603), the long runs: a patrol's inspection of an NPC ship searches it and settles by itself, and an NPC miner's
 * pod mines a trip, its crew unload it and the order ends. The cheap guards are in nodeTraffic.test.ts.
 */
describe('NPC traffic in the player\'s node, long runs', () => {
  it('a patrol\'s inspection of an NPC ship searches it, settles by itself and goes home, asking nothing of the player', () => {
    const sim = cachedScenario('business', { seed: 1, params: { patrol: true, stage: 'busy' } }).sim;
    const id = inspections(sim).find((v) => sim.world.get(v, InspectionC)?.npc) as number;
    const insp = sim.world.get(id, InspectionC)!;
    const news = sim.galaxy.news.length;
    const log = runLog(sim, 9000, { until: () => insp.outcome !== undefined });
    expect(['clean', 'seized']).toContain(insp.outcome);
    expect(sim.galaxy.news.slice(news).some((n) => n.kind === 'seized')).toBe(insp.outcome === 'seized');
    expect(log.filter((l) => l.startsWith('inspect.'))).toEqual([]);
    run(sim, 3000, { until: (s) => !s.world.has(id, InspectionC) });
    expect(sim.world.has(id, InspectionC)).toBe(false);
  });

  it('an NPC miner\'s pod mines a trip, its crew unload the ore, and the order ends', () => {
    // Seed 2 has room for the miner (a mining hull with a pod bay).
    const sim: Sim = cachedScenario('business', { seed: 2 }).sim;
    run(sim, 600, { until: (s) => s.world.query(MiningPodC).length > 0 });
    const [pod] = sim.world.query(MiningPodC) as [number];
    const v = sim.world.get(pod, VehicleC)!;
    let carried = 0;
    run(sim, 3000, {
      until: (s) => {
        carried = Math.max(carried, cargoCount(v));
        return !s.world.has(pod, MiningPodC);
      },
    });
    expect(carried).toBeGreaterThan(0);
    expect(sim.world.has(pod, MiningPodC)).toBe(false);
    expect(v.state).toBe('stowed');
    expect(cargoCount(v)).toBe(0);
  });
});
