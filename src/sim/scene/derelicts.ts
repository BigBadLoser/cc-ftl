import { planDerelict, spawnDerelict } from '../combat/derelict';
import { freeSpot } from '../galaxy/arrivals';
import { hash32 } from '../galaxy/hash';
import { derelictShipgen } from '../galaxy/populateSpawn';
import { currentNode } from '../galaxy/state';
import { SEED_TRIES } from '../galaxy/tuning';
import type { Rng } from '../rng';
import { hostileAboard } from '../salvage/system';
import type { RuinMeta } from '../shipgen/ruinTypes';
import type { Sim } from '../sim';
import type { DerelictRead, SceneDerelict, SceneDerelictRecipe } from './types';

/**
 * A scene's derelicts (DESIGN.md "Physical encounters", the derelict): rolled from the scene seed like its ships, made by the derelict generator
 * (`planDerelict` / `spawnDerelict`). The ruin pass sets every condition of the hull (air, fires, jammed doors, loot, torn-off containers, who moved
 * in); the spec only keeps the generator inputs and what a scan can read from outside.
 */

/** What sensors read off a ruin pass from outside: shares and kinds, the view words them. */
function readOf(meta: RuinMeta): DerelictRead {
  const hp = meta.modules.length ? meta.modules.reduce((n, m) => n + m.hp, 0) / meta.modules.length : 0;
  const tiles = meta.rooms.reduce((n, r) => n + r.tiles.length, 0);
  const open = meta.rooms.reduce((n, r) => n + (r.air === 'vacuum' ? r.tiles.length : 0), 0);
  return {
    ruin: Math.round((1 - hp) * 100) / 100,
    cause: meta.cause,
    vacuum: tiles ? Math.round((open / tiles) * 100) / 100 : 1,
    fires: meta.fires.length,
    jammed: meta.doors.filter((d) => d.state === 'stuckShut').length,
    sacs: meta.hooks.filter((h) => h.kind === 'eggsac' || h.kind === 'nest').length,
    machines: meta.hooks.filter((h) => h.kind === 'robotSpawn').length,
    containers: (meta.containers ?? []).filter((k) => k.fate === 'torn').length,
  };
}

/**
 * One derelict of a story scene. The hull's generator faction is the recipe's, else the node's (as a node's derelicts); the seed is the first of
 * SEED_TRIES that gives a layout. Null when none does (the scene goes on without it).
 */
export function buildDerelict(sim: Sim, r: SceneDerelictRecipe, rng: Rng, key: readonly number[]): SceneDerelict | null {
  const node = currentNode(sim);
  const depth = node?.danger ?? 0;
  const intensity = Math.round((r.intensity[0] + rng.next() * (r.intensity[1] - r.intensity[0])) * 100) / 100;
  const cause = r.causes[rng.int(0, r.causes.length - 1)] ?? 'decay';
  const infested = rng.chance(r.infested);
  for (let k = 0; k < SEED_TRIES; k++) {
    const seed = hash32(...key, k) & 0x7fffffff;
    const shipgen = r.shipgen ?? (node ? derelictShipgen(sim, node, seed) : null);
    if (!shipgen) return null;
    const living = !!sim.content.factions?.[shipgen]?.living;
    const infest = !infested ? 'none' : living ? 'alien' : 'robot';
    const plan = planDerelict(sim, { faction: shipgen, depth, seed, intensity, cause, ...(infest === 'none' ? { infest } : {}) });
    if (typeof plan === 'string') continue;
    return { id: sim.galaxy.nextFleet++, shipgen, seed, depth, intensity, cause, infest, name: plan.template.name, read: readOf(plan.meta) };
  }
  return null;
}

/** Make a scene derelict real beside where the player's ship comes in (false: no room yet, retried by `tendScene`). */
export function spawnSceneDerelict(sim: Sim, d: SceneDerelict): boolean {
  const at = (w: number, h: number) => freeSpot(sim, w, h) ?? { x: -1, y: -1 };
  const id = spawnDerelict(sim, { faction: d.shipgen, depth: d.depth, seed: d.seed, at, intensity: d.intensity, cause: d.cause, ...(d.infest === 'none' ? { infest: 'none' as const } : {}) });
  if (typeof id === 'string') return false;
  d.ship = id;
  if (hostileAboard(sim, id)) d.infested = true;
  return true;
}
