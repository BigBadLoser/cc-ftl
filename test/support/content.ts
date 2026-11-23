import { galaxyGen } from '../../src/sim/galaxy/generator';
import { newGame } from '../../src/sim/newGame';
import type { ChunkData, Fleet } from '../../src/sim/galaxy/types';
import { materialiseFleet } from '../../src/sim/galaxy/fleetShips';
import type { Sim } from '../../src/sim/sim';
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

/** Fights between NPC fleets in the player's node (#603): fleets set up in place, for the tests of those fights. */

/** A one-ship fleet of `faction` parked in the player's node (it goes nowhere), cloned from the start's first patrol. */
export function fleetHere(sim: Sim, faction: string, role: Fleet['role'], id: number): Fleet {
  const proto = sim.galaxy.fleets.find((f) => f.role === 'patrol') as Fleet;
  const shipgen = (content.galaxy as { factions: Record<string, { ships: { value: string }[] }> }).factions[faction]?.ships[0]?.value as string;
  const node = sim.galaxy.current;
  const ship = { ...(proto.ships[0] as Fleet['ships'][number]), id: sim.galaxy.nextFleet++, faction, shipgen, seed: 1000 + id, size: 'small' as const, name: `${faction} ${role}` };
  delete ship.ship;
  return { ...proto, id, faction, role, ships: [ship], node, from: node, dest: node, route: [], dwell: 99999, legs: 0, moved: -1, synced: sim.galaxy.turn, cargo: [] };
}

/** A new game with two fleets in the player's node, made real; `reputation` (the player's, by reputation key) is set before they turn up. */
export function fight(
  a: [string, Fleet['role']] = ['meridian', 'patrol'], b: [string, Fleet['role']] = ['helix', 'patrol'], reputation: Record<string, number> = {},
): { sim: Sim; fa: Fleet; fb: Fleet } {
  const sim = newGame(21, content);
  sim.story.goals.skipped = true; // no opening grace
  Object.assign(sim.story.reputation, reputation);
  const fa = fleetHere(sim, a[0], a[1], 9001);
  const fb = fleetHere(sim, b[0], b[1], 9002);
  sim.galaxy.fleets = [fa, fb];
  materialiseFleet(sim, fa);
  materialiseFleet(sim, fb);
  return { sim, fa, fb };
}

export const shipOf = (f: Fleet): number => f.ships[0]?.ship as number;
