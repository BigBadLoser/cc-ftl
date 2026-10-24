import { describe, expect, it } from 'vitest';
import { SheetStore, type Loaded, type SheetIO } from './sheetStore';

interface Rig {
  store: SheetStore<string>;
  clock: { t: number };
  loaded: string[];
  unloaded: string[];
  evicted: string[];
  fail: Set<string>;
}

function rig(budgets: { env?: number; crew?: number; idleMs?: number } = {}, concurrency = 2): Rig {
  const clock = { t: 0 };
  const loaded: string[] = [];
  const unloaded: string[] = [];
  const evicted: string[] = [];
  const fail = new Set<string>();
  const io: SheetIO<string> = {
    async load(image) {
      await Promise.resolve();
      if (fail.has(image)) throw new Error('nope');
      loaded.push(image);
      return { sheet: { image, glow: null } as Loaded<string>, bytes: 10 };
    },
    unload: (name) => void unloaded.push(name),
  };
  const store = new SheetStore<string>({
    io,
    pools: { env: { budget: budgets.env ?? 1000 }, crew: { budget: budgets.crew ?? 1000, idleMs: budgets.idleMs ?? 100 } },
    concurrency,
    now: () => clock.t,
    onEvict: (n) => void evicted.push(n),
  });
  return { store, clock, loaded, unloaded, evicted, fail };
}
const spec = (pool: string, image: string, pinned = false) => ({ image, pool, pinned });

describe('SheetStore', () => {
  it('returns undefined and queues the load until the sheet is ready', async () => {
    const r = rig();
    r.store.register('a', spec('env', 'a.png'));
    expect(r.store.get('a')).toBeUndefined();
    expect(r.store.pending).toBe(1);
    await r.store.idle();
    expect(r.store.get('a')?.image).toBe('a.png');
    expect(r.loaded).toEqual(['a.png']);
  });
  it('loads a sheet once however often it is asked for', async () => {
    const r = rig();
    r.store.register('a', spec('env', 'a.png'));
    for (let i = 0; i < 5; i++) r.store.get('a');
    await r.store.idle();
    r.store.get('a');
    expect(r.loaded).toEqual(['a.png']);
    expect(r.store.stats().requests).toBe(1);
  });
  it('loads what is drawn now ahead of the preload backlog', async () => {
    const r = rig({}, 1);
    for (const n of ['a', 'b', 'c', 'd']) r.store.register(n, spec('crew', `${n}.png`));
    for (const n of ['a', 'b', 'c']) r.store.request(n); // a is loading; b, c wait
    r.store.get('d'); // a figure is drawing without d: it goes first
    r.store.get('c'); // and a queued one moves up when it is needed
    await r.store.idle();
    expect(r.loaded).toEqual(['a.png', 'c.png', 'd.png', 'b.png']);
  });
  it('limits concurrent loads', async () => {
    const r = rig({}, 2);
    for (const n of ['a', 'b', 'c', 'd']) {
      r.store.register(n, spec('env', `${n}.png`));
      r.store.request(n);
    }
    expect(r.store.stats().pending).toBe(4);
    await r.store.idle();
    expect(r.store.stats().ready).toBe(4);
  });
  it('bumps the generation of the pool when a sheet arrives or leaves', async () => {
    const r = rig({ env: 5 });
    r.store.register('a', spec('env', 'a.png'));
    r.store.register('c', spec('crew', 'c.png'));
    r.store.request('a');
    await r.store.idle();
    expect(r.store.generationOf('env')).toBe(1);
    expect(r.store.generationOf('crew')).toBe(0);
    r.clock.t = 10;
    r.store.sweep('env', 20);
    expect(r.store.generationOf('env')).toBe(2);
  });
  it('trims the crew pool by idle time on tick, and destroys one tick later', async () => {
    const r = rig({ crew: 15, idleMs: 100 });
    for (const n of ['x', 'y']) {
      r.store.register(n, spec('crew', `${n}.png`));
      r.store.request(n);
    }
    await r.store.idle();
    r.clock.t = 50;
    r.store.get('y');
    r.store.tick();
    expect(r.evicted).toEqual([]); // over budget (20 > 15) but both used within idleMs
    r.clock.t = 160;
    r.store.get('y');
    r.store.tick();
    expect(r.evicted).toEqual(['x']);
    expect(r.store.state('x')).toBe('idle'); // gone for lookups at once
    expect(r.unloaded).toEqual([]); // but not destroyed in the frame it was evicted
    r.clock.t = 170;
    r.store.tick();
    expect(r.unloaded).toEqual(['x']);
  });
  it('keeps pinned sheets and sheets in use', async () => {
    const r = rig({ env: 1 });
    r.store.register('core', spec('env', 'core.png', true));
    r.store.register('hot', spec('env', 'hot.png'));
    r.store.register('cold', spec('env', 'cold.png'));
    for (const n of ['core', 'hot', 'cold']) r.store.request(n);
    await r.store.idle();
    r.clock.t = 100;
    r.store.get('hot');
    expect(r.store.sweep('env', 100)).toEqual(['cold']);
    expect(r.store.get('core')).toBeDefined();
    expect(r.store.get('hot')).toBeDefined();
  });
  it('restores a sheet asked for again before it was destroyed, without reloading it', async () => {
    const r = rig({ env: 1 });
    r.store.register('a', spec('env', 'a.png'));
    r.store.request('a');
    await r.store.idle();
    r.clock.t = 5;
    r.store.sweep('env', 10);
    expect(r.store.state('a')).toBe('idle');
    expect(r.store.get('a')).toBeUndefined();
    expect(r.store.state('a')).toBe('ready'); // the get restored it
    r.store.flush();
    expect(r.unloaded).toEqual([]);
    expect(r.loaded).toEqual(['a.png']);
  });
  it('reloads an evicted sheet after it was destroyed', async () => {
    const r = rig({ env: 1 });
    r.store.register('a', spec('env', 'a.png'));
    r.store.request('a');
    await r.store.idle();
    r.clock.t = 5;
    r.store.sweep('env', 10);
    r.store.flush();
    r.store.request('a');
    await r.store.idle();
    expect(r.loaded).toEqual(['a.png', 'a.png']);
    expect(r.store.get('a')).toBeDefined();
  });
  it('marks a failing sheet failed and keeps going', async () => {
    const r = rig();
    r.fail.add('bad.png');
    r.store.register('bad', spec('env', 'bad.png'));
    r.store.register('ok', spec('env', 'ok.png'));
    r.store.request('bad');
    r.store.request('ok');
    await r.store.idle();
    expect(r.store.state('bad')).toBe('failed');
    expect(r.store.get('bad')).toBeUndefined();
    expect(r.store.get('ok')).toBeDefined();
    expect(r.store.stats().failed).toBe(1);
  });
  it('reports decoded bytes per pool', async () => {
    const r = rig();
    r.store.register('a', spec('env', 'a.png'));
    r.store.register('c', spec('crew', 'c.png'));
    r.store.request('a');
    r.store.request('c');
    await r.store.idle();
    const s = r.store.stats();
    expect(s.pools.env?.resident).toBe(10);
    expect(s.pools.crew?.resident).toBe(10);
  });
});
