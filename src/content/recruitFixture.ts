import { expect } from 'vitest';
import { AboardC, CrewC, ForHireC, deserialize, galaxyIndex, newGame, serialize, type Sim } from '../sim';
import { AllegianceC } from '../sim/fight/components';
import { portsAt } from '../sim/galaxy/portIndex';
import { portRecruits } from '../sim/galaxy/recruit';
import { ensureAround } from '../sim/galaxy/state';
import { placementGapError } from '../sim/regions';
import { content } from '.';

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

/** The hire run, up to the moment the recruit is aboard and the shuttle heads home (phase 'back'), built once and cloned from its save for each test that starts there. */
let backSnap: { json: string; c: number; cost: number; credits: number; crew: number } | undefined;
export function atBack(): { sim: Sim; c: number; cost: number; credits: number; crew: number } {
  if (!backSnap) {
    const sim = atStation();
    const [c] = people(sim) as [number];
    const fh = sim.world.get(c, ForHireC)!;
    const credits = (sim.trade.credits = 1000);
    const crew = playerCrew(sim).length;
    hire(sim, fh.key);
    run(sim, () => sim.trade.deals[0]?.phase === 'back', 6000);
    expect(sim.trade.deals[0]?.phase).toBe('back');
    expect(sim.world.get(c, AboardC)).toBeDefined(); // boarded: the exchange is behind it
    backSnap = { json: serialize(sim), c, cost: fh.cost, credits, crew };
  }
  return { sim: deserialize(backSnap.json, content), c: backSnap.c, cost: backSnap.cost, credits: backSnap.credits, crew: backSnap.crew };
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
