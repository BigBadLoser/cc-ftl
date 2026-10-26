import { describe, expect, it } from 'vitest';
import { newGame } from '../sim';
import { ensureAround } from '../sim/galaxy/state';
import { content } from '../content';
import { createBridge } from './bridge';
import { buildJobs } from './jobsSnapshot';
import type { Loop } from './loop';

function fakeLoop(step: () => void): Loop & { flushes: number } {
  const l = { flushes: 0, start() {}, stop() {}, setSpeed() {}, getSpeed: () => 0 as const, alpha: 0, flush() { l.flushes++; step(); } };
  return l as unknown as Loop & { flushes: number };
}

describe('UI commands while paused', () => {
  it('a job accepted while paused is taken at once, through the command queue', () => {
    const sim = newGame(3, content);
    ensureAround(sim, sim.galaxy.current);
    const bridge = createBridge(sim);
    const loop = fakeLoop(() => sim.step());
    bridge.attachLoop(loop);
    bridge.setSpeed(0);
    const offer = buildJobs(sim).offers[0]!;
    const tick = sim.tick;
    bridge.dispatch({ type: 'jobs.accept', key: offer.key });
    expect(loop.flushes).toBe(1);
    expect(sim.tick).toBe(tick + 1);
    expect(buildJobs(sim).active.map((j) => j.key)).toEqual([offer.key]);
  });

  it('a job accepted while running waits for the loop, not for a flush', () => {
    const sim = newGame(3, content);
    ensureAround(sim, sim.galaxy.current);
    const bridge = createBridge(sim);
    const loop = fakeLoop(() => sim.step());
    bridge.attachLoop(loop);
    bridge.setSpeed(1);
    const offer = buildJobs(sim).offers[0]!;
    bridge.dispatch({ type: 'jobs.accept', key: offer.key });
    expect(loop.flushes).toBe(0);
    expect(buildJobs(sim).active).toEqual([]);
    sim.step();
    expect(buildJobs(sim).active.map((j) => j.key)).toEqual([offer.key]);
  });
});
