import { describe, expect, it } from 'vitest';
import { ModuleC, TICK_HZ, homeShip, newGame, storageAdd, type Sim } from '../sim';
import { pipeline } from '../sim/pipeline';
import { shipIdOf } from '../sim/regions';
import { galaxySystem } from '../sim/systems/galaxy';
import { recruitsSystem } from '../sim/systems/recruits';
import { storySystem } from '../sim/systems/story';
import { tradeSystem } from '../sim/systems/trade';
import { content } from './index';

/**
 * Pace of relationships (docs/TRAITS.md section 6): "about 1 to 3 hours of play to a first friend or rival". A quiet ship of the
 * starter crew (nobody comes to attack, the food is topped up) runs until two crew first count each other a friend or a rival.
 * The ship has no work to do, so it is the idle-heavy end of play: a busy colony with crew apart at their stations takes longer.
 */

/** The tick without the starmap, the story and trade: no raiders arrive and nothing else disturbs the crew. */
const SKIP = new Set([galaxySystem, storySystem, recruitsSystem, tradeSystem]);
function calmStep(sim: Sim): void {
  for (const sys of pipeline) if (!SKIP.has(sys)) sys(sim);
  sim.tick++;
}

/** Minutes until the first friend or rival forms on a quiet starter ship (or `cap` if none does). */
function minutesToFirstBond(seed: number, cap: number): { minutes: number; kind: string } {
  const sim = newGame(seed, content, 'ship.starter', false);
  const ship = homeShip(sim);
  const store = sim.world.query(ModuleC).find((m) => shipIdOf(sim, sim.world.get(m, ModuleC)!) === ship && sim.content.modules[sim.world.get(m, ModuleC)!.def]?.storage);
  for (let m = 1; m <= cap; m++) {
    if (store !== undefined && m % 10 === 0) storageAdd(sim, store, 'item.ration', 20);
    for (let i = 0; i < 60 * TICK_HZ; i++) calmStep(sim);
    const ev = sim.events.drain().filter((e) => e.type === 'crew.befriended' || e.type === 'crew.rivalry');
    if (ev.length > 0) return { minutes: m, kind: ev[0]!.type };
  }
  return { minutes: cap, kind: 'none' };
}

describe('bond pace', () => {
  // Guard for crewBonds.soak.test.ts, which runs seeds 12 and 3 until they bond (minute 61 and 94). Here the quick seed runs only the
  // first half hour: nobody bonds earlier than the design's "half an hour" floor.
  it('seed 12: no friend or rival forms in the first 29 minutes', () => {
    const r = minutesToFirstBond(12, 29);
    expect(r.kind).toBe('none');
  }, 600000);
});
