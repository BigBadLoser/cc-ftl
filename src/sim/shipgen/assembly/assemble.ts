import type { RoomSpec } from '../plan';
import type { Rng } from '../../rng';
import { shuffle } from '../civilKit';
import type { BandAsk } from '../flow/band';
import { deptOf, type Dept } from '../stationDepartments';
import { cabinsOf, K, type Site } from '../stationFlowKit';
import { RegionGrid, SOLID, SPACE } from '../stationRegions';
import { block, corridor, single } from './elements';
import { at, key, type Built, type Ctx, type Dir, type Port } from './model';
import type { BranchRule, Recipe, Roll } from './recipe';
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
const roll = (rng: Rng, r: Roll): number => (typeof r === 'number' ? r : rng.int(r[0], r[1]));

class Asm {
  ports: Port[] = [];
  elements: Built[] = [];
  sections = 0;
  corridors = 0;
  /** Regions of gated branches: nothing that is not joined to them stands within two tiles. */
  sealed = new Set<number>();
  constructor(readonly ctx: Ctx, readonly spacing: number) {}

  add(b: Built): Port[] {
    const owner = this.elements.push(b) - 1;
    const ps = b.ports.map((p) => ({ ...p, owner, used: false }));
    this.ports.push(...ps);
    return ps;
  }

  /** Everything needed to take a run of placements back. */
  checkpoint(): () => void {
    const { g } = this.ctx;
    const m = g.mark(), held = [...this.ctx.reserved], np = this.ports.length, ne = this.elements.length, used = this.ports.map((p) => p.used), s = this.sections, c = this.corridors;
    return () => {
      g.reset(m);
      this.ctx.reserved.clear();
      for (const k of held) this.ctx.reserved.add(k);
      this.ports.length = np;
      this.elements.length = ne;
      this.ports.forEach((p, i) => { p.used = used[i] as boolean; });
      this.sections = s;
      this.corridors = c;
    };
  }

  /** Try one element at a port. `joined`: regions it may stand against (what it is joined to); its own are added. */
  place(port: Port, joined: Set<number>, make: () => Built | null): Port[] | null {
    const { g } = this.ctx;
    const undo = this.checkpoint(), was = g.mark().own;
    const W = 72, px = port.frame.x, py = port.frame.y;
    const before = g.blocks(px - W, py - W, px + W, py + W);
    const b = make();
    if (!b || g.blocks(px - W, py - W, px + W, py + W) > before) { undo(); return null; }
    // Clear ground between it and whatever it is not joined to: `spacing` tiles of it, two round anything gated; and
    // where sections may stand wall to wall, never a single tile of space between two of them.
    const mine = new Set(b.regions), S = this.spacing;
    const old = (x: number, y: number): number => { const i = x + g.half, j = y + g.half; return i < 0 || j < 0 || i >= g.size || j >= g.size ? SPACE : (was[j * g.size + i] as number); };
    const foreign = (o: number): boolean => o >= 0 && !joined.has(o);
    for (let y = b.box[1] - 1; y <= b.box[3]; y++) for (let x = b.box[0] - 1; x <= b.box[2]; x++) {
      if (!mine.has(g.at(x, y))) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const o = old(x + dx, y + dy);
        if (!foreign(o)) continue;
        if (this.sealed.has(o) || Math.max(Math.abs(dx), Math.abs(dy)) <= S) { undo(); return null; }
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (foreign(old(x + 2 * dx, y + 2 * dy)) && g.at(x + dx, y + dy) === SPACE) { undo(); return null; }
      }
    }
    port.used = true;
    for (const id of b.regions) joined.add(id);
    return this.add(b);
  }
}

/** Rooms cut into sections of a size in `range`, as even as they go. */
function chunks(rooms: readonly RoomSpec[], range: readonly [number, number]): RoomSpec[][] {
  const n = Math.max(1, Math.ceil(rooms.length / range[1]));
  const out: RoomSpec[][] = Array.from({ length: n }, () => []);
  // Biggest first, dealt round: every section gets one of the big rooms.
  [...rooms].sort((a, b) => b.w * b.h - a.w * a.h).forEach((r, i) => (out[i % n] as RoomSpec[]).push(r));
  return out;
}

interface Chain { end: Port | null; dir: Dir; took: number }

