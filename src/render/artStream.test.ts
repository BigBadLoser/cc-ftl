import { describe, expect, it } from 'vitest';
import type { Atlas } from './assets/loader';
import { SheetStore, type Loaded } from './assets/sheetStore';
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
  it('a rebuild while later sheets still load does not hide a scene that was showing', () => {
    const st = { gen: 0, busy: 0 };
    const atlas = { get generation() { return st.gen; }, busy: () => st.busy, envOver: () => false } as unknown as Atlas;
    let t = 0;
    const s = createArtStream(atlas, { rebuild: () => {}, sync: () => s.built(5) }, () => t);
    s.built(5); // built with the eager sheets in: shown
    expect(s.waiting(5)).toBe(false);
    st.busy = 4; // the scene asked for its module and crew sheets
    st.gen = 1; // some arrived, the rest still load
    t = REBUILD_MIN_MS;
    s.update(); // rebuilds (and so re-builds scene 5) while busy
    expect(s.waiting(5)).toBe(false);
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
    expect(st.swept).toEqual([]); // waits for the views to resolve their textures
    s.settle();
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
      s.settle();
      rebuilds = st.rebuilt;
    }
    expect(rebuilds).toBeLessThan(15); // not every CENSUS_MS
    st.t += CENSUS_MAX_MS;
    const before = st.rebuilt;
    s.update();
    s.settle();
    expect(st.rebuilt).toBe(before + 1);
  });
  it('does not sweep when under budget', () => {
    const { st, s } = rig(false);
    st.t = CENSUS_MS * 3;
    s.update();
    expect(st.rebuilt).toBe(0);
  });
  it('an over-budget sweep keeps the sheets the rebuilt scenes use and evicts an unused one', async () => {
    let clock = 1;
    const evicted: string[] = [];
    const store = new SheetStore<string>({
      io: { load: (image) => Promise.resolve({ sheet: { image, glow: null } as Loaded<string>, bytes: 10 }), unload: () => undefined },
      pools: { env: { budget: 15 } },
      concurrency: 4,
      now: () => clock,
      onEvict: (n) => void evicted.push(n),
    });
    for (const n of ['a', 'b', 'c']) store.register(n, { image: n, pool: 'env', pinned: false });
    for (const n of ['a', 'b', 'c']) store.get(n);
    await store.idle();
    clock = 100; // all three were last used long ago
    const atlas = {
      get generation() { return store.generationOf('env'); },
      busy: () => store.pending,
      envOver: () => store.over('env'),
      mark: () => ++clock,
      sweepEnv: (m: number) => (store.over('env') ? store.sweep('env', m) : []),
    } as unknown as Atlas;
    // A scene resolves its textures only in its own update, after the rebuild (as shipScene does).
    let wall = 0;
    let scene: string[] | null = null;
    const s = createArtStream(atlas, { rebuild: () => { scene = null; }, sync: () => { scene = ['a', 'b']; } }, () => wall);
    wall = CENSUS_MS;
    s.update();
    for (const n of scene ?? []) store.get(n); // sc.update(dt)
    expect(evicted).toEqual([]);
    s.settle();
    expect(evicted).toEqual(['c']);
    expect(store.isReady('a') && store.isReady('b')).toBe(true);
  });
});
