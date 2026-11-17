import { expect } from 'vitest';
import { CrewC } from '../../../src/sim/crew/components';
import { galaxyIndex } from '../../../src/sim/galaxy/state';
import { newGame } from '../../../src/sim/newGame';
import { cachedWorld } from '../world';
import type { Sim } from '../../../src/sim/sim';
import { ForHireC } from '../../../src/sim/stations/components';
import { AboardC } from '../../../src/sim/vehicles/components';
import { AllegianceC } from '../../../src/sim/fight/components';
import { portsAt } from '../../../src/sim/galaxy/portIndex';
import { portRecruits } from '../../../src/sim/galaxy/recruit';
import { ensureAround } from '../../../src/sim/galaxy/state';
import { placementGapError } from '../../../src/sim/regions';
import { content } from '../../../src/content';

export const step = (sim: Sim, n = 1): void => {
  for (let i = 0; i < n; i++) sim.step();
};
/** Deploy at the first free spot (a node's structures stand east of the west margin). */
export function deploy(sim: Sim): void {
  const p = sim.sector.packet!;
  for (let x = 0; x + p.w <= sim.sector.width; x += 4) {
    for (let y = 2; y + p.h <= sim.sector.height; y += 4) {
      if (placementGapError(sim, { x, y, w: p.w, h: p.h })) continue;
      sim.enqueue({ type: 'sector.deploy', x, y });
      return step(sim);
    }
  }
  throw new Error('no room to deploy');
}

/** A game whose player has dropped into a node with a trade station that posts candidates, run until the station's people have appeared. */
export function atStation(): Sim {
  const sim = newGame(7, content);
  step(sim, 2);
  ensureAround(sim, sim.galaxy.current);
  const node = [...galaxyIndex(sim.galaxy).nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1))
    .find((n) => portsAt(sim, n.id).some((p) => portRecruits(sim, p).length > 0));
  expect(node).toBeDefined();
  sim.enqueue({ type: 'debug.galaxyTeleport', node: node!.id });
  step(sim);
  deploy(sim);
  step(sim, 25);
  sim.events.drain();
  return sim;
}

export const people = (sim: Sim): readonly number[] => sim.world.query(ForHireC);
export const playerCrew = (sim: Sim): number[] => sim.world.query(CrewC).filter((id) => sim.world.get(id, AllegianceC)?.faction === 'player');
/** Step until `done` or the budget runs out; returns the events seen. */
export function run(sim: Sim, done: () => boolean, max = 6000): ReturnType<Sim['events']['drain']> {
  const all: ReturnType<Sim['events']['drain']> = [];
  for (let i = 0; i < max && !done(); i++) {
    sim.step();
    all.push(...sim.events.drain());
  }
  return all;
}


export const hire = (sim: Sim, key: string) => {
  sim.enqueue({ type: 'crew.hire', key });
  sim.step();
  return sim.events.drain();
};

export interface HireRun { sim: Sim; c: number; cost: number; credits: number; crew: number }
const hireRun = (key: string, until: string): HireRun => {
  const sim = cachedWorld(key, () => {
    const s = key === 'recruit.back' ? atWork().sim : atStation();
    if (key === 'recruit.work') {
      const [c] = people(s) as [number];
      s.trade.credits = 1000;
      hire(s, s.world.get(c, ForHireC)!.key);
    }
    run(s, () => s.trade.deals[0]?.phase === until, 6000);
    expect(s.trade.deals[0]?.phase).toBe(until);
    return s;
  });
  const [c] = (sim.trade.deals[0]?.crew ?? []) as number[];
  const cost = sim.trade.deals[0]!.held as number;
  return { sim, c: c!, cost, credits: 1000, crew: playerCrew(sim).length };
};

/** The hire run (1000 credits, first candidate) up to the station work, cached; each call is a fresh clone. */
export const atWork = (): HireRun => hireRun('recruit.work', 'stationWork');

/** The hire run up to the moment the recruit is aboard and the shuttle heads home (phase 'back'), continued from the station-work state; cached. */
export function atBack(): HireRun {
  const r = hireRun('recruit.back', 'back');
  expect(r.sim.world.get(r.c, AboardC)).toBeDefined(); // boarded: the exchange is behind it
  return r;
}