/**
 * One block section at a port: as the rule draws it, and when staggered bays build a thick wall or will not fit, as a
 * slab of one depth (the rooms keep their floor).
 */
function section(a: Asm, port: Port, joined: Set<number>, part: readonly RoomSpec[], rule: BranchRule, o: { cap: boolean; docks?: readonly RoomSpec[]; gate?: boolean; bunks?: readonly RoomSpec[] }): Port[] | null {
  const { ctx } = a, base = { cap: o.cap, even: !!rule.section.even, cross: !!rule.section.cross, ...(o.docks ? { docks: o.docks } : {}), ...(o.gate ? { gate: true } : {}), ...(o.bunks ? { bunks: o.bunks } : {}) };
  const as = (rowDepth?: number): Port[] | null => a.place(port, joined, () => block(ctx, port, part, { ...base, ...(rowDepth ? { rowDepth } : {}) }));
  if (rule.section.rowDepth) return as(rule.section.rowDepth);
  const depths = part.map((r) => Math.min(r.w, r.h)).sort((p, q) => p - q);
  return as() ?? as(Math.max(4, depths[depths.length >> 1] ?? 4));
}

/** One branch at a port: neck, then sections in series. Null (and nothing kept) when any part of it does not fit. */
function branch(a: Asm, rule: BranchRule, host: Port, rooms: readonly RoomSpec[], docks: readonly RoomSpec[], bunks: readonly RoomSpec[], each: number): Chain | null {
  const { ctx } = a, { rng } = ctx;
  const undo = a.checkpoint();
  const joined = new Set(a.elements[host.owner]?.regions ?? []), outside = new Set(joined);
  const fail = (): null => { undo(); return null; };
  let port = host;
  // A neck: a corridor before the first section. A gated branch with none is gated at its first section's foot.
  const neck = (host.kind === 'rim' && roll(rng, rule.neck) > 0 ? host.along : 0) + roll(rng, rule.neck);
  if (neck > 0) {
    const ps = a.place(port, joined, () => corridor(ctx, port, { length: Math.max(neck, rule.gated ? 3 : 0), ...(rule.gated ? { gated: true } : { pitch: K }) }));
    if (!ps) return fail();
    a.corridors++;
    port = ps.find((p) => p.kind === 'end') as Port;
  }
  const parts = chunks(rooms, rule.section.rooms);
  let end: Port | null = null, took = 0;
  // Bunks offered to each section in turn (never behind a gate).
  const offer = (): { bunks?: readonly RoomSpec[] } => (rule.gated || each === 0 ? {} : { bunks: bunks.slice(took, took + each) });
  const taken = (): void => { took += a.elements[a.elements.length - 1]?.took ?? 0; };
  const first = { ...(docks.length > 0 ? { docks } : {}), ...(rule.gated && neck === 0 ? { gate: true } : {}) };
  if (rule.arrange === 'sides') {
    // A comb: one stem, its sections on the stem's sides, each closed by its own end room; the stem is cut back to
    // the last of them afterwards.
    const from = port, stem = parts.length * roll(rng, rule.link) + K;
    const ps = a.place(from, joined, () => corridor(ctx, from, { length: stem, pitch: K }));
    if (!ps) return fail();
    a.corridors++;
    for (const [i, part] of parts.entries()) {
      let ok = false;
      for (const p of ps.filter((q) => !q.used && q.kind === 'side')) {
        if (section(a, p, joined, part, rule, { cap: true, ...(i === 0 ? first : {}), ...offer() })) { ok = true; break; }
      }
      if (!ok) return fail();
      taken();
      a.sections++;
    }
  } else {
    for (const [i, part] of parts.entries()) {
      const last = i === parts.length - 1, here = port;
      const ps = section(a, here, joined, part, rule, { cap: last && !!rule.section.cap, ...(i === 0 ? first : {}), ...offer() });
      if (!ps) return fail();
      taken();
      a.sections++;
      end = ps.find((p) => p.kind === 'end') ?? null;
      if (last || !end) break;
      const from = end, len = roll(rng, rule.link);
      end = null;
      if (len === 0) { port = from; continue; } // joined directly: the next section starts where this one's street ends
      const link = a.place(from, joined, () => corridor(ctx, from, { length: len, ...(rule.gated ? {} : { pitch: K }) }));
      if (!link) return fail();
      a.corridors++;
      const turns = link.filter((p) => p.kind === 'side');
      port = rule.fork && turns.length > 0 && rng.chance(rule.fork) ? (rng.pick(turns) as Port) : (link.find((p) => p.kind === 'end') as Port);
    }
  }
  // A gated branch is joined by its gate alone: its ports are closed and nothing may stand against it.
  if (rule.gated) {
    for (const id of joined) if (!outside.has(id)) a.sealed.add(id);
    for (const p of a.ports) if (a.sealed.has(p.hall)) p.used = true;
    end = null;
  }
  return { end, dir: host.frame.dir, took };
}

