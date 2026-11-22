import { Rng } from '../rng';
import type { ModuleDef, ShipTemplate } from '../registry';
import { templateHullLoad } from '../ftl/capacity';
import type { PlacedContainer } from './containerCells';
import { stockOf, toTemplate } from './fitted';
import { fitOut, type FinishOpts } from './fitOut';
import { layoutMetrics, metricViolation } from './metrics';
import { openBareDocks } from './openDocks';
import { hullChoices, pickWeighted, type RoomSpec, type ShipPlan } from './plan';
import { validateTemplate } from './validate';
import type { ArchetypeId, FactionDef, GenResult, GenRoom, HullFamilyDef, RoomRole, ShipRoleDef } from './types';

/*
 * What the ship generators share (the arranger in generate.ts, the outline navy in assembly/outlineShip.ts, the station
 * assembly): the seed of each attempt, the hull family a seed builds, and the back half of an attempt (`fitShell`).
 */

/** Seed for attempt `n` of `seed` (shared with the station generator). */
export const seedOf = (seed: number, n: number): number => attemptSeed(seed, n);

/** Seed for attempt `n` of `seed`. */
const attemptSeed = (seed: number, n: number): number => (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(n, 0xc2b2ae35)) >>> 0;

/** The hull family (or ship role) a seed builds: the first draw of its first attempt. */
export const seedHull = (f: FactionDef, seed: number, depth: number): HullFamilyDef | ShipRoleDef => pickWeighted(new Rng(attemptSeed(seed, 0)), hullChoices(f, depth));

/** The hull family (or ship role) id a seed builds, without building anything: every attempt builds the same one (`hullOf`). */
export const previewHull = (f: FactionDef, seed: number, depth: number): string => seedHull(f, seed, depth).id;

/** The hull family a generated ship was built as (what `previewHull` foretold): its role, unless it names its family apart. */
export const builtFamily = (g: Pick<GenResult, 'role' | 'family'>): string => g.family ?? g.role;

/** What a hull's problem begins with when its engines cannot carry it. */
export const CAPACITY_PROBLEM = 'engines carry';

/** Engines a hull lacks to carry itself (`templateHullLoad`), at the capacity of the engines it has; 0 when it fits. */
export function enginesShort(defs: Record<string, ModuleDef>, t: Pick<ShipTemplate, 'rows' | 'modules'>): number {
  const load = templateHullLoad(defs, t);
  return load.over > 0 && load.engines > 0 ? Math.ceil(load.over / (load.capacity / load.engines)) : 0;
}

/** A built structure, cropped: its tiles, the room of each floor tile, and each room's role and planned contents. */
export interface Shell {
  rows: string[];
  roomOf: Int16Array;
  width: number;
  height: number;
  roles: RoomRole[];
  specs: (RoomSpec | undefined)[];
  /** Cargo containers standing outside the hull, already placed. */
  containers?: readonly PlacedContainer[];
}

/**
 * Fit a shell out, make the template, validate it and take metrics. The arranger's structures come here through
 * `finishLayout`; the station assembly (`assembly/station.ts`) hands its shell over directly.
 */
export function fitShell(
  rng: Rng, f: FactionDef, factionId: string, seed: number, role: ShipRoleDef, archetype: ArchetypeId, plan: Pick<ShipPlan, 'crew'>, shell: Shell,
  topology: string, defs: Record<string, ModuleDef>, n: number, opts: FinishOpts = {},
  debug?: (hall: (x: number, y: number) => boolean) => GenResult['debug'],
): GenResult {
  const { rows, roomOf, width, height, roles, specs } = shell;
  const d = fitOut(rng, f, rows, roomOf, roles, specs, defs, opts);
  // Airlock-only docks open into the corridor they border (wall and door go; openDocks.ts).
  const opened = d.error ? { merged: 0, walled: 0, tiles: [] } : openBareDocks(d.lay);
  const docks = { merged: opened.merged, walled: opened.walled };
  const dockTile = new Set(opened.tiles);
  const fitted = opened.merged > 0 ? rows.map((r, y) => d.lay.cells.slice(y * d.lay.w, y * d.lay.w + r.length).join('')) : rows;
  const template = toTemplate(f, role, factionId, seed, plan, fitted, d);
  // Modules standing apart (entered from their own rooms, or cabled on the ground as such): each structure is checked on its own.
  if ((opts.entries?.size ?? 0) > 0 || (opts.ground?.apart?.length ?? 0) > 0) template.apart = true;
  template.modules = [...(template.modules ?? []), ...(shell.containers ?? []).map((k) => ({ ...k, ...stockOf(rng, f, defs[k.def]) }))];
  const problems = d.error ? [d.error] : validateTemplate(template, defs, opts.immobile ? { immobile: true } : {});
  if (problems.length === 0 && opts.check) problems.push(...opts.check(template, defs));
  // A generated ship that jumps carries its hull on its engines (ftl/capacity.ts), as the player's does (#129). Hand-drawn hulls are not held to it.
  const load = opts.immobile ? null : templateHullLoad(defs, template);
  if (problems.length === 0 && load && load.over > 0) problems.push(`${CAPACITY_PROBLEM} ${load.capacity} of ${load.tiles} tiles`);
  const hall = (x: number, y: number): boolean => roles[roomOf[y * width + x] ?? -1] === 'hall' && !dockTile.has(y * width + x);
  const metrics = layoutMetrics(template, hall, defs);
  const bad = metricViolation(metrics, f.metrics);
  if (bad && problems.length === 0) problems.push(bad);
  const rooms: GenRoom[] = roles.map((r, id) => ({ id, role: r, tiles: d.lay.roomTiles(id) }));
  return {
    template, rooms, roomOf, width, height, role: role.id, archetype, topology, attempts: n + 1, problems, failures: [], metrics, docks,
    ...(debug ? { debug: debug(hall) } : {}),
  };
}
