/** Shared checks of the ship generator's faction motifs, for the fast shipgen core test and its slow seed sweep. */
import { expect } from 'vitest';
import { factions } from '../../../src/content/factions';
import type { ModuleDef } from '../../../src/sim/registry';
import { generateShip } from '../../../src/sim/shipgen/generate';
import type { FactionDef, GenResult } from '../../../src/sim/shipgen/types';
import { content } from '../content';

export const defs = content.modules as Record<string, ModuleDef>;
export type FactionId = keyof typeof factions;
export const factionIds = Object.keys(factions) as FactionId[];
export const gen = (id: FactionId, seed: number, depth: number): GenResult => generateShip(factions[id] as FactionDef, id, seed, depth, defs);
/** The navy as the arranger builds it, before the game drew navy hulls outline first (#581). */
const arrangerNavy: FactionDef = { ...(factions['faction.navy'] as FactionDef) };
delete arrangerNavy.outline;
const count = (g: GenResult, pred: (d: ModuleDef) => boolean): number =>
  (g.template.modules ?? []).filter((m) => defs[m.def] && pred(defs[m.def] as ModuleDef)).length;

/** Drones, scrapper and navy (the game's, and the arranger's) keep their motif on each seed (at depth seed % 10). */
export function expectMotifs(seeds: Iterable<number>): void {
  for (const seed of seeds) {
    const d = gen('faction.drones', seed, seed % 10);
    expect(count(d, (m) => !!m.bed || !!m.o2PerSec)).toBe(0);
    expect(count(d, (m) => !!m.aiCore)).toBe(1);
    const s = gen('faction.scrapper', seed, seed % 10);
    expect(count(s, (m) => !!m.vehicleBay)).toBe(1);
    expect(s.template.boarding).toBeDefined();
    expect(count(s, (m) => !!m.storage)).toBeGreaterThanOrEqual(5);
    // The game's navy hulls are drawn outline first (#581): the outline mirrors about the axis, but for a tile or two where
    // a room's wall meets a taper on one side only.
    const v = gen('faction.navy', seed, seed % 10).template.rows.map((r) => r.replace(/[^.]/g, '#'));
    const off = v.reduce((t, r, y) => t + [...r].filter((ch, x) => (v[v.length - 1 - y]?.[x] ?? '.') !== ch).length, 0);
    expect(off, `navy seed ${seed} outline is mirror-symmetric`).toBeLessThanOrEqual(4);
    const n = generateShip(arrangerNavy, 'faction.navy', seed, seed % 10, defs);
    // The arranger's navy hulls are mirrored (doors aside), except the carrier's offset island; staggered gun mounts may break it,
    // so any mismatch must lie inside a mount (or its mirror image).
    const dbg = n.debug!;
    const mounts = dbg.assemblies.filter((a) => a.kind === 'mount' || a.kind === 'plate');
    const inMount = (x: number, y: number): boolean => mounts.some((a) => x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h);
    const rows = n.template.rows.map((r) => r.replace(/D/g, '#'));
    // Mirror about the root assembly's axis (asymmetric mounts shift the crop).
    const r0 = dbg.assemblies[0]!;
    const m = (y: number): number => 2 * r0.y + r0.h - 1 - y;
    const bad = rows.flatMap((r, y) => [...r].map((ch, x) => ((rows[m(y)]?.[x] ?? '.') !== ch && !inMount(x, y) && !inMount(x, m(y)) ? `${x},${y}` : '')).filter(Boolean));
    if (n.role !== 'carrier') expect(bad, `${n.template.name} hull is mirror-symmetric`).toEqual([]);
  }
}

/** How many of the scrapper's first `n` seeds (depth 4) are not mirror-symmetric top to bottom. */
export function lopsidedScrappers(n: number): number {
  return Array.from({ length: n }, (_, seed) => gen('faction.scrapper', seed, 4).template.rows).filter((rows) => rows.join() !== [...rows].reverse().join()).length;
}
