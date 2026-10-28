import { ShipC } from '../combat/components';
import { attachServices } from '../blackmarket/attach';
import { LAWLESS_DANGER, LESSER_SHARE } from '../blackmarket/tuning';
import { generateAsteroid } from '../asteroids/gen';
import { placedParts, stampAsteroid } from '../asteroids/place';
import { spawnDerelict } from '../combat/derelict';
import { outpostContent } from '../outposts/handlers';
import { generateOutpost, type OutpostKind, type OutpostStyle } from '../outposts/gen';
import { stampOutpost } from '../outposts/stamp';
import { asteroidParts, asteroidGapError, regions, type Place } from '../regions';
import type { StationSize } from '../shipgen/stationTypes';
import type { Sim } from '../sim';
import { spawnStation } from '../stations/spawn';
import { hash32, strHash, unit } from './hash';
import { bindStation } from './marketLive';
import { profileOf } from './market';
import { pickWeighted } from './sector';
import type { Port } from './ports';
import { isHostileFaction } from './standing';
import { nodeOf } from './state';
import type { NodeData } from './types';

/**
 * The real things a node's structures become (node population, see populate.ts). Each spawner makes one structure at a place the layout gives and returns
 * whether it was made; everything about it is a function of the seed it is given. Ships and asteroids are made by the same generators the debug spawners use
 * (`spawnStation`, `generateAsteroid` + `stampAsteroid`, `generateOutpost` + `stampOutpost`, `spawnDerelict`).
 */

const SIZES: readonly StationSize[] = ['outpost', 'station', 'hub'];

/** The station kind (content `station.*`) a station structure is: from its port when it has one, else from its definition and owner. */
export function stationKindOf(sim: Sim, port: Port | undefined, military: boolean, pirate: boolean, research = false): string {
  const stations = sim.content.stations ?? {};
  if (port?.kind === 'den') return 'station.pirate';
  if (port?.kind === 'depot') return 'station.military';
  if (research && !pirate && stations['station.research']) return 'station.research';
  if (port) {
    // A market's trade profile names the station kind it is (trading or farming).
    const profile = profileOf(sim, port);
    const kind = profile ? sim.content.trade?.traders[profile]?.match.faction : undefined;
    if (kind && stations[kind]) return kind;
  }
  return pirate ? 'station.pirate' : military ? 'station.military' : 'station.trading';
}

/** Grow the sector to hold a thing at (x, y) of w x h tiles, with the same margin stations use. */
export function growSector(sim: Sim, x: number, y: number, w: number, h: number): void {
  sim.sector.width = Math.max(sim.sector.width, x + w + 8);
  sim.sector.height = Math.max(sim.sector.height, y + h + 8);
}

/** Only a share of pirate-held and lawless stations are markets (LESSER_SHARE): a seeded roll per station, the rest stay hostile dens. */
export function isMarket(sim: Sim, ship: number): boolean {
  return unit(sim.seed, strHash(String(sim.sector.node)), sim.world.get(ship, ShipC)?.gen?.seed ?? ship, 0xb1ac) < LESSER_SHARE;
}

/**
 * The lesser black-market services (content `bm.lesser`) go to pirate-held stations (a den, or any port of a pirate faction) and to stations no faction holds in
 * lawless space (danger from LAWLESS_DANGER). The three named markets are not placed here: they are attached by the galaxy once they are spawned.
 */
export function attachLesser(sim: Sim, ship: number, port: Port | undefined): void {
  const pirate = !!port && sim.content.galaxy?.factions[port.owner]?.kind === 'pirates';
  const lawless = !port && (nodeOf(sim, sim.galaxy.current)?.danger ?? 0) >= LAWLESS_DANGER;
  if ((pirate || lawless) && isMarket(sim, ship)) attachServices(sim, ship, 'bm.lesser');
}

