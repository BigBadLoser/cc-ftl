import type { RoomSpec } from '../plan';
import { shuffle } from '../civilKit';
import { roll, type Asm } from './asm';
import type { Dept } from './dept';
import { block, corridor, single } from './elements';
import { K } from './lattice';
import type { Dir, Port } from './model';
import type { BranchRule, Recipe } from './recipe';

/**
 * Branches: a recipe's rules grown on a root that is already there. Each rule's rooms are cut into sections, and a
 * branch (a neck, then its sections in series) is tried at one host port after another until it stands.
 */

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
  const { ctx } = a, base = { cap: o.cap, even: !!rule.section.even, cross: rule.section.cross ?? false, ...(o.docks ? { docks: o.docks } : {}), ...(o.gate ? { gate: true } : {}), ...(o.bunks ? { bunks: o.bunks } : {}) };
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
    const straight = (): Port[] | null => a.place(port, joined, () => corridor(ctx, port, { length: Math.max(neck, rule.gated ? 3 : 0), ...(rule.gated ? { gated: true } : { pitch: K }) }));
    // A dogleg to one side, else to the other, else straight.
    const jog = rule.jog && !rule.gated ? roll(rng, rule.jog) * (rng.chance(0.5) ? 1 : -1) : 0;
    const bent = (shift: number): Port[] | null => a.place(port, joined, () => corridor(ctx, port, { length: neck, shift }));
    const ps = Math.abs(jog) >= 2 ? bent(jog) ?? bent(-jog) ?? straight() : straight();
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
  {
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
      port = link.find((p) => p.kind === 'end') as Port;
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

/** The branches on a root that is already there. Returns why it failed, or '' when everything stands. */
export function grow(a: Asm, recipe: Recipe, rooms: readonly RoomSpec[], docks: readonly RoomSpec[], trunk: Port[] | null, core: Port | null, pool: RoomSpec[]): string {
  const { ctx } = a, { rng } = ctx;
  if (docks.length > 0 && !recipe.branches.some((b) => b.docks)) return 'no part of the recipe takes the docks';
  const ends: (Port | null)[] = [];
  let lastTrunk: Port | null = null, cursor = 0, berthed = false;
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