interface Outcome { asm: Asm; why: string }

/** The branches on a root that is already there. Returns why it failed, or '' when everything stands. */
function grow(a: Asm, recipe: Recipe, all: readonly RoomSpec[], docks: readonly RoomSpec[], trunk: Port[] | null, core: Port | null): string {
  let rooms = all;
  const { ctx } = a, { rng } = ctx;
  if (docks.length > 0 && !recipe.branches.some((b) => b.docks)) return 'no part of the recipe takes the docks';
  const ends: (Port | null)[] = [];
  let lastTrunk: Port | null = null, cursor = 0, berthed = false;
  // Scattered cabins: every bed a small cabin of its own, a few to each section that is not gated.
  const scatter = recipe.cabins === 'scatter';
  const pool: RoomSpec[] = scatter ? rooms.filter((r) => r.role === 'quarters').flatMap((r) => {
    const others = r.mods.filter((m) => m !== 'module.bed'), beds = r.mods.length - others.length;
    return Array.from({ length: beds }, (_, i): RoomSpec => ({ ...r, mods: ['module.bed', ...(i === 0 ? others : [])], w: 2, h: 4, cabin: true, cabins: false }));
  }) : [];
  if (scatter) rooms = rooms.filter((r) => r.role !== 'quarters');
  const mean = (b: BranchRule): number => (b.section.rooms[0] + b.section.rooms[1]) / 2;
  const hosts0 = recipe.branches.filter((b) => !b.gated).reduce((n, b) => n + Math.max(1, Math.ceil(rooms.filter((r) => b.takes.includes(r.dept as Dept)).length / mean(b))), 0);
  const each = pool.length > 0 ? Math.ceil(pool.length / Math.max(1, hosts0)) + 1 : 0;
  for (const [k, rule] of recipe.branches.entries()) {
    const mine = rooms.filter((r) => rule.takes.includes(r.dept as Dept));
    const whole = rule.per === 'together' ? [mine] : rule.takes.map((d) => mine.filter((r) => r.dept === d));
    // A department with more sections than a branch carries is shared out over several branches. Mixed (a scrapper's
    // way): the rooms are dealt out at random, a section's worth to a branch, whatever their department.
    const groups = whole.flatMap((grp) => {
      if (rule.mix) {
        const pool = shuffle(rng, grp), out: RoomSpec[][] = [];
        while (pool.length > 0) out.push(pool.splice(0, Math.min(pool.length, rng.int(rule.section.rooms[0], rule.section.rooms[1]))));
        const last = out[out.length - 1];
        if (out.length > 1 && last && last.length < rule.section.rooms[0]) (out[out.length - 2] as RoomSpec[]).push(...(out.pop() as RoomSpec[]));
        return out;
      }
      const n = rule.most ? Math.ceil(chunks(grp, rule.section.rooms).length / rule.most) : 1;
      return n <= 1 ? [grp] : Array.from({ length: n }, (_, i) => grp.filter((_r, j) => j % n === i));
    });
    for (const group of groups) {
      const berths = rule.docks && !berthed ? docks : [];
      if (group.length + berths.length === 0) continue;
      let hosts: Port[];
      if (rule.host.on === 'trunk') {
        const free = (trunk ?? []).filter((p) => !p.used).sort((p, q) => p.along - q.along || p.side - q.side);
        // Opposite the branch before, when the roll says pairs.
        const mate = lastTrunk && recipe.root.kind === 'trunk' && rng.chance(recipe.root.pairs) ? free.find((p) => p.along === lastTrunk?.along && p.side !== lastTrunk.side) : undefined;
        hosts = mate ? [mate, ...free.filter((p) => p !== mate && p.along >= cursor)] : free.filter((p) => p.along >= cursor);
      } else if (rule.host.on === 'rim') {
        const prefer = rule.host.prefer;
        // In the recipe's order of preference, or with `roll` any of them as the seed has it.
        const turn = rule.host.roll ? rng.int(0, prefer.length - 1) : 0;
        const rank = (d: Dir): number => (prefer.indexOf(d) - turn + prefer.length) % prefer.length;
        hosts = a.ports.filter((p) => p.kind === 'rim' && !p.used && prefer.includes(p.frame.dir)).sort((p, q) => rank(p.frame.dir) - rank(q.frame.dir));
      } else if (rule.host.on === 'tip') {
        hosts = a.ports.filter((p) => p.kind === 'tip' && !p.used);
      } else if (rule.host.on === 'section') {
        // The centre first; then the open ports nearest it, a side before an end, with some chance in the order: a
        // cluster that grows round its middle and not in a line.
        const open = a.ports.filter((p) => !p.used && (p.kind === 'end' || p.kind === 'side'));
        const want = new Map(open.map((p) => [p, Math.hypot(p.frame.x - (core?.frame.x ?? 0), p.frame.y) / 30 + (p.kind === 'end' ? 2 : 0) + 0.4 * rng.next()]));
        hosts = [...(core && !core.used ? [core] : []), ...open.sort((p, q) => (want.get(p) as number) - (want.get(q) as number))];
      } else {
        const e = ends[rule.host.rule];
        hosts = e && !e.used ? [e] : [];
      }
      let made: Chain | null = null, at: Port | null = null;
      for (const h of hosts) { made = branch(a, rule, h, group, berths, pool, each); if (made) { at = h; break; } }
      if (!made || !at) return `no place for the ${group[0]?.dept ?? 'dock'} branch (${group.length} rooms${berths.length ? `, ${berths.length} docks` : ''}, ${hosts.length} ports tried)`;
      if (berths.length > 0) berthed = true;
      pool.splice(0, made.took);
      if (rule.host.on === 'trunk') {
        if (!lastTrunk || at.along !== lastTrunk.along) cursor = at.along + (recipe.root.kind === 'trunk' ? roll(rng, recipe.root.step) : 0);
        lastTrunk = at;
      }
      ends[k] = made.end;
    }
  }
  // Cabins no section took: pods on what ports are left.
  for (const bunk of [...pool]) {
    const open = a.ports.filter((p) => !p.used && !a.sealed.has(p.hall) && (p.kind === 'end' || p.kind === 'side'));
    let ok = false;
    for (const p of open) {
      const joined = new Set(a.elements[p.owner]?.regions ?? []);
      if (a.place(p, joined, () => single(ctx, p, bunk))) { ok = true; break; }
    }
    if (!ok) return `no place for ${pool.length} cabins`;
    pool.shift();
  }
  return docks.length > 0 && !berthed ? 'the dock block was never built' : '';
}

