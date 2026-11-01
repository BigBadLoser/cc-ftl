/**
 * Room-layout audit of generated ships and stations (dev tool, not game code): flow, rooms reached only through other
 * rooms, empty rooms, crew-scaled sizes and slack for the larger module tiers. `node tools/shipgen/audit-cli.js` runs it
 * (auditRun.ts); the `interior` sheet view outlines the rooms it flags.
 */
import { content } from '../../src/content';
import { footprintTiles, type GenResult, type ModuleDef, type RoomRole } from '../../src/sim';

const defs = content.modules as Record<string, ModuleDef>;

/**
 * Rooms that must be reachable from the docks without walking through crew quarters: command, engineering, storage and
 * the systems crew tend. Gun bays stand on the hull wherever it is free; one entered through another room counts under
 * `behind`.
 */
const KEY: readonly RoomRole[] = ['bridge', 'reactor', 'engine', 'cargo', 'shields', 'core', 'armoury', 'hangar'];
/** Rooms anyone may walk through: corridors, airlocks and open courtyards. */
const PASS: readonly RoomRole[] = ['hall', 'dock', 'plaza', 'garden', 'drill'];

export interface Audit {
  /** Key rooms only reachable through quarters. */
  viaQuarters: string[];
  /** Rooms (not corridors) reachable only by walking through another room. */
  behind: string[];
  /** Rooms with nothing but lights in them. */
  empty: string[];
  /** Crew-scaled shortfalls (beds, mess seats). */
  short: string[];
  /** Reactor and shield rooms too small for the Mk III module and a walkway to it (2x4 reactor, 3x3 shield). */
  tight: string[];
  /** Rooms with no door at all (drone pods are sealed on purpose; elsewhere it is a bug). */
  sealed: string[];
}

export function audit(g: GenResult): Audit {
  const W = g.width;
  const rows = g.template.rows;
  const at = (x: number, y: number): string => rows[y]?.[x] ?? '.';
  const roomAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= g.height ? -1 : (g.roomOf[y * W + x] ?? -1));
  const role = (r: number): RoomRole | undefined => g.rooms[r]?.role;
  // Room graph through doors: a door joins the rooms on its two open sides.
  const adj = new Map<number, Set<number>>();
  const link = (a: number, b: number): void => {
    if (a < 0 || b < 0 || a === b) return;
    (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b);
    (adj.get(b) ?? adj.set(b, new Set()).get(b)!).add(a);
  };
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < W; x++) {
      if (at(x, y) !== 'D') continue;
      link(roomAt(x - 1, y), roomAt(x + 1, y));
      link(roomAt(x, y - 1), roomAt(x, y + 1));
    }
  }
  // Modules per room (by the room under each footprint tile).
  const mods = new Map<number, string[]>();
  for (const m of g.template.modules ?? []) {
    const d = defs[m.def];
    if (!d) continue;
    const rs = new Set(footprintTiles(d, m.x, m.y, m.rot).map((t) => roomAt(t.x, t.y)).filter((r) => r >= 0));
    for (const r of rs) (mods.get(r) ?? mods.set(r, []).get(r)!).push(m.def);
  }
  const entries = g.rooms.filter((r) => r.role === 'dock' || (mods.get(r.id) ?? []).some((m) => defs[m]?.airlock)).map((r) => r.id);
  // Walk from the docks: through rooms of the kinds in `through`, into (but not through) any other room.
  const reach = (through: (r: number) => boolean): Set<number> => {
    const seen = new Set(entries);
    const queue = [...entries];
    while (queue.length > 0) {
      const r = queue.shift() as number;
      if (!entries.includes(r) && !through(r)) continue;
      for (const n of adj.get(r) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
    return seen;
  };
  const name = (r: number): string => `${role(r)}#${r}`;
  const doored = g.rooms.filter((r) => r.role !== 'hall' && r.tiles.length > 0);
  const real = doored.filter((r) => (adj.get(r.id)?.size ?? 0) > 0);
  const noQuarters = reach((r) => role(r) !== 'quarters');
  const corridorsOnly = reach((r) => PASS.includes(role(r) as RoomRole));
  const crew = (g.template.crew ?? []).length;
  const count = (pred: (d: ModuleDef, id: string) => boolean): number =>
    (g.template.modules ?? []).filter((m) => defs[m.def] && pred(defs[m.def] as ModuleDef, m.def)).length;
  const beds = count((_, id) => id === 'module.bed');
  const seats = count((_, id) => /chair|bench|seat|stool/.test(id));
  const short: string[] = [];
  if (crew > 0 && beds > 0 && beds < crew) short.push(`beds ${beds} < crew ${crew}`);
  if (crew > 0 && g.rooms.some((r) => r.role === 'support') && seats < Math.ceil(crew / 3)) short.push(`seats ${seats} < crew/3 (${crew})`);
  const dims = (r: { tiles: number[] }): [number, number] => {
    const xs = r.tiles.map((i) => i % W);
    const ys = r.tiles.map((i) => Math.floor(i / W));
    return [Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1];
  };
  const fits = (r: { tiles: number[] }, a: number, b: number): boolean => {
    const [w, h] = dims(r);
    return (w >= a && h >= b) || (w >= b && h >= a);
  };
  return {
    viaQuarters: real.filter((r) => KEY.includes(r.role) && !noQuarters.has(r.id) && entries.length > 0).map((r) => name(r.id)),
    behind: real.filter((r) => !PASS.includes(r.role) && !corridorsOnly.has(r.id) && entries.length > 0).map((r) => name(r.id)),
    empty: real.filter((r) => !PASS.includes(r.role) && (mods.get(r.id) ?? []).every((m) => m === 'module.light')).map((r) => name(r.id)),
    short,
    tight: doored.filter((r) => (r.role === 'reactor' && !fits(r, 3, 4)) || (r.role === 'shields' && !fits(r, 4, 3))).map((r) => name(r.id)),
    sealed: doored.filter((r) => (adj.get(r.id)?.size ?? 0) === 0 && !entries.includes(r.id)).map((r) => name(r.id)),
  };
}
