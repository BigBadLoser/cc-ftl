import { describe, expect, it } from 'vitest';
import { homeShip, newGame } from '../sim';
import { shipGrid } from '../sim/regions';
import { addRoomHeat } from '../sim/roomTemp';
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

describe('tile inspector', () => {
  it('reads the temperature of the hovered tile from its room', () => {
    const sim = newGame(3, content);
    sim.step();
    const ship = homeShip(sim);
    const g = shipGrid(sim, ship)!;
    let tile: { x: number; y: number } | undefined;
    for (let y = g.y0; y < g.y0 + g.height && !tile; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('room', x, y) > 0) { tile = { x, y }; break; }
    addRoomHeat(sim, ship, g, g.get('room', tile!.x, tile!.y), 600);
    const bridge = createBridge(sim);
    let snap: { fields: { name: string; value: number }[] } | null = null;
    bridge.inspect.subscribe((v) => (snap = v));
    bridge.setHovered({ ship, x: tile!.x, y: tile!.y });
    const temp = (snap as { fields: { name: string; value: number }[] } | null)?.fields.find((f) => f.name === 'temp');
    expect(temp).toBeDefined();
    expect(temp!.value).toBeGreaterThan(30);
  });
});
