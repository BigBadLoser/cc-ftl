import { ByteBudget } from './budget';

/** A loaded sheet: its image and, if the manifest has one, the glow twin (always loaded and freed together). */
export interface Loaded<T> {
  image: T;
  glow: T | null;
}

/** How the store gets a sheet into memory and out again. `bytes` is the decoded size of everything `load` returned. */
export interface SheetIO<T> {
  load(image: string, glow: string | undefined): Promise<{ sheet: Loaded<T>; bytes: number }>;
  unload(name: string, sheet: Loaded<T>, image: string, glow: string | undefined): void;
}

export interface PoolDef {
  /** Decoded byte budget of the pool (pinned sheets count, but are never evicted). */
  budget: number;
  /**
   * Evict by idle time without being asked: a sheet nobody asked for during the last `idleMs` goes when the pool is over
   * budget. Without it a pool is only trimmed by `sweep`, for sheets whose textures are held by built sprites.
   */
  idleMs?: number;
}

export interface SheetSpec {
  image: string;
  glow?: string;
  pool: string;
  /** Loaded at start and never evicted. */
  pinned?: boolean;
}

export interface StoreOpts<T> {
  io: SheetIO<T>;
  pools: Record<string, PoolDef>;
  /** Sheets loading at once. */
  concurrency?: number;
  now(): number;
  onEvict?(name: string): void;
  /** A sheet asked for again before it was destroyed is kept as it is (no reload). */
  onRestore?(name: string): void;
  onError?(name: string, err: unknown): void;
  /**
   * Ms after a failed load before the sheet may be asked for again (doubling with each failure, up to 30 s). A load that
   * fails once (a dropped request, a decode that ran out of memory on a phone) must not blank what it draws for the rest
   * of the session. Default 2000.
   */
  retryMs?: number;
}

export interface PoolStats {
  resident: number;
  budget: number;
  sheets: number;
}

type State = 'idle' | 'queued' | 'loading' | 'ready' | 'failed';

interface Rec<T> {
  spec: SheetSpec;
  state: State;
  sheet: Loaded<T> | null;
  /** Load requests made over the sheet's life (reloads after an eviction count). */
  loads: number;
  /** Failed loads in a row, and when the last one failed (store clock). */
  fails: number;
  failedAt: number;
}

/**
 * Sheets loaded on demand. `get` returns a ready sheet (and counts as a use), or undefined while it is not loaded, in
 * which case it also queues the load. `generation` goes up whenever the set of ready sheets changes, so views that cached
 * a resolution can tell it is stale. Evicted sheets are destroyed one `tick` later, so a sprite that still points at one
 * in the frame it was evicted in never draws a destroyed texture.
 */
export class SheetStore<T> {
  generation = 0;
  private readonly poolGen = new Map<string, number>();
  private readonly recs = new Map<string, Rec<T>>();
  private readonly budgets = new Map<string, ByteBudget>();
  private readonly queue: string[] = [];
  private running = 0;
  private dying: { name: string; sheet: Loaded<T>; spec: SheetSpec; bytes: number }[] = [];
  private requests = 0;

  constructor(private readonly o: StoreOpts<T>) {
    for (const [k, p] of Object.entries(o.pools)) this.budgets.set(k, new ByteBudget(p.budget));
  }

  register(name: string, spec: SheetSpec): void {
    if (!this.budgets.has(spec.pool)) throw new Error(`Unknown sheet pool "${spec.pool}"`);
    this.recs.set(name, { spec, state: 'idle', sheet: null, loads: 0, fails: 0, failedAt: 0 });
  }

  /** Like `generation`, counting only the given pools' changes (static art is cached in built sprites; crew frames are not). */
  generationOf(...pools: string[]): number {
    let n = 0;
    for (const p of pools) n += this.poolGen.get(p) ?? 0;
    return n;
  }

  private bump(pool: string): void {
    this.generation++;
    this.poolGen.set(pool, (this.poolGen.get(pool) ?? 0) + 1);
  }

  has(name: string): boolean {
    return this.recs.has(name);
  }

  state(name: string): State | 'unknown' {
    return this.recs.get(name)?.state ?? 'unknown';
  }

  /** The sheet if ready (counted as used), else undefined after queueing its load. */
  get(name: string): Loaded<T> | undefined {
    const r = this.recs.get(name);
    if (!r) return undefined;
    if (r.state === 'ready') {
      this.budgets.get(r.spec.pool)?.touch(name, this.o.now());
      return r.sheet as Loaded<T>;
    }
    this.request(name, true);
    return undefined;
  }

