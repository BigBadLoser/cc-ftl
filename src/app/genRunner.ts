import type { GenResult } from '../sim/shipgen/types';
import type { GenRequest } from './genWorker';
import type { ShipGenerator } from './prewarm';

/** A `ShipGenerator` on a web worker (genWorker.ts), or null where workers are not available (the sim then warms ships itself). */
export function workerGenerator(): ShipGenerator | null {
  if (typeof Worker === 'undefined') return null;
  let worker: Worker;
  try {
    worker = new Worker(new URL('./genWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
  let next = 1;
  const waiting = new Map<number, { ok: (g: GenResult | null) => void; fail: (e: unknown) => void }>();
  let broken: unknown = null;
  const failAll = (e: unknown): void => {
    broken = e ?? new Error('generator worker failed');
    for (const w of waiting.values()) w.fail(broken);
    waiting.clear();
  };
  worker.onmessage = (e: MessageEvent<{ id: number; gen: GenResult | null }>) => {
    waiting.get(e.data.id)?.ok(e.data.gen);
    waiting.delete(e.data.id);
  };
  worker.onerror = (e) => failAll(e);
  return {
    generate: (job) =>
      new Promise((ok, fail) => {
        if (broken) return fail(broken);
        const id = next++;
        waiting.set(id, { ok, fail });
        worker.postMessage({ id, ...job } satisfies GenRequest);
      }),
  };
}
