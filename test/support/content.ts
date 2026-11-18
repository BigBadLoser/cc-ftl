import { galaxyGen } from '../../src/sim/galaxy/generator';
import { newGame } from '../../src/sim/newGame';
import type { ChunkData } from '../../src/sim/galaxy/types';
import { content } from '../../src/content';
import { cachedWorld } from './world';
import { fileCache } from './cache';

/** The only test support module that may import `content` (sim tests cannot, so they never import this one). */
export { content };

/** A fresh independent copy of `newGame(seed, content)`, built once per test file. Use it where a test only needs the starting game. */
export const cachedNewGame = (seed: number): ReturnType<typeof newGame> => cachedWorld(`newGame:${seed}`, () => newGame(seed, content));

const edited = fileCache<string, typeof content>();

/**
 * `content` whose generated galaxy for `seed` has `edit` applied to every chunk it makes. Generated chunks are shared and frozen in a
 * worker, so a test never assigns to a node or a hyperlane; it plays on this copy instead (own generator, built once per (seed, key):
 * `key` names the edit, so two different edits need two keys).
 */
export function contentEdited(seed: number, key: string, edit: (chunk: ChunkData) => void): typeof content {
  const id = `${seed}:${key}`;
  let own = edited.get(id);
  if (!own) {
    own = { ...content, galaxy: { ...content.galaxy } };
    const gen = galaxyGen(seed, own.galaxy);
    const real = gen.chunk.bind(gen);
    const mine = new Map<string, ChunkData>();
    gen.chunk = (cx, cy) => {
      let d = mine.get(`${cx},${cy}`);
      if (!d) {
        d = structuredClone(real(cx, cy)); // an unfrozen private copy
        edit(d);
        mine.set(`${cx},${cy}`, d);
      }
      return d;
    };
    edited.set(id, own);
  }
  return own;
}

/** `content` whose galaxy for `seed` has every node at danger tier `danger`. */
export const contentAtDanger = (seed: number, danger: number): typeof content =>
  contentEdited(seed, `danger:${danger}`, (c) => { for (const n of c.nodes) n.danger = danger; });
