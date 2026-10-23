import { describe, expect, it } from 'vitest';
import type { Atlas } from './assets/loader';
import { CENSUS_MAX_MS, CENSUS_MS, createArtStream, FRESH_MS, REBUILD_MIN_MS } from './artStream';

function rig(over = false, evicts = 0) {
  const st = { gen: 0, busy: 0, over, t: 0, mark: 0, swept: [] as number[], rebuilt: 0, synced: 0 };
  const atlas = {
    get generation() { return st.gen; },
    busy: () => st.busy,
    envOver: () => st.over,
    mark: () => ++st.mark,
    sweepEnv: (m: number) => { st.swept.push(m); return Array(evicts).fill('x') as string[]; },
  } as unknown as Atlas;
  const s = createArtStream(atlas, { rebuild: () => void st.rebuilt++, sync: () => void st.synced++ }, () => st.t);
  return { st, s };
}

describe('artStream', () => {
  it('rebuilds once art has arrived and nothing is loading', () => {
    const { st, s } = rig();
    st.gen = 1;
    st.busy = 2;
    s.update();
    expect(st.rebuilt).toBe(1); // first rebuild is not held back (nothing was rebuilt yet)
    st.gen = 2;
    st.t = 100;
    s.update();
    expect(st.rebuilt).toBe(1); // still loading, rebuilt a moment ago
    st.busy = 0;
    s.update();
    expect(st.rebuilt).toBe(2);
    expect(st.synced).toBe(2);
    s.update();
    expect(st.rebuilt).toBe(2);
  });
  it('rebuilds at most every REBUILD_MIN_MS while loads trickle in', () => {
    const { st, s } = rig();
    st.busy = 1;
    st.gen = 1;
    s.update();
    st.gen = 2;
    st.t = REBUILD_MIN_MS - 1;
    s.update();
    expect(st.rebuilt).toBe(1);
    st.t = REBUILD_MIN_MS;
    s.update();
    expect(st.rebuilt).toBe(2);
  });
  it('hides a new scene while sheets load, until they arrive or FRESH_MS pass', () => {
    const { st, s } = rig();
    st.busy = 3;
    s.built(7);
    expect(s.waiting(7)).toBe(true);
    st.busy = 0;
    s.update();
    expect(s.waiting(7)).toBe(false);
    st.busy = 3;
    s.built(8);
    st.t = FRESH_MS + 1;
    s.update();
    expect(s.waiting(8)).toBe(false);
  });
  it('does not hide a scene built with everything loaded', () => {
    const { s } = rig();
    s.built(1);
    expect(s.waiting(1)).toBe(false);
  });
  it('sweeps the env pool after rebuilding when over budget, at most every CENSUS_MS', () => {
    const { st, s } = rig(true);
    st.t = CENSUS_MS - 1;
    s.update();
    expect(st.rebuilt).toBe(0);
    st.t = CENSUS_MS;
    s.update();
    expect(st.rebuilt).toBe(1);
    expect(st.swept).toEqual([1]);
    st.t += 10;
    s.update();
    expect(st.rebuilt).toBe(1);
  });
  it('backs off when over budget but everything is in use, and resets after an eviction', () => {
    const { st, s } = rig(true, 0);
    let rebuilds = 0;
    for (let k = 0; k < 40; k++) {
      st.t += CENSUS_MS;
      s.update();
      rebuilds = st.rebuilt;
    }
    expect(rebuilds).toBeLessThan(15); // not every CENSUS_MS
    st.t += CENSUS_MAX_MS;
    const before = st.rebuilt;
    s.update();
    expect(st.rebuilt).toBe(before + 1);
  });
  it('does not sweep when under budget', () => {
    const { st, s } = rig(false);
    st.t = CENSUS_MS * 3;
    s.update();
    expect(st.rebuilt).toBe(0);
  });
});
