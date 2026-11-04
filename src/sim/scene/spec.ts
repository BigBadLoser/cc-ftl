import { previewHull } from '../shipgen';
import { Rng } from '../rng';
import type { Sim } from '../sim';
import { hash32, strHash } from '../galaxy/hash';
import { shipNameFor } from '../galaxy/names';
import { usedNames } from '../galaxy/roster';
import { currentNode } from '../galaxy/state';
import { SEED_TRIES } from '../galaxy/tuning';
import type { Encounter } from '../galaxy/types';
import type { ItemQty } from '../registry';
import { buildDerelict } from './derelicts';
import type { Ambush, AmbushRecipe, Range, SceneDerelict, SceneRecipe, SceneShip, SceneShipRecipe, SceneSpec, Stance } from './types';

/**
 * Scene specs (DESIGN.md "Physical encounters", part b). A story scene is rolled from the world seed, the event id and the hop it was signalled at, so
 * the same signal gives the same scene; it is built when the signal opens (remote actions read it) and saved with it. A fleet encounter's spec is
 * built from its fleet. Ids of the scene's ship descriptors come from `galaxy.nextFleet`, as every fleet ship's does.
 */

const roll = (rng: Rng, r: Range): number => rng.int(r[0], r[1]);

function rollCargo(rng: Rng, c: NonNullable<SceneShipRecipe['cargo']>): ItemQty[] {
  const pool = [...c.pool];
  const out: ItemQty[] = [];
  for (let n = Math.min(roll(rng, c.lines), pool.length); n > 0; n--) {
    const line = pool.splice(rng.int(0, pool.length - 1), 1)[0] as (typeof pool)[number];
    out.push({ item: line.item, count: rng.int(line.min, line.max) });
  }
  return out;
}

/** A generator seed that builds the wanted hull family at this depth (the first of SEED_TRIES that does, else the first tried). */
function seedFor(sim: Sim, r: SceneShipRecipe, depth: number, key: readonly number[]): number {
  const first = hash32(...key, 0) & 0x7fffffff;
  const gen = sim.content.factions?.[r.shipgen];
  if (!r.family || !gen) return first;
  for (let k = 0; k < SEED_TRIES; k++) {
    const s = hash32(...key, k) & 0x7fffffff;
    if (previewHull(gen, s, depth) === r.family) return s;
  }
  return first;
}

/** The ambush skiff's seed roll: trap or honest, what it says, and (a trap, sometimes) the slip that does not add up. Rolled after the ship's other numbers. */
function rollAmbush(rng: Rng, a: AmbushRecipe): { ambush: Ambush; crew: number } {
  const trap = rng.next() < a.chance;
  const slip = rng.next() < 0.7 ? (rng.next() < 0.5 ? 'name' : 'lag') : undefined;
  const crew = roll(rng, trap ? a.crew : [1, 2]);
  const askAfter = roll(rng, a.askAfterSec);
  const talk = trap ? (slip ? a.talk.tells[slip] : a.talk.trap) : a.talk.honest;
  return { crew, ambush: { trap, party: trap ? a.party : 0, talk, ...(trap && slip ? { tell: slip } : {}), askAfter } };
}

function buildShip(sim: Sim, r: SceneShipRecipe, rng: Rng, depth: number, key: readonly number[], used: Set<string>): SceneShip {
  const names = sim.content.galaxy?.factions[r.owner]?.fleet?.names;
  const seed = seedFor(sim, r, depth, key);
  const name = names ? shipNameFor(names, key, used) : undefined;
  const ship: SceneShip = {
    contact: { id: sim.galaxy.nextFleet++, faction: r.owner, shipgen: r.shipgen, seed, depth, since: sim.tick, ...(name ? { name } : {}), size: 'small' },
    stance: r.stance,
  };
  if (r.family) ship.family = r.family;
  if (r.crew) ship.crew = roll(rng, r.crew);
  if (r.cargo) ship.cargo = rollCargo(rng, r.cargo);
  if (r.credits) ship.credits = roll(rng, r.credits);
  if (r.attitude !== undefined) ship.attitude = r.attitude;
  if (r.leaveAfterSec) ship.stay = roll(rng, r.leaveAfterSec);
  if (r.ambush) {
    const a = rollAmbush(rng, r.ambush);
    ship.ambush = a.ambush;
    ship.crew = a.crew;
  }
  return ship;
}

/** The scene a story event's signal is about, for this hop (`galaxy.turn` and `jumps` tell hops apart). */
export function storySpec(sim: Sim, event: string, recipe: SceneRecipe): SceneSpec {
  const g = sim.galaxy;
  const h = hash32(sim.seed, strHash(event), g.turn, g.jumps);
  const rng = new Rng(h);
  const depth = currentNode(sim)?.danger ?? 0;
  const used = usedNames(sim);
  return {
    key: `story:${event}:${h.toString(16)}`,
    persistence: recipe.persistence,
    event,
    ships: (recipe.ships ?? []).map((r, i) => buildShip(sim, r, rng, depth, [h, i], used)),
    derelicts: (recipe.derelicts ?? []).map((r, i) => buildDerelict(sim, r, rng, [h, 0x100 + i])).filter((d): d is SceneDerelict => d !== null),
    timers: (recipe.timers ?? []).map((t) => ({ id: t.id, afterSec: t.afterSec })),
  };
}

/** A fleet encounter as a scene: the fleet's own ships, hostile in a fight, neutral when answering a distress call. */
export function fleetSpec(e: Encounter, stance: Stance): SceneSpec {
  return { key: `fleet:${e.id}`, persistence: 'transient', fleet: { id: e.fleet, stance }, ships: [], derelicts: [], timers: [] };
}
