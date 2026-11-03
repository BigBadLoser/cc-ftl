import { describe, expect, it, vi } from 'vitest';
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
  it('loads a failed sheet again once its back-off has passed, so a passing failure does not blank its art for good', async () => {
    const r = rig();
    r.fail.add('bad.png');
    r.store.register('bad', spec('crew', 'bad.png'));
    r.store.request('bad');
    await r.store.idle();
    expect(r.store.state('bad')).toBe('failed');
    r.clock.t = 1999;
    r.store.get('bad'); // too soon: no new load
    await r.store.idle();
    expect(r.store.state('bad')).toBe('failed');
    r.fail.delete('bad.png');
    r.clock.t = 2000;
    expect(r.store.get('bad')).toBeUndefined(); // queued again
    await r.store.idle();
    expect(r.store.get('bad')?.image).toBe('bad.png');
  });
  it('backs off longer after each failure in a row', async () => {
    const r = rig();
    r.fail.add('bad.png');
    r.store.register('bad', spec('env', 'bad.png'));
    r.store.request('bad');
    await r.store.idle();
    r.clock.t = 2000;
    r.store.request('bad');
    await r.store.idle(); // second failure at t 2000: next try after 4000 ms
    r.clock.t = 5999;
    r.store.request('bad');
    expect(r.store.pending).toBe(0);
    r.clock.t = 6000;
    r.store.request('bad');
    expect(r.store.pending).toBe(1);
    await r.store.idle();
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

describe('SheetStore load order', () => {
  /** One slot, so the order of `loads` is the order the queue hands sheets out; the first sheet occupies the slot. */
  function ordered() {
    const loads: string[] = [];
    const io: SheetIO<string> = {
      async load(image) {
        loads.push(image);
        await Promise.resolve();
        return { sheet: { image, glow: null } as Loaded<string>, bytes: 1 };
      },
      unload: () => undefined,
    };
    const store = new SheetStore<string>({ io, pools: { env: { budget: 1000 } }, concurrency: 1, now: () => 0 });
    const reg = (n: string, rank?: number) => store.register(n, { image: n, pool: 'env', rank });
    return { store, loads, reg };
  }
  it('loads by rank, first come first served within a rank, preloads last', async () => {
    const o = ordered();
    for (const [n, r] of [['busy', 1], ['p', 1], ['walk1', 3], ['idle1', 2], ['walk2', 3], ['env1', 1], ['idle2', 2]] as const) o.reg(n, r);
    o.store.request('busy', true);
    o.store.request('p'); // a preload: after every rank
    o.store.request('walk1', true);
    o.store.request('idle1', true);
    o.store.request('walk2', true);
    o.store.request('env1', true);
    o.store.request('idle2', true);
    await o.store.idle();
    expect(o.loads).toEqual(['busy', 'env1', 'idle1', 'idle2', 'walk1', 'walk2', 'p']);
  });
  it('does not reshuffle a queued sheet when it is asked for again', async () => {
    const o = ordered();
    for (const n of ['busy', 'a', 'b', 'c']) o.reg(n, 1);
    o.store.request('busy', true);
    for (const n of ['a', 'b', 'c']) o.store.request(n, true);
    for (let i = 0; i < 5; i++) o.store.get('c');
    o.store.get('b');
    await o.store.idle();
    expect(o.loads).toEqual(['busy', 'a', 'b', 'c']);
  });
  it('promotes a queued preload when something draws without it, but only to its rank', async () => {
    const o = ordered();
    o.reg('busy', 1);
    o.reg('hi', 1);
    o.reg('w', 3);
    o.reg('pre', 1);
    o.store.request('busy', true);
    o.store.request('pre');
    o.store.request('w');
    o.store.request('hi', true);
    o.store.get('w'); // now drawn: rank 3, ahead of the preload 'pre', behind 'hi'
    await o.store.idle();
    expect(o.loads).toEqual(['busy', 'hi', 'w', 'pre']);
  });
});

describe('SheetStore load timeout', () => {
  /** Loads of images listed in `stuck` wait for a manual `release`; the others settle at once. */
  function hung(concurrency = 1) {
    const stuck = new Set<string>();
    const release = new Map<string, () => void>();
    const reject = new Map<string, () => void>();
    const loads: string[] = [];
    const unloaded: string[] = [];
    const errors: string[] = [];
    const io: SheetIO<string> = {
      async load(image) {
        loads.push(image);
        if (stuck.has(image)) await new Promise<void>((res, rej) => {
            release.set(image, res);
            reject.set(image, () => rej(new Error('late')));
          });
        return { sheet: { image, glow: null } as Loaded<string>, bytes: 10 };
      },
      unload: (name) => void unloaded.push(name),
    };
    const store = new SheetStore<string>({
      io,
      pools: { env: { budget: 1000 } },
      concurrency,
      now: () => Date.now(),
      retryMs: 100,
      loadTimeoutMs: 1000,
      onError: (n) => void errors.push(n),
    });
    for (const n of ['a', 'b']) store.register(n, { image: `${n}.png`, pool: 'env' });
    return { store, stuck, release, reject, loads, unloaded, errors };
  }

  it('times out a stuck load, frees its slot and loads the queued sheet', async () => {
    vi.useFakeTimers();
    try {
      const h = hung();
      h.stuck.add('a.png');
      h.store.request('a');
      h.store.request('b');
      await vi.advanceTimersByTimeAsync(500);
      expect(h.store.state('b')).toBe('queued');
      await vi.advanceTimersByTimeAsync(600);
      expect(h.store.state('a')).toBe('failed');
      expect(h.store.state('b')).toBe('ready');
      expect(h.errors).toEqual(['a']);
      expect(h.store.pending).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it('keeps a result that arrives after the timeout when no retry has started', async () => {
    vi.useFakeTimers();
    try {
      const h = hung();
      h.stuck.add('a.png');
      h.store.request('a');
      await vi.advanceTimersByTimeAsync(1100);
      expect(h.store.state('a')).toBe('failed');
      h.release.get('a.png')?.();
      await vi.advanceTimersByTimeAsync(0);
      expect(h.unloaded).toEqual([]);
      expect(h.store.state('a')).toBe('ready');
      expect(h.store.stats().pools.env?.resident).toBe(10);
      expect(h.store.stats().failed).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it('starts no second attempt while a timed-out one is still pending, and allows a retry once it errors', async () => {
    vi.useFakeTimers();
    try {
      const h = hung();
      h.stuck.add('a.png');
      h.store.request('a');
      await vi.advanceTimersByTimeAsync(1100);
      h.stuck.delete('a.png');
      await vi.advanceTimersByTimeAsync(5000);
      h.store.request('a');
      expect(h.store.state('a')).toBe('failed');
      expect(h.loads).toEqual(['a.png']);
      h.reject.get('a.png')?.();
      await vi.advanceTimersByTimeAsync(0);
      expect(h.store.state('a')).toBe('failed');
      h.store.request('a');
      await vi.advanceTimersByTimeAsync(0);
      expect(h.loads).toEqual(['a.png', 'a.png']);
      expect(h.store.state('a')).toBe('ready');
    } finally {
      vi.useRealTimers();
    }
  });
  it('asks for a failed sheet again once its back-off has passed (what the atlas lookups rely on)', async () => {
    vi.useFakeTimers();
    try {
      const h = hung();
      h.stuck.add('a.png');
      h.store.request('a');
      await vi.advanceTimersByTimeAsync(1000);
      h.reject.get('a.png')?.();
      await vi.advanceTimersByTimeAsync(0);
      h.store.request('a', true);
      expect(h.store.state('a')).toBe('failed');
      await vi.advanceTimersByTimeAsync(150);
      h.store.request('a', true);
      expect(h.store.state('a')).toBe('loading');
    } finally {
      vi.useRealTimers();
    }
  });
});
