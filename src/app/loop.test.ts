import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { newGame } from '../sim';
import { MarkerC } from '../sim/components';
import { advance, createLoop } from './loop';

describe('advance', () => {
  it('runs one step per 50ms at 20Hz 1x and carries remainder', () => {
    let r = advance(0, 120, 1);
    expect(r.steps).toBe(2);
    expect(r.acc).toBeCloseTo(20);
    r = advance(r.acc, 30, 1);
    expect(r.steps).toBe(1);
    expect(r.acc).toBeCloseTo(0);
  });
  it('scales with speed', () => {
    expect(advance(0, 100, 3).steps).toBe(5);
    expect(advance(0, 50, 2).steps).toBe(2);
  });
  it('does nothing when paused', () => {
    expect(advance(30, 1000, 0)).toEqual({ steps: 0, acc: 0 });
  });
  it('clamps catch-up and drops backlog', () => {
    const r = advance(0, 10_000, 1);
    expect(r.steps).toBe(5);
    expect(r.acc).toBe(0);
  });
  it('ignores negative dt', () => {
    expect(advance(10, -5, 1).steps).toBe(0);
  });
});

describe('flush', () => {
  it('applies queued commands and publishes their events without advancing the tick', () => {
    const sim = newGame(4, content);
    const seen: string[] = [];
    const loop = createLoop({ sim, render: () => undefined, onFrame: () => undefined, onEvents: (es) => seen.push(...es.map((e) => e.type)) });
    const tick = sim.tick;
    sim.enqueue({ type: 'debug.spawnMarker', x: 1, y: 1 });
    loop.flush();
    expect(sim.tick).toBe(tick);
    expect(sim.world.query(MarkerC)).toHaveLength(1);
    expect(seen.length).toBeGreaterThan(0);
  });
});

describe('hold', () => {
  it('keeps rendering but runs no ticks while held, then resumes at the requested speed', () => {
    const g = globalThis as unknown as { requestAnimationFrame: unknown; cancelAnimationFrame: unknown };
    const saved = { raf: g.requestAnimationFrame, caf: g.cancelAnimationFrame };
    let next: ((t: number) => void) | undefined;
    g.requestAnimationFrame = (f: (t: number) => void) => ((next = f), 1);
    g.cancelAnimationFrame = () => undefined;
    try {
      const sim = newGame(4, content);
      let frames = 0;
      const loop = createLoop({ sim, render: () => void frames++, onFrame: () => undefined });
      loop.setSpeed(2);
      loop.hold(true);
      loop.start();
      const tick = sim.tick;
      for (let t = 0; t <= 1000; t += 100) next?.(t);
      expect(sim.tick).toBe(tick);
      expect(frames).toBeGreaterThan(5);
      expect(loop.getSpeed()).toBe(2);
      loop.hold(false);
      for (let t = 1100; t <= 1500; t += 100) next?.(t);
      expect(sim.tick).toBeGreaterThan(tick);
      loop.stop();
    } finally {
      g.requestAnimationFrame = saved.raf;
      g.cancelAnimationFrame = saved.caf;
    }
  });
});