/** A station for a structure, bound to its port's market. Returns the ship id, or null. */
export function populateStation(sim: Sim, port: Port | undefined, kind: string, size: StationSize, seed: number, at: Place): number | null {
  // A navy depot is hostile only to someone the navy is hostile to: at a standing that is not hostile it is a station you can dock at and trade with
  // (it sells the defence blueprints), crew and all. Pirate dens and the other hostile kinds stay hostile (dormant until provoked).
  const calm = port?.kind === 'depot' && !isHostileFaction(sim, port.owner);
  const r = spawnStation(sim, kind, size, seed, at, undefined, calm ? 'neutral' : undefined);
  if (typeof r === 'string') return null;
  if (port) bindStation(sim, r, port);
  attachLesser(sim, r, port);
  return r;
}

/** An outpost on a big asteroid ('surface': mining; 'dug': a pirate base hidden in the rock), bound to its port's market. */
export function populateOutpost(sim: Sim, port: Port | undefined, style: OutpostStyle, kind: OutpostKind, seed: number, at: Place): boolean {
  const o = generateOutpost(style, seed, outpostContent(sim), kind);
  if (!o) return false;
  const { x, y } = typeof at === 'function' ? at(o.asteroid.w, o.asteroid.h) : at;
  if (asteroidGapError(sim, placedParts(o.asteroid, x, y))) return false;
  growSector(sim, x, y, o.asteroid.w, o.asteroid.h);
  const ids = stampOutpost(sim, o, x, y);
  if (port) bindStation(sim, ids.ship, port);
  attachLesser(sim, ids.ship, port);
  return true;
}

/** A field of loose rocks. */
export function populateField(sim: Sim, seed: number, at: Place): boolean {
  const plan = generateAsteroid('field', seed, Object.values(sim.content.ores ?? {}) as Parameters<typeof generateAsteroid>[2]);
  const { x, y } = typeof at === 'function' ? at(plan.w, plan.h) : at;
  if (asteroidGapError(sim, placedParts(plan, x, y))) return false;
  growSector(sim, x, y, plan.w, plan.h);
  stampAsteroid(sim, plan, x, y);
  return true;
}

/** The generator faction (`faction.*`) a derelict was built by: the node's own faction's ships, else any non-rogue faction's, picked by hash. */
export function derelictShipgen(sim: Sim, node: NodeData, seed: number): string | null {
  const factions = sim.content.galaxy?.factions ?? {};
  const own = node.faction ? factions[node.faction]?.ships : undefined;
  const pool = own?.length
    ? own
    : Object.keys(factions).sort().filter((id) => factions[id]?.kind !== 'rogue').flatMap((id) => factions[id]?.ships ?? []);
  return pickWeighted(pool, unit(seed, 83));
}

/** A derelict wreck; a drone nest is a heavily ruined one of the rogue AI's make (infested with robots). */
export function populateDerelict(sim: Sim, node: NodeData, nest: boolean, seed: number, at: Place): boolean {
  // A nest stands in rogue space, so the node's own faction (the rogue AI) builds it.
  const faction = derelictShipgen(sim, node, seed);
  if (!faction) return false;
  const intensity = nest ? 0.7 : 0.3 + 0.45 * unit(seed, 84);
  const r = spawnDerelict(sim, { faction, depth: node.danger, seed, at, intensity, cause: nest || unit(seed, 85) < 0.5 ? 'combat' : 'decay' });
  return typeof r !== 'string';
}

/** East edge (tile) of everything in the sector: ships, stations and asteroids. */
export function eastEdge(sim: Sim): number {
  let east = 0;
  for (const r of regions(sim)) east = Math.max(east, r.bbox.x + r.bbox.w);
  for (const p of asteroidParts(sim)) east = Math.max(east, p.x + p.w);
  return east;
}

export const structureSeed = (sim: Sim, node: string, index: number, salt: number): number => hash32(sim.seed, strHash(node), index, salt);
export const sizeOf = (port: Port | undefined): StationSize => SIZES[(port?.size ?? 2) - 1] as StationSize;