  /**
   * Queue a sheet's load if it is not loaded or on its way. `urgent`: something is drawing without it right now, so it
   * goes ahead of the preload backlog (and a queued one moves up); preloads wait their turn in request order.
   */
  request(name: string, urgent = false): void {
    const r = this.recs.get(name);
    if (!r) return;
    if (r.state === 'queued' && urgent) {
      const at = this.queue.indexOf(name);
      if (at > 0) {
        this.queue.splice(at, 1);
        this.queue.unshift(name);
      }
      return;
    }
    if (r.state === 'failed' && this.o.now() - r.failedAt >= this.retryDelay(r.fails)) r.state = 'idle';
    if (r.state !== 'idle') return;
    const i = this.dying.findIndex((d) => d.name === name);
    if (i >= 0) {
      const [d] = this.dying.splice(i, 1) as [(typeof this.dying)[number]];
      r.sheet = d.sheet;
      r.state = 'ready';
      this.budgets.get(r.spec.pool)?.add(name, d.bytes, this.o.now(), !!r.spec.pinned);
      this.bump(r.spec.pool);
      this.o.onRestore?.(name);
      return;
    }
    r.state = 'queued';
    if (urgent) this.queue.unshift(name);
    else this.queue.push(name);
    this.requests++;
    this.pump();
  }

  /** Ms to wait after the `fails`-th failure in a row before loading again. */
  private retryDelay(fails: number): number {
    return Math.min(30_000, (this.o.retryMs ?? 2000) * 2 ** Math.max(0, fails - 1));
  }

  /** True if the sheet is loaded now (not a use, and queues nothing). */
  isReady(name: string): boolean {
    return this.recs.get(name)?.state === 'ready';
  }

  /** Sheets queued or loading. */
  get pending(): number {
    return this.queue.length + this.running;
  }

  /** Resolves when nothing is queued or loading (including loads queued meanwhile). */
  async idle(): Promise<void> {
    while (this.pending > 0) await new Promise((res) => setTimeout(res, 5));
  }

  private pump(): void {
    const limit = this.o.concurrency ?? 4;
    while (this.running < limit && this.queue.length) {
      const name = this.queue.shift() as string;
      const r = this.recs.get(name) as Rec<T>;
      r.state = 'loading';
      r.loads++;
      this.running++;
      this.o.io.load(r.spec.image, r.spec.glow).then(
        ({ sheet, bytes }) => {
          r.sheet = sheet;
          r.state = 'ready';
          r.fails = 0;
          this.budgets.get(r.spec.pool)?.add(name, bytes, this.o.now(), !!r.spec.pinned);
          this.bump(r.spec.pool);
        },
        (err) => {
          r.state = 'failed';
          r.fails++;
          r.failedAt = this.o.now();
          this.o.onError?.(name, err);
        },
      ).finally(() => {
        this.running--;
        this.pump();
      });
    }
  }

  private evict(name: string): void {
    const r = this.recs.get(name);
    if (!r || r.state !== 'ready' || !r.sheet) return;
    const bytes = this.budgets.get(r.spec.pool)?.entries.get(name)?.bytes ?? 0;
    this.dying.push({ name, sheet: r.sheet, spec: r.spec, bytes });
    r.sheet = null;
    r.state = 'idle';
    this.budgets.get(r.spec.pool)?.remove(name);
    this.bump(r.spec.pool);
    this.o.onEvict?.(name);
  }

  /** Evict from a pool the sheets unused since `before` (oldest first) until it fits its budget. Returns the names. */
  sweep(pool: string, before: number): string[] {
    const out = this.budgets.get(pool)?.victims(before) ?? [];
    for (const n of out) this.evict(n);
    return out;
  }

  /** Once per frame, after drawing: destroy what was evicted a tick ago, then evict idle sheets from the self-trimming pools. */
  tick(): void {
    this.flush();
    const now = this.o.now();
    for (const [pool, p] of Object.entries(this.o.pools)) if (p.idleMs !== undefined) this.sweep(pool, now - p.idleMs);
  }

  /** Destroy the textures of sheets evicted before this call. */
  flush(): void {
    const dead = this.dying;
    this.dying = [];
    for (const d of dead) this.o.io.unload(d.name, d.sheet, d.spec.image, d.spec.glow);
  }

  /** Visit every ready sheet. */
  forEachReady(fn: (name: string, sheet: Loaded<T>) => void): void {
    for (const [n, r] of this.recs) if (r.state === 'ready' && r.sheet) fn(n, r.sheet);
  }

  over(pool: string): boolean {
    const b = this.budgets.get(pool);
    return !!b && b.resident > b.limit;
  }

  /** The `n` biggest resident sheets (name, decoded bytes), for the debug readout. */
  biggest(n: number): [string, number][] {
    const all: [string, number][] = [];
    for (const b of this.budgets.values()) for (const [k, e] of b.entries) all.push([k, e.bytes]);
    return all.sort((a, b) => b[1] - a[1]).slice(0, n);
  }

  stats(): { pools: Record<string, PoolStats>; requests: number; ready: number; pending: number; failed: number } {
    const pools: Record<string, PoolStats> = {};
    for (const [k, b] of this.budgets) pools[k] = { resident: b.resident, budget: b.limit, sheets: b.entries.size };
    let ready = 0, failed = 0;
    for (const r of this.recs.values()) {
      if (r.state === 'ready') ready++;
      else if (r.state === 'failed') failed++;
    }
    return { pools, requests: this.requests, ready, pending: this.pending, failed };
  }
}