/** Cut back every corridor's unused tail: a corridor ends a little past the last thing that hangs on it. */
function trim(a: Asm): void {
  const { g } = a.ctx;
  a.elements.forEach((el, owner) => {
    if (!el.run) return;
    const { frame: f, length, hall } = el.run;
    const ports = a.ports.filter((p) => p.owner === owner);
    if (ports.some((p) => p.kind === 'end' && p.used)) return;
    const last = Math.max(0, ...ports.filter((p) => p.used).map((p) => p.along)) + 3;
    if (last >= length) return;
    for (let u = last; u <= length; u++) for (let v = -2; v < 2; v++) {
      const [x, y] = at(f, u, v), o = g.at(x, y);
      if (o === hall || o === SOLID) g.set(x, y, u === last && o === hall ? SOLID : SPACE);
    }
    // The new end: solid across the street, and its margin beside it.
    for (let v = -2; v < 2; v++) { const [x, y] = at(f, last, v); if (g.at(x, y) === SPACE && g.at(...at(f, last - 1, v)) !== SPACE) g.set(x, y, SOLID); }
    for (const p of ports) if (!p.used && p.along >= last) p.used = true;
  });
}

/**
 * The hard check, read from the compiled grid and nothing else: every room of the program stands as a region with
 * floor. Counted by role; quarters by beds, since a block of quarters may stand as several cabins.
 */
