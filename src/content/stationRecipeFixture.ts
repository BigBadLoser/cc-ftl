import { Rng, assemble, hullProblems, stationProgram, type Assembly, type ModuleDef, type Recipe, type RoomSpec, type StationDef, type StationSize } from '../sim';
import { seedOf } from '../sim/shipgen/generate';
import { content } from './index';
import { stations } from './stations';

/** Shared by the station recipe tests: a station kind's rooms for a seed, assembled by a recipe, and what must hold of the result. */

const defs = content.modules as Record<string, ModuleDef>;

export function programOf(kind: keyof typeof stations, size: StationSize, seed: number): { rng: Rng; rooms: RoomSpec[] } {
  const rng = new Rng(seedOf(seed, 0));
  return { rng, rooms: stationProgram(rng, stations[kind] as StationDef, size, defs) };
}

const beds = (rooms: readonly (RoomSpec | undefined)[]): number => rooms.reduce((n, r) => n + (r?.role === 'quarters' ? r.mods.filter((m) => m === 'module.bed').length : 0), 0);

/** What is wrong with an assembly of `rooms` (empty when it stands as it must). */
export function problemsOf(a: Assembly | null, rooms: readonly RoomSpec[], rejected: readonly string[]): string[] {
  if (!a) return [`rejected: ${rejected.join('; ')}`];
  const g = a.ctx.g, snap = g.snapshot(), out: string[] = [];
  const at = (x: number, y: number): string => snap.rows[y]?.[x] ?? '.';
  for (let y = 0; y + 1 < snap.height; y++) for (let x = 0; x + 1 < snap.width; x++) {
    if (at(x, y) === '#' && at(x + 1, y) === '#' && at(x, y + 1) === '#' && at(x + 1, y + 1) === '#') out.push(`solid 2x2 wall at ${x},${y}`);
  }
  // Beams are open structure: for the hull they are space.
  out.push(...hullProblems({ rows: snap.rows.map((r) => r.replace(/=/g, '.')) }));
  const floored = new Set<number>(snap.roomOf);
  const standing = g.regions.filter((r, id) => !r.hall && floored.has(id)).map((r) => r.spec);
  for (const role of new Set(rooms.map((r) => r.role))) {
    if (role === 'quarters') continue;
    const want = rooms.filter((r) => r.role === role).length, have = standing.filter((r) => r?.role === role).length;
    if (have < want) out.push(`${role}: ${have} of ${want} stand`);
  }
  if (beds(standing) < beds(rooms)) out.push(`beds: ${beds(standing)} of ${beds(rooms)} stand`);
  if (g.stranded().length > 0) out.push('floor that cannot be walked to');
  return out;
}

export function assembled(recipe: Recipe, kind: keyof typeof stations, size: StationSize, seed: number): string[] {
  const { rng, rooms } = programOf(kind, size, seed);
  const { ok, rejected } = assemble(rng, recipe, rooms);
  return problemsOf(ok, rooms, rejected);
}
