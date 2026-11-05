import { describe, expect, it } from 'vitest';
import { componentNames } from '../index';
import { TRANSLATE, translated } from './translate';

describe('packet translation table', () => {
  it('classifies every declared component (add an entry when you add a component)', () => {
    const names = componentNames();
    expect(names.length).toBeGreaterThan(50);
    expect(names.filter((n) => !(n in TRANSLATE))).toEqual([]);
  });

  it('moves positions, paths and nested points, and copies the data', () => {
    const src = {
      position: { x: 1, y: 2, toX: 2, toY: 2, progress: 0.5, facing: 0 },
      path: { steps: [{ x: 3, y: 4 }] },
      drafted: { target: { x: 5, y: 5 }, planned: { x: 5, y: 5 } },
      health: { hp: 10, max: 10 },
    };
    const out = translated(src, 10, -2) as typeof src;
    expect(out.position).toMatchObject({ x: 11, y: 0, toX: 12, toY: 0, progress: 0.5 });
    expect(out.path.steps).toEqual([{ x: 13, y: 2 }]);
    expect(out.drafted).toEqual({ target: { x: 15, y: 3 }, planned: { x: 15, y: 3 } });
    expect(out.health).toEqual(src.health);
    expect(src.position.x).toBe(1);
    expect(() => translated({ nope: { x: 1 } }, 1, 1)).toThrow(/no translation table entry/);
  });

  it('moves a break\'s stressor focus with its ship (lift to ship-local, stamp at another place) and tolerates none', () => {
    const brk = { kind: 'panic', tier: 'severe', context: 'fire', until: 9, since: 1, goneSince: 0, src: { x: 30, y: 52 } };
    const lifted = translated({ breakdown: brk }, -20, -50) as { breakdown: typeof brk };
    expect(lifted.breakdown.src).toEqual({ x: 10, y: 2 });
    const stamped = translated(lifted, 100, 7) as { breakdown: typeof brk };
    expect(stamped.breakdown.src).toEqual({ x: 110, y: 9 });
    expect(brk.src).toEqual({ x: 30, y: 52 });
    const bare = { kind: 'panic', tier: 'severe', context: 'lowMood', until: 9, since: 1, goneSince: 0 };
    expect((translated({ breakdown: bare }, 5, 5) as { breakdown: object }).breakdown).toEqual(bare);
  });
});
