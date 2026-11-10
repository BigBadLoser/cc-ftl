import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { ModuleC, newGame } from '../sim';
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
    const loop = fakeLoop(() => sim.applyCommands());
    bridge.attachLoop(loop);
    bridge.setSpeed(0);
    const offer = buildJobs(sim).offers[0]!;
    const tick = sim.tick;
    bridge.dispatch({ type: 'jobs.accept', key: offer.key });
    expect(loop.flushes).toBe(1);
    expect(sim.tick).toBe(tick); // a paused click applies the command but advances no time
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

describe('snapshots while paused', () => {
  it('the job board follows the ship (its strength rates a bounty) once the game is paused, not only the galaxy', () => {
    const sim = newGame(3, content);
    ensureAround(sim, sim.galaxy.current);
    const bridge = createBridge(sim);
    const frame = () => bridge.update({ tick: sim.tick, entityCount: 0, fps: 60, frameMs: 16, tickMs: 1 });
    for (let i = 0; i < 20; i++) frame();
    // A gun is lost in a tick, then the player pauses: no tick and no command from here on.
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC)!;
      if (sim.content.modules[m.def]?.weapon) m.hp = 0;
    }
    sim.step();
    for (let i = 0; i < 40; i++) frame();
    expect(get(bridge.jobs)).toEqual(JSON.parse(JSON.stringify(buildJobs(sim))));
  });
});

describe('turn counter', () => {
  it('the HUD snapshot carries the sim turn from the first frame, and follows it without the starmap open', () => {
    const sim = newGame(3, content);
    sim.galaxy.turn = 9; // as a loaded save
    const bridge = createBridge(sim);
    expect(get(bridge.snapshot).turn).toBe(9);
    sim.galaxy.turn = 10;
    bridge.update({ fps: 60, frameMs: 1, tickMs: 1 } as never);
    expect(get(bridge.snapshot).turn).toBe(10);
  });
});
