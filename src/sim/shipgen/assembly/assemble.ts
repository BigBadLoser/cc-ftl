import type { RoomSpec } from '../plan';
import type { Rng } from '../../rng';
import { Asm } from './asm';
import type { BandAsk } from './band';
import { grow } from './branch';
import { deptOf, type Dept } from './dept';
import { corridor } from './elements';
import { brace, missing, trim } from './finish';
import { K, type Site } from './lattice';
import { key, type Ctx, type Dir, type Port } from './model';
import { cabinsOf, house } from './quarters';
import type { Recipe } from './recipe';
import { RegionGrid, SOLID, SPACE } from './regions';
import { fillRing, ringPorts, ringSite } from './ring';

/**
 * The assembler: one procedure for every recipe. It builds the root, then each rule's branches (a neck, then sections
 * in series joined by links), then hangs the docks, then fills a ring root with its rooms. A part is tried at a port and
 * taken back when it does not fit, stands too near something it is not joined to, or builds a thick wall; then the next
 * port is tried. Nothing is searched beyond that.
 *
 * Hard: every room of the program stands somewhere, every dock has a berth it can use, a gated branch is joined by its
 * gate alone. A candidate that fails one is rejected with the reason; nothing is left out quietly.
 */

export interface Assembly {
  ctx: Ctx;
  recipe: Recipe;
  /** A ring root's size. */
  R?: number;
  sections: number;
  corridors: number;
  rooms: number;
  /** Why earlier candidates were rejected. */
  rejected: string[];
}

/** Half the side of the grid a trunk station is assembled on. */
const HALF = 230;
const ANGLE: Record<Dir, number> = { n: 0, e: Math.PI / 2, s: Math.PI, w: (3 * Math.PI) / 2 };

interface Outcome { asm: Asm; why: string }

const tagged = (rooms: readonly RoomSpec[]): RoomSpec[] => rooms.map((r) => (r.dept ? r : { ...r, dept: deptOf(r) }));

function context(g: RegionGrid, s: Site | null, rng: Rng): Ctx {
  const reserved = new Set<number>();
  const inside = (x: number, y: number): boolean => Math.abs(x) < g.half - 4 && Math.abs(y) < g.half - 4;
  const free = (x: number, y: number): boolean => { const o = g.at(x, y); return inside(x, y) && (o === SPACE || o === SOLID) && !reserved.has(key(x, y)); };
  return { g, site: s ?? ({ g, free } as unknown as Site), rng, reserved, free, inside };
}

