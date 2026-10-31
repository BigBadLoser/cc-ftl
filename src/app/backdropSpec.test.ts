import { describe, expect, it } from 'vitest';
import { START_NODE, galaxyIndex, newGame } from '../sim';
import { content } from '../content';
import { backdropSpecOf } from './backdropSpec';

describe('backdrop spec', () => {
  it('is stable for a node and seed', () => {
    expect(backdropSpecOf(newGame(1, content))).toEqual(backdropSpecOf(newGame(1, content)));
  });

  it('differs per node and per world seed', () => {
    const sim = newGame(1, content);
    const here = backdropSpecOf(sim);
    const next = (galaxyIndex(sim.galaxy).adjacent.get(START_NODE) ?? []).map((e) => (e.a === START_NODE ? e.b : e.a))[0]!;
    sim.galaxy.current = next;
    expect(backdropSpecOf(sim).seed).not.toBe(here.seed);
    expect(backdropSpecOf(newGame(2, content)).seed).not.toBe(here.seed);
  });

  it('reads the nebula density and the sector body of the current node', () => {
    const spec = backdropSpecOf(newGame(1, content));
    expect(spec.density).toBeGreaterThanOrEqual(0);
    expect(spec.density).toBeLessThanOrEqual(1);
    expect(spec.bodyHash).toBeGreaterThan(0);
    expect(spec.body === null || typeof spec.body === 'string').toBe(true);
  });
});
