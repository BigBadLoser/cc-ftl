/// <reference lib="webworker" />
import { content } from '../content';
import { generateShip } from '../sim/shipgen/generate';
import { buildContent, runBuild, type BuildJob, type BuildResult } from '../sim/stations/buildMemo';
import type { FactionDef, GenResult } from '../sim/shipgen/types';

/**
 * The generators' side of `workerGenerator` (genRunner.ts), on the worker's own copy of the content: one job per message, a ship (`generateShip`)
 * or a station or outpost build (`runBuild`, the sim's own build of a job, #538).
 */
export type GenRequest = { id: number } & ({ job: 'ship'; shipgen: string; seed: number; depth: number } | { job: 'build'; build: BuildJob });

/** The answer: a ship (null: it cannot be generated), a build, or `failed` (the build threw; the sim makes it itself and sees the same). */
export type GenReply = { id: number; gen?: GenResult | null; built?: BuildResult; failed?: true };

const built = buildContent(content);

self.onmessage = (e: MessageEvent<GenRequest>) => {
  const req = e.data;
  if (req.job === 'build') {
    let reply: GenReply;
    try {
      reply = { id: req.id, built: runBuild(req.build, built) };
    } catch {
      reply = { id: req.id, failed: true };
    }
    self.postMessage(reply);
    return;
  }
  const def = (content.factions as Readonly<Record<string, FactionDef>> | undefined)?.[req.shipgen];
  let gen = null;
  try {
    gen = def ? generateShip(def, req.shipgen, req.seed, req.depth, content.modules) : null;
  } catch {
    gen = null;
  }
  self.postMessage({ id: req.id, gen } satisfies GenReply);
};