function missing(ctx: Ctx, rooms: readonly RoomSpec[]): string {
  const g = ctx.g, snap = g.snapshot();
  const floored = new Set<number>();
  for (const id of snap.roomOf) if (id >= 0) floored.add(id);
  const beds = (r: RoomSpec): number => r.mods.filter((m) => m === 'module.bed').length;
  const have = new Map<string, number>(), want = new Map<string, number>();
  const count = (m: Map<string, number>, r: RoomSpec): void => { const k = r.role === 'quarters' ? 'beds' : r.role; m.set(k, (m.get(k) ?? 0) + (r.role === 'quarters' ? beds(r) : 1)); };
  for (const r of rooms) count(want, r);
  for (const id of floored) { const spec = g.regions[id]?.spec; if (spec && !g.regions[id]?.hall) count(have, spec); }
  const short = [...want].filter(([k, n]) => (have.get(k) ?? 0) < n).map(([k, n]) => `${k} ${have.get(k) ?? 0}/${n}`);
  return short.length > 0 ? `rooms missing from the finished layout: ${short.join(', ')}` : '';
}

const tagged = (rooms: readonly RoomSpec[]): RoomSpec[] => rooms.map((r) => (r.dept ? r : { ...r, dept: deptOf(r) }));

function context(g: RegionGrid, s: Site | null, rng: Rng): Ctx {
  const reserved = new Set<number>();
  const inside = (x: number, y: number): boolean => Math.abs(x) < g.half - 4 && Math.abs(y) < g.half - 4;
  const free = (x: number, y: number): boolean => { const o = g.at(x, y); return inside(x, y) && (o === SPACE || o === SOLID) && !reserved.has(key(x, y)); };
  return { g, site: s ?? ({ g, free } as unknown as Site), rng, reserved, free, inside };
}

function tryOnce(rng: Rng, recipe: Recipe, all: readonly RoomSpec[], attempt: number): Outcome & { R?: number } {
  const docks = all.filter((r) => r.role === 'dock'), rooms = all.filter((r) => r.role !== 'dock');
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
    const why = grow(a, recipe, rooms, docks, trunk, null);
    if (!why) trim(a);
    return { asm: a, why };
  }

  if (recipe.root.kind === 'core') {
    const ctx = context(new RegionGrid(HALF), null, rng);
    const a = new Asm(ctx, recipe.spacing);
    // The centre: a port in open ground, heading east or west as the seed has it, a little off the middle each try.
    const core: Port = { frame: { x: 4 * attempt, y: 0, dir: rng.chance(0.5) ? 'e' : 'w' }, kind: 'end', hall: -1, owner: -1, along: 0, side: 0, used: false };
    const why = grow(a, recipe, rooms, docks, null, core);
    if (!why) trim(a);
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
    why = grow(a, recipe, rooms, docks, null, null);
    if (why) { why = `R ${R}: ${why}`; continue; }
    // The ring's own rooms: habitation away from the first branch, guns all round, the rest between.
    const first = a.ports.find((p) => p.kind === 'rim' && p.used)?.frame.dir ?? 'n';
    const own = rooms.filter((r) => root.takes.includes(r.dept as Dept)).flatMap(cabinsOf);
    const guns = own.filter((r) => r.dept === 'defence');
    const asks: BandAsk[] = own.map((spec) => ({ spec, angle: spec.dept === 'defence' ? (guns.indexOf(spec) * 2 * Math.PI) / Math.max(1, guns.length) : ANGLE[first] + (spec.dept === 'habitation' ? Math.PI : Math.PI / 2) }));
    const left = fillRing(site, asks, root.inner);
    if (left.length > 0) { why = `R ${R}: the ring is short of ${left.length} rooms`; continue; }
    // The band is filled last, round everything joined to the rim: no thick wall may come of it.
    const thick = site.g.blocks(-R - 60, -R - 60, R + 60, R + 60);
    if (thick > 0) { why = `R ${R}: ${thick} thick wall${thick > 1 ? 's' : ''} where the band meets a section`; continue; }
    a.sections++;
    trim(a);
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
