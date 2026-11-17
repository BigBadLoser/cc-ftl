import { newGame } from '../../src/sim';
import { content } from '../../src/content';
import { cachedWorld } from './world';

/** The only test support module that may import `content` (sim tests cannot, so they never import this one). */
export { content };

/** A fresh independent copy of `newGame(seed, content)`, built once per worker. Use it where a test only needs the starting game. */
export const cachedNewGame = (seed: number): ReturnType<typeof newGame> => cachedWorld(`newGame:${seed}`, () => newGame(seed, content));
