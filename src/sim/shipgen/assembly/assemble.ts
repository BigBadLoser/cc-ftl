import type { RoomSpec } from '../plan';
import type { Rng } from '../../rng';
import { Asm } from './asm';
import type { BandAsk } from './band';
import { grow } from './branch';
import { deptOf, type Dept } from './dept';
import { corridor } from './elements';
import { brace, mend, missing, trim } from './finish';
import { hub } from './hub';
import { K, type Site } from './lattice';
import { key, type Ctx, type Dir, type Port } from './model';
import { cabinsOf, house } from './quarters';
import type { Recipe } from './recipe';
import { RegionGrid, SOLID, SPACE } from './regions';
import { noses } from './noses';
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
  const takers = new Set<string>([...(recipe.root.kind === 'ring' ? [...recipe.root.takes, ...(recipe.root.hub ? [...recipe.root.hub.market, ...recipe.root.hub.spokes, ...(recipe.root.hub.gated ?? [])] : [])] : []), ...recipe.branches.flatMap((b) => b.takes)]);
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
    // The centre: a port in open ground, a little off the middle each try, heading east or west as the seed has it;
    // a station that starts at a quay, any of the four ways.
    const core: Port = { frame: { x: 4 * attempt, y: 0, dir: recipe.branches[0]?.quay ? rng.pick(['n', 'e', 's', 'w'] as const) : rng.chance(0.5) ? 'e' : 'w' }, kind: 'end', hall: -1, owner: -1, along: 0, side: 0, used: false };
    const why = grow(a, recipe, rooms, docks, null, core, pool);
    if (!why) finish(a);
    return { asm: a, why };
  }

  const root = recipe.root;
  let why = '';
  for (let cells = 5; cells <= 18; cells++) {
    const R = cells * K;
    const { site, kept } = ringSite({ R, outline: root.outline, cut: root.cut === 'octagon' ? Math.round(0.59 * cells) : typeof root.cut === 'object' ? cells - root.cut.flat : root.cut, inner: root.inner, ...(root.round ? { round: true } : {}), ...(root.shoulders ? { shoulders: true } : {}), ...(root.gap ? { gap: root.gap } : {}) }, Math.max(120, 2 * R + 48));
    const ctx = context(site.g, site, rng);
    // Ground kept open inboard of the ring (the berths of a harbour inside an arc) is not the inner rooms' to take.
    const inboard = site.free;
    site.free = (x, y) => inboard(x, y) && !ctx.reserved.has(key(x, y));
    const a = new Asm(ctx, recipe.spacing);
    a.add({ ports: ringPorts(site, kept), regions: [site.ring], box: [-R, -R, R, R] });
    // Rooms the hub holds of those the ring would take.
    const inHub = new Set<RoomSpec>();
    if (root.hub) {
      const of = (ds: readonly Dept[]): RoomSpec[] => rooms.filter((r) => ds.includes(r.dept as Dept));
      const made = hub(ctx, site, of(root.hub.market), { open: of(root.hub.spokes), gated: of(root.hub.gated ?? []) }, root.hub);
      if (!made || site.g.blocks(-R, -R, R, R) > 0) { why = `R ${R}: the hub does not fit`; continue; }
      for (const r of of(root.hub.spokes)) if (!made.left?.includes(r)) inHub.add(r);
      a.add(made);
      a.sections++;
    }
    // On a ring the single cabins stand in its band with the rest; nothing is scattered.
    why = grow(a, recipe, rooms, docks, null, null, []);
    if (why) { why = `R ${R}: ${why}`; continue; }
    // The ring's own rooms.
    const first = a.ports.find((p) => p.kind === 'rim' && p.used)?.frame.dir ?? 'n';
    const whole = (r: RoomSpec): RoomSpec[] => (r.cabins === false ? [r] : cabinsOf(r));
    // Its own copies: a cabin that takes a second bed must not change the program's room.
    const copy = (r: RoomSpec): RoomSpec => ({ ...r, mods: [...r.mods] });
    const ours = [...rooms.filter((r) => root.takes.includes(r.dept as Dept) && !inHub.has(r)).flatMap(whole), ...pool.map((r) => ({ ...r, w: 3, h: 6 }))].map(copy);
    // An arc's arms end in round noses, the biggest rooms of the role asked for.
    const nosed = root.noses ? noses(site, a.ports.filter((p) => p.kind === 'tip' && !p.used), ours.filter((r) => r.role === root.noses).sort((p, q) => q.w * q.h - p.w * p.h), (x, y) => !ctx.reserved.has(key(x, y))) : [];
    const own = ours.filter((r) => !nosed.includes(r));
    const guns = own.filter((r) => r.dept === 'defence'), beds = own.filter((r) => r.cabin), halls = own.filter((r) => r.dept === 'commons');
    // The band by sectors. Round a hub: cabins on the faces across the main axis, half to each; guns either side of
    // the two faces on it; common rooms on the diagonals. Otherwise: habitation away from the first branch, guns all
    // round, the rest between.
    // Waterfront rooms are shared between the two faces beside the gap (or the two across the main axis).
    const sent = (r: RoomSpec): boolean => !!root.inboard?.takes.includes(r.dept as Dept);
    const front = (r: RoomSpec): boolean => !!root.waterfront?.includes(r.dept as Dept) || sent(r);
    const fronts = own.filter(front), faces = root.gap && (root.gap.side === 'n' || root.gap.side === 's') ? [Math.PI / 2, 1.5 * Math.PI] : [0, Math.PI];
    const angle = (spec: RoomSpec): number => {
      if (root.inboard && sent(spec)) return ANGLE[root.inboard.face];
      if (front(spec)) return faces[fronts.indexOf(spec) % 2] as number;
      if (root.hub && spec.cabin) return (beds.indexOf(spec) % 2) * Math.PI;
      if (root.hub && spec.dept === 'defence') { const k = guns.indexOf(spec); return (k % 2 ? 1.5 : 0.5) * Math.PI + ((k >> 1) % 2 ? 0.6 : -0.6); }
      if (root.hub && spec.dept === 'commons') return (0.25 + 0.5 * (1 + 2 * halls.indexOf(spec))) * Math.PI;
      if (root.hub) return 0;
      return spec.dept === 'defence' ? (guns.indexOf(spec) * 2 * Math.PI) / Math.max(1, guns.length) : ANGLE[first] + (spec.dept === 'habitation' ? Math.PI : Math.PI / 2);
    };
    const asks: BandAsk[] = [
      ...own.map((spec) => ({ spec, angle: angle(spec) })),
      // What a part on the rim left to the band stands in the band beside it.
      ...a.spill.flatMap((sp) => whole(sp.spec).map((spec) => ({ spec: copy(spec), angle: ANGLE[sp.dir] }))),
    ];
    const band = site.g.regions.length;
    const left = fillRing(site, asks, root.inner, root.waterfront || root.inboard ? front : undefined);
    if (left.length > 0) { why = `R ${R}: the ring is short of ${left.length} rooms (${left.map((r) => `${r.role} ${r.w}x${r.h}`).join(", ")})`; continue; }
    // The band is filled last, round everything joined to the rim: no thick wall may come of it.
    mend(site.g, band, [-R - 60, -R - 60, R + 60, R + 60]);
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