function tryOnce(rng: Rng, recipe: Recipe, all: readonly RoomSpec[], attempt: number): Outcome & { R?: number } {
  const docks = all.filter((r) => r.role === 'dock'), housed = house(rng, recipe, all.filter((r) => r.role !== 'dock'));
  const rooms = housed.rooms, pool = housed.pool;
  const finish = (a: Asm): void => { trim(a); if (recipe.braces) brace(a, recipe.braces); };
  const takers = new Set<string>([...(recipe.root.kind === 'ring' ? recipe.root.takes : []), ...recipe.branches.flatMap((b) => b.takes)]);
  const orphans = rooms.filter((r) => !takers.has(r.dept as string));
  if (orphans.length > 0) return { asm: new Asm(context(new RegionGrid(8), null, rng), 0), why: `no part of the recipe takes ${[...new Set(orphans.map((r) => r.dept))].join(', ')}` };

  if (recipe.root.kind === 'trunk') {
    const ctx = context(new RegionGrid(HALF), null, rng);
    const a = new Asm(ctx, recipe.spacing);
    // The trunk is as long as its branches are wide, with slack that grows a try at a time.
    const wide = recipe.branches.reduce((n, b) => n + (b.per === 'together' ? 1 : b.takes.length) * 30, 0);
    const L = Math.min(2 * HALF - 24, Math.ceil(((wide + docks.length * 8) * (1 + 0.25 * attempt)) / K) * K + 2 * K);
    const root: Port = { frame: { x: -Math.floor(L / 2), y: 0, dir: 'e' }, kind: 'end', hall: -1, owner: -1, along: 0, side: 0, used: false };
    const made = corridor(ctx, root, { length: L, pitch: K });
    if (!made) return { asm: a, why: 'no trunk' };
    a.corridors++;
    const trunk = a.add(made).filter((p) => p.kind === 'side');
    const why = grow(a, recipe, rooms, docks, trunk, null, pool);
    if (!why) finish(a);
    return { asm: a, why };
  }

  if (recipe.root.kind === 'core') {
    const ctx = context(new RegionGrid(HALF), null, rng);
    const a = new Asm(ctx, recipe.spacing);
    // The centre: a port in open ground, heading east or west as the seed has it, a little off the middle each try.
    const core: Port = { frame: { x: 4 * attempt, y: 0, dir: rng.chance(0.5) ? 'e' : 'w' }, kind: 'end', hall: -1, owner: -1, along: 0, side: 0, used: false };
    const why = grow(a, recipe, rooms, docks, null, core, pool);
    if (!why) finish(a);
    return { asm: a, why };
  }

  const root = recipe.root;
  let why = '';
  for (let cells = 5; cells <= 12; cells++) {
    const R = cells * K;
    const { site, kept } = ringSite({ R, outline: root.outline, cut: root.cut, inner: root.inner, ...(root.gap ? { gap: root.gap } : {}) }, 120);
    const ctx = context(site.g, site, rng);
    const a = new Asm(ctx, recipe.spacing);
    a.add({ ports: ringPorts(site, kept), regions: [site.ring], box: [-R, -R, R, R] });
    // On a ring the single cabins stand in its band with the rest; nothing is scattered.
    why = grow(a, recipe, rooms, docks, null, null, []);
    if (why) { why = `R ${R}: ${why}`; continue; }
    // The ring's own rooms: habitation away from the first branch, guns all round, the rest between.
    const first = a.ports.find((p) => p.kind === 'rim' && p.used)?.frame.dir ?? 'n';
    const own = [...rooms.filter((r) => root.takes.includes(r.dept as Dept)).flatMap((r) => (r.cabins === false ? [r] : cabinsOf(r))), ...pool.map((r) => ({ ...r, w: 3, h: 6 }))];
    const guns = own.filter((r) => r.dept === 'defence');
    const asks: BandAsk[] = own.map((spec) => ({ spec, angle: spec.dept === 'defence' ? (guns.indexOf(spec) * 2 * Math.PI) / Math.max(1, guns.length) : ANGLE[first] + (spec.dept === 'habitation' ? Math.PI : Math.PI / 2) }));
    const left = fillRing(site, asks, root.inner);
    if (left.length > 0) { why = `R ${R}: the ring is short of ${left.length} rooms`; continue; }
    // The band is filled last, round everything joined to the rim: no thick wall may come of it.
    const thick = site.g.blocks(-R - 60, -R - 60, R + 60, R + 60);
    if (thick > 0) { why = `R ${R}: ${thick} thick wall${thick > 1 ? 's' : ''} where the band meets a section`; continue; }
    a.sections++;
    finish(a);
    return { asm: a, why: '', R };
  }
  return { asm: new Asm(context(new RegionGrid(8), null, rng), 0), why };
}

/**
 * Assemble a station from a recipe and its rooms. A candidate that cannot stand every room is rejected and another is
 * tried (more slack, other rolls); the reasons come back either way.
 */
export function assemble(rng: Rng, recipe: Recipe, rooms: readonly RoomSpec[], tries = 5): { ok: Assembly | null; rejected: string[] } {
  const all = tagged(rooms), rejected: string[] = [];
  // A cluster has no outline to hold it together, so of several that stand the most compact is kept: proportion is a
  // rule here, not an accident of the seed. Every other root takes the first candidate that stands.
  const several = recipe.root.kind === 'core' ? 8 : 1;
  let best: { a: Assembly; span: number } | null = null;
  for (let n = 0; n < Math.max(tries, several) && (!best || n < several); n++) {
    const r = tryOnce(rng, recipe, all, n);
    if (!r.why) r.why = missing(r.asm.ctx, all);
    if (!r.why) {
      const cut = r.asm.ctx.g.stranded();
      if (cut.length > 0) r.why = `no way in to ${cut.slice(0, 3).map(([x, y, id]) => `${r.asm.ctx.g.regions[id]?.role} at ${x},${y}`).join('; ')}`;
    }
    if (r.why) { rejected.push(r.why); continue; }
    const snap = r.asm.ctx.g.snapshot();
    const a: Assembly = { ctx: r.asm.ctx, recipe, ...(r.R ? { R: r.R } : {}), sections: r.asm.sections, corridors: r.asm.corridors, rooms: all.length, rejected };
    if (!best || Math.max(snap.width, snap.height) < best.span) best = { a, span: Math.max(snap.width, snap.height) };
  }
  return { ok: best?.a ?? null, rejected };
}
