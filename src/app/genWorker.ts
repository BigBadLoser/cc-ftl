/// <reference lib="webworker" />
import { content } from '../content';
import { generateShip } from '../sim/shipgen/generate';
import type { FactionDef } from '../sim/shipgen/types';

/** The ship generator's side of `workerGenerator` (genRunner.ts): one `generateShip` per message, on the worker's own copy of the content. */
export interface GenRequest {
  id: number;
  shipgen: string;
  seed: number;
  depth: number;
}

self.onmessage = (e: MessageEvent<GenRequest>) => {
  const { id, shipgen, seed, depth } = e.data;
  const def = (content.factions as Readonly<Record<string, FactionDef>> | undefined)?.[shipgen];
  let gen = null;
  try {
    gen = def ? generateShip(def, shipgen, seed, depth, content.modules) : null;
  } catch {
    gen = null;
  }
  self.postMessage({ id, gen });
};
