/// <reference lib="webworker" />
import { content } from '../content';
import { galaxyGen } from '../sim/galaxy/generator';
import { warmOutlines } from './starmapClusters';

/** The galaxy prefetch's side of the worker (galaxyPrefetch.ts): one chunk and its sector outlines per message, on the worker's own generator. */
export interface ChunkRequest {
  id: number;
  seed: number;
  cx: number;
  cy: number;
}

self.onmessage = (e: MessageEvent<ChunkRequest>) => {
  const { id, seed, cx, cy } = e.data;
  try {
    const chunk = galaxyGen(seed, content.galaxy).chunk(cx, cy);
    self.postMessage({ id, chunk, outlines: warmOutlines(chunk) });
  } catch {
    self.postMessage({ id, chunk: null, outlines: [] });
  }
};
