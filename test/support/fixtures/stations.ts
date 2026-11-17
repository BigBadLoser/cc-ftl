import { expect } from 'vitest';
import type { ModuleDef } from '../../../src/sim/registry';
import { buildStation } from '../../../src/sim/shipgen/stationBuild';
import type { StationResult } from '../../../src/sim/shipgen/assembly/station';
import { docksOf } from '../../../src/sim/shipgen/stationCrew';
import type { StationDef, StationSize } from '../../../src/sim/shipgen/stationTypes';
import { structureParts } from '../../../src/sim/shipgen/validate';
import { content } from '../content';
import { stations } from '../../../src/content/stations';
import { fileCache } from '../cache';

/** Station generation checks shared by the fast tests (one seed) and the slow sweeps (the other seeds). */
export type StationId = keyof typeof stations;
export const stationIds = Object.keys(stations) as StationId[];
export const defs = content.modules as Record<string, ModuleDef>;

const cache = fileCache<string, StationResult>();
/** A built station, once per (kind, size, seed) per test file. Read-only: never mutate the result. */
export function gen(id: StationId, size: StationSize, seed: number): StationResult {
  const k = `${id} ${size} ${seed}`;
  let hit = cache.get(k);
  if (!hit) cache.set(k, (hit = buildStation(stations[id] as StationDef, id, size, seed, defs)));
  return hit;
}
export const count = (g: StationResult, id: string): number => (g.template.modules ?? []).filter((m) => m.def === id).length;
export const countBy = (g: StationResult, pred: (d: ModuleDef) => boolean): number =>
  (g.template.modules ?? []).filter((m) => defs[m.def] && pred(defs[m.def] as ModuleDef)).length;

/** A research station is valid, with labs and the workshop bench and no engines. */
export function expectResearch(size: StationSize, seed: number): void {
  const g = gen('station.research', size, seed);
  const label = `${size} ${seed}`;
  expect(g.problems, label).toEqual([]);
  expect(g.station.kind, label).toBe('research');
  expect(count(g, 'module.research'), label).toBeGreaterThan(0);
  expect(count(g, 'module.fabricator'), label).toBeGreaterThan(0);
  expect(countBy(g, (d) => !!d.engine), label).toBe(0);
  expect(g.station.docks, label).toBeGreaterThanOrEqual(docksOf(stations['station.research'], size));
}

/** One valid structure with docks and no engines. */
export function expectBuilt(id: StationId, size: StationSize, seed: number): void {
  const g = gen(id, size, seed);
  const label = `${id} ${size}`;
  expect(g.problems, label).toEqual([]);
  expect(g.topology, label).toMatch(/^assembly /);
  const w = Math.max(...g.template.rows.map((r) => r.length));
  const cells = g.template.rows.flatMap((r) => Array.from({ length: w }, (_, x) => r[x] ?? '.'));
  expect(structureParts(cells, w, g.template.rows.length), label).toBe(1);
  expect(countBy(g, (d) => !!d.engine), label).toBe(0);
  expect(g.station.docks, label).toBeGreaterThanOrEqual(docksOf(stations[id], size));
}

/** Hubs are much bigger than any ship and outposts are the smallest (built tiles, not the bounding box: spines have long thin outlines). */
export function expectSizes(id: StationId, seed: number): void {
  const small = gen(id, 'outpost', seed);
  const hub = gen(id, 'hub', seed);
  const filled = (g: StationResult): number => g.template.rows.join('').replace(/\./g, '').length;
  expect(filled(hub), id).toBeGreaterThan(1.5 * filled(small));
  expect(filled(gen(id, 'station', seed)), id).toBeGreaterThan(filled(small));
  expect(Math.max(hub.width, hub.height), id).toBeGreaterThan(70);
}

/** Walls are one tile thick; returns how many open courts the station has. */
export function wallsAndCourts(id: StationId, size: StationSize, seed: number): number {
  const g = gen(id, size, seed);
  expect(g.metrics?.thickWall ?? 1, `${id} ${size}`).toBeLessThanOrEqual(0.05);
  return g.rooms.filter((r) => r.role === 'plaza' || r.role === 'garden' || r.role === 'drill').length;
}
