/**
 * Runs roof damage paints (paint.ts) on one shared worker, so a repaint never stalls a frame. Where a worker cannot start
 * the paint runs on the main thread a tick later instead.
 */
import type { RoofHit, Window } from './hits';
import { paintRoofDamage, type RoofLayers } from './paint';

export interface PaintJob {
  win: Window;
  layers: RoofLayers;
  hits: RoofHit[];
}

/** Called with the overlay, or null if the worker failed and the job is lost (the caller asks again). */
export type PaintDone = (out: Uint8ClampedArray | null) => void;

let worker: Worker | null | undefined;
const waiting = new Map<number, PaintDone>();
let nextId = 1;

function start(): Worker | null {
  try {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ id: number; out: Uint8ClampedArray }>) => {
      const done = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      done?.(e.data.out);
    };
    w.onerror = (e) => {
      console.error('roof damage worker failed; painting on the main thread', e.message);
      w.terminate();
      worker = null;
      const lost = [...waiting.values()];
      waiting.clear();
      for (const done of lost) done(null);
    };
    return w;
  } catch {
    return null;
  }
}

/** Paint a window; `done` gets its overlay later (its buffers are handed over: the caller must not reuse them). */
export function paintLater(job: PaintJob, done: PaintDone): void {
  if (worker === undefined) worker = typeof Worker === 'undefined' ? null : start();
  if (!worker) {
    setTimeout(() => done(paintRoofDamage(job.win, job.layers, job.hits)), 0);
    return;
  }
  const id = nextId++;
  waiting.set(id, done);
  const { win, layers } = job;
  worker.postMessage({ id, ...job }, [win.roof.buffer, layers.plate.buffer, layers.struct.buffer, layers.bare.buffer]);
}
