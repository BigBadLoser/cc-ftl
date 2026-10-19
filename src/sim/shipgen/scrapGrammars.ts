import { mirrorBlock, mirrorX, type Block, type Side } from './arranger';
import { blockFrom, hallBlock, localBuilder } from './blocks';
import { drive } from './civilBlocks';
import { truss } from './civilFrames';
import { freeze } from './salvage';
import type { Rng } from '../rng';
import { plate } from './hullFill';
import { storeRoom } from './droneBlocks';
import { dockBlock, podBlock } from './navyBlocks';
import { no, type Ctx } from './navyKit';
import { pickWeighted, shuffle, weaponSpec } from './plan';
import { mountGuns } from './navyMounts';
import { DONORS, leftovers, poolOf, clonePool, restorePool, type Need, type Pool } from './scrapDonors';
import type { DonorKind, FactionDef, ScrapGrammar } from './types';

/**
 * Scrapper composition on the shared 2D arranger: an anchor donor, the donors this role needs (chosen by job, weighted
 * by the family), grafted wall to wall where they fit. How they are placed is the grammar:
 *   heap   each donor welded to any part already aboard, on any face
 *   raft   the first two donors welded lengthways, the rest heaped on
 *   chain  donors welded end to end, each onto the last, sideways only when the line is blocked
 * Donors may flip top to bottom; engine-free, non-navy donors may also flip end to end (engines always face +x, navy
 * sections keep their bow forward). Seams the welds leave are plated over.
 */

const OPP: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };

/** Lengthwise donors a ship can be built along (a body with a bow end and a stern end). */
const LINE: DonorKind[] = ['navyHulk', 'freighter', 'containerFrame', 'linerChunk', 'barge', 'liner'];
/** Donors that only ever extend the anchor line (a bow, a drive). */
const ENDS: DonorKind[] = ['navyBow', 'cockpitBow', 'linerBow', 'bluntBow', 'navyDrive', 'lightDrive', 'tug'];
/** Salvaged bows, weighted: navy noses, a freighter cockpit, a liner nose, a blunt cut-off block. */
const BOWS: { value: DonorKind; weight: number }[] = [{ value: 'navyBow', weight: 1 }, { value: 'cockpitBow', weight: 2 }, { value: 'linerBow', weight: 2 }, { value: 'bluntBow', weight: 2 }];

interface Cast {
  anchor: DonorKind;
  bow: DonorKind | null;
  drive: DonorKind | null;
  flanks: DonorKind[];
}

/**
 * The ship's cast: a lengthwise anchor (with a salvaged bow fore and a drive aft unless it brings its own), then a
 * few big flank donors, one per job nobody carries yet and an extra or two at depth: 2 to 4 donors in all.
 */
function choose(c: Ctx): Cast {
  const w = c.fam.donors ?? {};
  const kinds = Object.keys(w) as DonorKind[];
  const pick = (opts: DonorKind[]): DonorKind | null => (opts.length > 0 ? pickWeighted(c.rng, opts.map((k) => ({ value: k, weight: w[k] ?? 1 }))) : null);
  const anchors = (c.fam.anchors ?? []).filter((a) => LINE.includes(a.value));
  const anchor = anchors.length > 0 ? pickWeighted(c.rng, anchors) : 'navyHulk';
  const hulk = anchor === 'navyHulk';
  const bow: DonorKind | null = hulk ? null : pickWeighted(c.rng, BOWS);
  const drive: DonorKind | null = hulk ? null : pick(kinds.filter((k) => ['navyDrive', 'lightDrive', 'tug'].includes(k) && (w[k] ?? 0) > 0)) ?? 'lightDrive';
  const cast: DonorKind[] = [anchor, ...(bow ? [bow] : []), ...(drive ? [drive] : [])];
  const flanks: DonorKind[] = [];
  const served = (n: Need): boolean => [...cast, ...flanks].some((k) => DONORS[k].serves.includes(n));
  for (const need of ['hangar', 'guns', 'crew', 'crates'] as Need[]) {
    if (need === 'hangar' && c.plan.hangars.length === 0) continue;
    if (served(need)) continue;
    const k = pick(kinds.filter((x) => DONORS[x].serves.includes(need) && (w[x] ?? 0) > 0 && !ENDS.includes(x)));
    if (k) flanks.push(k);
  }
  const most = Math.min(3, 1 + Math.floor(c.plan.size / 2));
  while (flanks.length < most && c.rng.chance(0.6)) {
    const k = pick(kinds.filter((x) => (w[x] ?? 0) > 0 && !ENDS.includes(x) && !flanks.includes(x)));
    if (!k) break;
    flanks.push(k);
  }
  // Small salvage patches (a cargo pod string, a gun section) take a share of the jobs, so the big donors stay smaller
  // than the anchor and the ship reads as salvage.
  for (let k = c.rng.int(1, c.plan.size >= 3 ? 2 : 1); k > 0; k--) {
    const pt = pick((['podString', 'navyBattery', 'droneSection'] as DonorKind[]).filter((x) => (w[x] ?? 0) > 0));
    if (pt) flanks.push(pt);
  }
  return { anchor, bow, drive, flanks };
}

/** Build the cast in order, each taking its share of the jobs; then patch in whatever is left. */
function build(c: Ctx, f: FactionDef, cast: Cast, p: Pool): { anchor: Block | null; bow: Block | null; drive: Block | null; flanks: Block[] } {
  const kinds = [cast.anchor, ...(cast.bow ? [cast.bow] : []), ...(cast.drive ? [cast.drive] : []), ...cast.flanks];
  for (const k of kinds) for (const n of DONORS[k].serves) p.share[n] = (p.share[n] ?? 0) + 1;
  p.commandBy = cast.bow ?? (cast.anchor === 'navyHulk' ? 'navyHulk' : null);
  const one = (k: DonorKind | null): Block | null => {
    if (!k) return null;
    const save = clonePool(p);
    const b = DONORS[k].build(c, f, p);
    if (!b) restorePool(p, save);
    for (const n of DONORS[k].serves) p.share[n] = Math.max(0, (p.share[n] ?? 1) - 1);
    return b;
  };
  const anchor = one(cast.anchor);
  const drive = one(cast.drive);
  const flanks = cast.flanks.map(one).filter((b): b is Block => !!b);
  // The bow last: salvage mixes origins, so an all-civil ship so far takes the blunt navy block.
  let bowKind = cast.bow;
  if (bowKind && [anchor, drive, ...flanks].every((b) => !b || b.donor === 'civil') && bowKind !== 'navyBow') {
    bowKind = 'bluntBow';
    p.commandBy = 'bluntBow';
  }
  const bow = one(bowKind);
  return { anchor, bow, drive, flanks: [...flanks, ...leftovers(c, f, p)] };
}

/** Ways a donor may be turned: flipped top to bottom always, end to end only when nothing in it is directional. */
function variants(c: Ctx, b: Block): Block[] {
  const v = [b, mirrorBlock(b)];
  if (b.faceE.length === 0 && b.donor !== 'navy') v.push(mirrorX(b), mirrorX(mirrorBlock(b)));
  return shuffle(c.rng, v);
}

/**
 * A scrap strut: a crawl tube with a truss chord along it, `len` long, bridging two donors so each keeps its outline (a
 * visible seam between them, never a merged mass).
 */
function strut(rng: Rng, len: number, horiz: boolean): Block {
  const b = localBuilder(rng);
  if (horiz) {
    b.place({ x: 0, y: -2, w: len + 2, h: 3 }, 'hall');
    truss(b, 1, rng.chance(0.5) ? -3 : 1, len, 1, 'chord');
  } else {
    b.place({ x: -2, y: 0, w: 3, h: len + 2 }, 'hall');
    truss(b, rng.chance(0.5) ? -3 : 1, 1, 1, len, 'chord');
  }
  const ports = horiz
    ? [{ id: 'w', side: 'w' as const, x: 0, y: -1, len: 1, access: 'human' as const }, { id: 'e', side: 'e' as const, x: len + 1, y: -1, len: 1, access: 'human' as const }]
    : [{ id: 'n', side: 'n' as const, x: -1, y: 0, len: 1, access: 'human' as const }, { id: 's', side: 's' as const, x: -1, y: len + 1, len: 1, access: 'human' as const }];
  return { ...blockFrom(b, 'beam', 'strut', 'human', ports), donor: 'scrap', label: 'scrap: strut', bare: true };
}

/** Weld `child` onto `host` through a strut on `side`. */
function strutWeld(c: Ctx, h: number, v: Block, side: Side): number | null {
  const s = c.A.attach(h, strut(c.rng, c.rng.int(3, 4 + c.plan.size), side === 'e' || side === 'w'), { side, align: 'any', kind: 'graft' });
  if (s === null) return null;
  const id = c.A.attach(s, v, { side, align: 'mid', kind: 'graft' }) ?? c.A.attach(s, v, { side, align: 'any', kind: 'graft' });
  if (id === null) c.A.undoLast();
  else c.parts.push('strut');
  return id;
}

/**
 * Weld `child` onto one of `hosts` (in order) on one of `sides`. Most donors hang off struts (each keeps its outline);
 * some weld flush (the ragged adapters fill those seams); a short scrap tube is the last resort.
 */
function weld(c: Ctx, hosts: number[], child: Block, sides: Side[], align: 'any' | 'start' | 'end' = 'any'): number | null {
  const vs = variants(c, child);
  if (!child.label.startsWith('scrap') && c.rng.chance(0.85)) {
    // A few tries only: a failed strut is undone, and undoing rebuilds the arrangement.
    let tries = 8;
    for (const h of hosts) for (const side of sides) for (const v of vs) {
      if (tries <= 0 || !v.ports.some((p) => p.side === OPP[side])) continue;
      tries--;
      const id = strutWeld(c, h, v, side);
      if (id !== null) return id;
    }
  }
  for (const tube of [false, true]) {
    for (const h of hosts) {
      for (const side of sides) {
        for (const v of vs) {
          if (!v.ports.some((p) => p.side === OPP[side])) continue;
          if (!tube) {
            const id = c.A.attach(h, v, { side, align, kind: 'graft' });
            if (id !== null) return id;
            continue;
          }
          const t = hallBlock(c.rng, c.rng.int(1, 3), c.rng.int(1, 2), side === 'e' || side === 'w', 'human');
          const tid = c.A.attach(h, { ...t, donor: 'scrap', label: 'scrap: tube' }, { side, align: 'any', kind: 'graft' });
          if (tid === null) continue;
          const id = c.A.attach(tid, v, { side, align: 'mid', kind: 'graft' });
          if (id !== null) { c.parts.push('tube'); return id; }
          c.A.undoLast();
        }
      }
    }
  }
  return null;
}

const hostsOf = (c: Ctx): number[] => c.A.placed.map((_, i) => i).filter((i) => c.A.placed[i]?.block.kind !== 'plate');

/** Strap the extra engines on as pods, bolt on crates and airlocks, plate the seams. */
function improvise(c: Ctx, p: Pool): boolean {
  for (; p.engines > 0; p.engines--) {
    // A strapped engine: a nozzle on a stub of spine (the light civil drive's smallest form), not a bare slab.
    const nb = drive(c.rng, 1, 0, 'nozzle');
    const pod = nb ? { ...freeze(nb, 'drive', 'strapped engine', 'scrap'), label: 'scrap: strapped engine' } : { ...podBlock(c.rng, 1), donor: 'scrap', label: 'scrap: strapped engine' };
    if (weld(c, shuffle(c.rng, hostsOf(c)), pod, ['n', 's']) === null) return no(c, 'strapped engine');
    c.parts.push('strapped engine');
  }
  for (let k = 0; k < 3 && p.crates > 0; k++) {
    const n = Math.min(3, p.crates);
    if (weld(c, shuffle(c.rng, hostsOf(c)), { ...storeRoom(c.rng, n), donor: 'scrap', label: 'scrap: crates' }, ['n', 's', 'w']) !== null) p.crates -= n;
  }
  for (; p.docks > 0; p.docks--) weld(c, shuffle(c.rng, hostsOf(c)), { ...dockBlock(c.rng), donor: 'scrap', label: 'scrap: airlock' }, ['n', 's']);
  // Plate only hairline seams: wider gaps are the struts' daylight, and keep the donors apart.
  if (plate(c.A, 1) > 0) c.parts.push('plates');
  return true;
}

/** Drawn cells of a placed block, in world coordinates. */
function cells(c: Ctx, id: number): { x: number; y: number }[] {
  const P = c.A.placed[id];
  if (!P) return [];
  const out: { x: number; y: number }[] = [];
  P.block.rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') out.push({ x: P.x + i, y: P.y + j }); });
  return out;
}

/** Major blocks: donors and the anchor line (not struts, braces, plates or scrap bolt-ons). */
const major = (b: Block): boolean => !b.bare && b.kind !== 'plate' && !!b.donor && b.donor !== 'scrap';

/** A flush-welded donor (placed at index `id`, its tube from `n0` on) touches no major block it is not welded to. */
function touchesOnly(c: Ctx, id: number, n0: number): boolean {
  const mine = new Set<number>([id]);
  for (let i = n0; i < c.A.placed.length; i++) mine.add(i);
  for (const j of c.A.joins) if (mine.has(j.a) || mine.has(j.b)) { mine.add(j.a); mine.add(j.b); }
  const owner = new Map<number, number>();
  c.A.placed.forEach((p, i) => { if (!mine.has(i) && major(p.block)) for (const t of cells(c, i)) owner.set(t.y * 100003 + t.x, i); });
  for (const t of cells(c, id)) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (owner.has((t.y + dy) * 100003 + t.x + dx)) return false;
  return true;
}

/**
 * Lengthwise ties: wherever two major blocks face each other across a fore-aft gap of 2 to 8 open tiles on some rows,
 * and nothing joins them yet, span the gap with two or three parallel truss members (every third row, daylight
 * between), so the eye runs from bow to drive along the hull.
 */
function ties(c: Ctx): number {
  const owner = new Map<number, number>();
  c.A.placed.forEach((p, i) => { if (major(p.block)) for (const t of cells(c, i)) owner.set(t.y * 100003 + t.x, i); });
  const joined = (a: number, b: number): boolean => c.A.joins.some((j) => (j.a === a && j.b === b) || (j.a === b && j.b === a));
  const free = (x: number, y: number): boolean => c.A.cell(x, y) === undefined && !c.A.reserved(x, y);
  const box = c.A.box();
  const pairs = new Map<string, { y: number; x0: number; x1: number }[]>();
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      const a = owner.get(y * 100003 + x);
      if (a === undefined || !free(x + 1, y)) continue;
      let n = 1;
      while (n <= 9 && free(x + n, y)) n++;
      const b = owner.get(y * 100003 + x + n);
      if (n < 3 || n > 9 || b === undefined || b === a || joined(a, b)) continue;
      const k = `${Math.min(a, b)}:${Math.max(a, b)}`;
      pairs.set(k, [...(pairs.get(k) ?? []), { y, x0: x + 1, x1: x + n - 1 }]);
    }
  }
  let made = 0;
  for (const rows of pairs.values()) {
    if (rows.length < 2) continue;
    // Members on every third row from the middle of the overlap outwards, two or three of them.
    const sorted = rows.sort((p, q) => p.y - q.y);
    const mid = sorted[Math.floor(sorted.length / 2)] as { y: number };
    const picks = sorted.filter((r) => (r.y - mid.y) % 3 === 0).sort((p, q) => Math.abs(p.y - mid.y) - Math.abs(q.y - mid.y)).slice(0, c.rng.int(2, 3));
    if (picks.length < 2) continue;
    for (const r of picks) {
      const m = { ...member(r.x1 - r.x0 + 1, false), label: 'scrap: tie' };
      if (c.A.canPlace(m, r.x0, r.y)) { c.A.place(m, r.x0, r.y); made++; }
    }
  }
  return made;
}

/** A bare truss along an arbitrary path of cells (a diagonal staircase or a dogleg). */
function pathMember(path: { x: number; y: number }[], label: string): { blk: Block; X: number; Y: number } {
  const X = Math.min(...path.map((q) => q.x));
  const Y = Math.min(...path.map((q) => q.y));
  const W = Math.max(...path.map((q) => q.x)) - X + 1;
  const H = Math.max(...path.map((q) => q.y)) - Y + 1;
  const set = new Set(path.map((q) => `${q.x - X},${q.y - Y}`));
  const rows = Array.from({ length: H }, (_, j) => Array.from({ length: W }, (_, i) => (set.has(`${i},${j}`) ? '=' : '.')).join(''));
  return { blk: { kind: 'beam', label, access: 'external', rows, legend: new Map(), ports: [], faceE: [], origin: { x: 0, y: 0 }, exposed: [], donor: 'scrap', bare: true }, X, Y };
}

/**
 * Corner struts: between two major blocks whose nearest cells are diagonal to each other (no overlap in x or y, so
 * neither a hanging strut nor a lengthwise tie can join them) within 8 tiles of open space, and nothing linking them
 * yet: a 45-degree stepped diagonal truss, or failing that a dogleg (lengthwise, then turning). One or two per ship,
 * the loosest blocks first; the path keeps a tile clear of every other block.
 */
function corners(c: Ctx): { diagonal: number; dogleg: number } {
  const ids = c.A.placed.map((_, i) => i).filter((i) => major((c.A.placed[i] as { block: Block }).block));
  const owner = new Map<number, number>();
  for (const i of ids) for (const t of cells(c, i)) owner.set(t.y * 100003 + t.x, i);
  // Occupied by anything but bare structure (struts may run alongside one another).
  const bareCells = new Set<number>();
  c.A.placed.forEach((p, i) => { if (p.block.bare) for (const t of cells(c, i)) bareCells.add(t.y * 100003 + t.x); });
  const anyAt = (x: number, y: number): boolean => c.A.cell(x, y) !== undefined && !bareCells.has(y * 100003 + x);
  const free = (x: number, y: number): boolean => c.A.cell(x, y) === undefined && !c.A.reserved(x, y);
  // Links: direct joins, or a bare piece (strut, brace, tie) touching both.
  const touch = new Map<number, Set<number>>();
  c.A.placed.forEach((p, i) => {
    if (!p.block.bare) return;
    const t = new Set<number>();
    for (const q of cells(c, i)) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const o = owner.get((q.y + dy) * 100003 + q.x + dx); if (o !== undefined) t.add(o); }
    touch.set(i, t);
  });
  const linked = (a: number, b: number): boolean => c.A.joins.some((j) => (j.a === a && j.b === b) || (j.a === b && j.b === a)) || [...touch.values()].some((t) => t.has(a) && t.has(b));
  const degree = (a: number): number => ids.filter((b) => b !== a && linked(a, b)).length;
  const ext = new Map(ids.map((i) => [i, extent(c, i)]));
  type Cand = { a: number; b: number; path: { x: number; y: number }[]; kind: 'diagonal' | 'dogleg'; score: number };
  const cands: Cand[] = [];
  for (const a of ids) for (const b of ids) {
    if (b <= a || linked(a, b)) continue;
    const A = ext.get(a) as ReturnType<typeof extent>;
    const B = ext.get(b) as ReturnType<typeof extent>;
    const gx = Math.max(B.x0 - A.x1, A.x0 - B.x1) - 1;
    const gy = Math.max(B.y0 - A.y1, A.y0 - B.y1) - 1;
    if (Math.max(gx, gy) > 9 || Math.max(gx, gy) < 1) continue;
    // The nearest few pairs of cells (by Chebyshev distance) between the two blocks, corner to corner only (blocks
    // facing each other squarely get hanging struts and ties instead).
    const qs = cells(c, b);
    const near: { p: { x: number; y: number }; q: { x: number; y: number }; d: number }[] = [];
    for (const p of cells(c, a)) for (const q of qs) {
      const d = Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
      if (d <= 10 && Math.abs(q.x - p.x) >= 2 && Math.abs(q.y - p.y) >= 2) near.push({ p, q, d });
    }
    near.sort((u, v) => u.d - v.d);
    for (const best of near.filter((_, i) => i % 7 === 0).slice(0, 6)) {
    const { p, q } = best;
    const sx = Math.sign(q.x - p.x);
    const sy = Math.sign(q.y - p.y);
    const crowded = (x: number, y: number, path: { x: number; y: number }[]): boolean => {
      for (let ey = -1; ey <= 1; ey++) for (let ex = -1; ex <= 1; ex++) {
        if (!anyAt(x + ex, y + ey)) continue;
        const o = owner.get((y + ey) * 100003 + x + ex);
        if (o === a || o === b || path.some((t) => t.x === x + ex && t.y === y + ey)) continue;
        return true;
      }
      return false;
    };
    const walk = (mode: 'diagonal' | 'diagonalY' | 'xy' | 'yx'): { x: number; y: number }[] | null => {
      const out: { x: number; y: number }[] = [];
      let x = p.x;
      let y = p.y;
      for (let k = 0; k < 30; k++) {
        const dx = q.x - x;
        const dy = q.y - y;
        const goX = mode === 'diagonal' ? dx !== 0 && (dy === 0 || k % 2 === 0) : mode === 'diagonalY' ? dx !== 0 && (dy === 0 || k % 2 === 1) : mode === 'xy' ? dx !== 0 : dy === 0;
        const nx = goX ? x + sx : x;
        const ny = goX ? y : y + sy;
        if (nx === q.x && ny === q.y) return out.length > 0 ? out : null;
        if (!free(nx, ny) || crowded(nx, ny, out)) return null;
        out.push({ x: nx, y: ny });
        x = nx;
        y = ny;
      }
      return null;
    };
    const diag = walk('diagonal') ?? walk('diagonalY');
    const path = diag ?? walk('xy') ?? walk('yx');
    if (!path) continue;
    cands.push({ a, b, path, kind: diag ? 'diagonal' : 'dogleg', score: Math.min(degree(a), degree(b)) * 10 + path.length });
    break;
    }
  }
  const out = { diagonal: 0, dogleg: 0 };
  const used = new Set<number>();
  const target = 2;
  for (const k of cands.sort((x, y) => x.score - y.score)) {
    if (out.diagonal + out.dogleg >= target) break;
    if (used.has(k.a) && used.has(k.b)) continue;
    const m = pathMember(k.path, `scrap: ${k.kind}`);
    if (!c.A.canPlace(m.blk, m.X, m.Y)) continue;
    c.A.place(m.blk, m.X, m.Y);
    used.add(k.a);
    used.add(k.b);
    out[k.kind]++;
  }
  return out;
}

/** Daylight: no other block (but the strut it hangs on) within `gap` tiles of the donor. */
function clearOf(c: Ctx, id: number, strutId: number, gap: number): boolean {
  const owner = new Map<number, number>();
  c.A.placed.forEach((_, i) => { if (i !== id && i !== strutId) for (const t of cells(c, i)) owner.set(t.y * 100003 + t.x, i); });
  for (const t of cells(c, id)) {
    for (let dy = -gap; dy <= gap; dy++) for (let dx = -gap; dx <= gap; dx++) if (owner.has((t.y + dy) * 100003 + t.x + dx)) return false;
  }
  return true;
}

/** A bare truss member `len` long (a column when `vertical`). */
const member = (len: number, vertical: boolean): Block => ({
  kind: 'beam', label: 'scrap: brace', access: 'external', rows: vertical ? Array<string>(len).fill('=') : ['='.repeat(len)],
  legend: new Map(), ports: [], faceE: [], origin: { x: 0, y: 0 }, exposed: [], donor: 'scrap', bare: true,
});

/** Drawn extent of a placed block. */
function extent(c: Ctx, id: number): { x0: number; y0: number; x1: number; y1: number } {
  const t = cells(c, id);
  return { x0: Math.min(...t.map((q) => q.x)), y0: Math.min(...t.map((q) => q.y)), x1: Math.max(...t.map((q) => q.x)), y1: Math.max(...t.map((q) => q.y)) };
}

/**
 * Extra members across a strut's gap: one or two parallel truss beams beside it (spaced to leave daylight between),
 * reaching from the host's wall to the donor's wherever both face each other across open space.
 */
function brace(c: Ctx, s: number, host: number, donor: number, vertical: boolean): number {
  const st = extent(c, s);
  const h = extent(c, host);
  const d = extent(c, donor);
  const free = (x: number, y: number): boolean => c.A.cell(x, y) === undefined && !c.A.reserved(x, y);
  // Along the join: columns (vertical struts) or rows (horizontal ones) both blocks span.
  const [lo, hi] = vertical ? [Math.max(h.x0, d.x0), Math.min(h.x1, d.x1)] : [Math.max(h.y0, d.y0), Math.min(h.y1, d.y1)];
  const mid = vertical ? (st.x0 + st.x1) / 2 : (st.y0 + st.y1) / 2;
  const want = 2;
  const cands = shuffle(c.rng, Array.from({ length: Math.max(0, hi - lo - 1) }, (_, i) => lo + 1 + i).filter((u) => Math.abs(u - mid) >= 3));
  const used: number[] = [];
  for (const u of cands) {
    if (used.length >= want || used.some((v) => Math.abs(v - u) < 3)) continue;
    // Walk the gap across from the strut's span, out to the first occupied cell each way (at most 3 past it).
    const [a0, a1] = vertical ? [st.y0, st.y1] : [st.x0, st.x1];
    const at = (k: number): [number, number] => (vertical ? [u, k] : [k, u]);
    let top = a0 + 1;
    while (top > a0 - 3 && free(...at(top - 1))) top--;
    let bot = a1 - 1;
    while (bot < a1 + 3 && free(...at(bot + 1))) bot++;
    if (free(...at(top - 1)) || free(...at(bot + 1)) || bot < top) continue;
    let ok = true;
    for (let k = top; k <= bot && ok; k++) ok = free(...at(k));
    if (!ok) continue;
    const m = member(bot - top + 1, vertical);
    const [X, Y] = at(top);
    if (!c.A.canPlace(m, X, Y)) continue;
    c.A.place(m, X, Y);
    used.push(u);
  }
  return used.length;
}

/** Hang a donor off `host` on a long strut, keeping daylight round it; undone if it crowds anything. */
function hang(c: Ctx, host: number, v: Block, side: Side): number | null {
  const horiz = side === 'e' || side === 'w';
  // Short struts to the flanks (the donors ride close along the hull, daylight between), longer ones fore and aft.
  const len = horiz ? c.rng.int(3, 3 + c.plan.size) : c.rng.int(3, 4);
  const s = c.A.attach(host, strut(c.rng, len, horiz), { side, align: horiz ? 'mid' : c.rng.pick(['start', 'mid', 'end', 'any'] as const), kind: 'graft' });
  if (s === null) return null;
  const id = c.A.attach(s, v, { side, align: 'mid', kind: 'graft' }) ?? c.A.attach(s, v, { side, align: 'any', kind: 'graft' });
  if (id !== null && clearOf(c, id, s, 2)) {
    const n = brace(c, s, host, id, !horiz);
    c.parts.push(n > 0 ? `strut+${n}` : 'strut');
    return id;
  }
  if (id !== null) c.A.undoLast();
  c.A.undoLast();
  return null;
}

/**
 * Compose: the anchor line (bow, anchor, drive) on the axis, then the flank donors hung off it on long struts
 * (dorsal, ventral, or ahead of the bow), daylight round each; at most one flush weld (ragged adapters) per ship.
 */
function compose(c: Ctx, f: FactionDef, mode: ScrapGrammar): boolean {
  const p = poolOf(c.plan);
  const cast = choose(c);
  const { anchor, bow, drive, flanks } = build(c, f, cast, p);
  if (!anchor) return no(c, 'anchor');
  const root = c.A.placeRoot(anchor);
  c.parts.push(mode, anchor.label);
  const line = [root];
  if (bow) {
    const id = c.A.attach(root, bow, { side: 'w', align: 'mid', kind: 'graft' });
    if (id === null) return no(c, 'bow');
    line.unshift(id);
  }
  // A lengthwise donor among the flanks extends the line aft on a strut (a longer hull, sections strung on a truss).
  let aft = root;
  const ext = anchor.faceE.length === 0 ? flanks.findIndex((b) => /container frame|liner hull|ore barge|freighter/.test(b.label)) : -1;
  if (ext >= 0 && flanks.length >= 2) {
    const blk = flanks[ext] as Block;
    const id = hang(c, root, blk, 'e') ?? hang(c, root, mirrorBlock(blk), 'e');
    if (id !== null) { flanks.splice(ext, 1); line.push(id); aft = id; c.parts.push(`extended ${blk.label}`); }
  }
  if (drive && anchor.faceE.length === 0) {
    const id = c.A.attach(aft, drive, { side: 'e', align: 'mid', kind: 'graft' }) ?? c.A.attach(aft, mirrorBlock(drive), { side: 'e', align: 'any', kind: 'graft' });
    if (id === null) return no(c, 'drive');
    line.push(id);
  } else if (drive) flanks.push(drive);
  // Flanks: biggest first, alternating dorsal and ventral (raft keeps them on one side), chain also reaches ahead.
  const order = [...flanks].sort((x, y) => y.rows.length * (y.rows[0]?.length ?? 0) - x.rows.length * (x.rows[0]?.length ?? 0));
  let side: Side = c.rng.chance(0.5) ? 'n' : 's';
  let flush = 0;
  for (const b of order) {
    const sides: Side[] = mode === 'chain' ? [side, 'w', OPP[side]] : mode === 'raft' ? [side, OPP[side], 'w'] : [side, OPP[side], 'w'];
    let id: number | null = null;
    // One dominant donor can be fused directly to the primary salvage body. Other
    // donors retain exposed struts, so the vessel has a recognizable mass and
    // still reads as improvised machinery. Never stamp onto existing modules.
    if (flush === 0 && b.rows.length >= 7 && c.rng.chance(0.72)) {
      for (const sd of sides.filter((x) => x !== 'w')) {
        const host = line[c.rng.int(0, line.length - 1)] as number;
        for (const v of variants(c, b)) {
          if (!v.ports.some((q) => q.side === OPP[sd])) continue;
          id = c.A.attach(host, v, { side: sd, align: 'mid', kind: 'graft' });
          if (id !== null) { flush++; c.parts.push('primary hull graft'); break; }
        }
        if (id !== null) break;
      }
    }
    let tries = 10;
    for (const sd of sides) {
      if (id !== null) break;
      for (const h of sd === 'w' ? [line[0] as number] : shuffle(c.rng, line)) {
        for (const v of variants(c, b)) {
          if (id !== null || tries <= 0 || !v.ports.some((q) => q.side === OPP[sd])) continue;
          tries--;
          id = hang(c, h, v, sd);
        }
      }
      if (id !== null) break;
    }
    // A flush weld (ragged adapters) only as the one fallback, and only if it touches nothing but its host.
    if (id === null && flush < 1) {
      const n0 = c.A.placed.length;
      id = weld(c, line, b, sides.filter((x) => x !== 'w'));
      if (id !== null && !touchesOnly(c, id, n0)) { for (let k = c.A.placed.length; k > n0; k--) c.A.undoLast(); id = null; }
      if (id !== null) { flush++; c.parts.push('flush'); }
    }
    if (id === null) return no(c, `hang ${b.label}`);
    c.parts.push(b.label);
    if (mode !== 'raft') side = OPP[side];
  }
  // Guns no donor carried go on the hull as sponsons; only what finds no place there gets a battery section.
  if (p.guns.length > 0) {
    const left = mountGuns(c, line.map((h) => ({ n: h, s: h })), p.guns.map((m) => weaponSpec(c.defs, [m])), { cluster: 'spread' });
    p.guns = left.flatMap((r) => r.mods);
    if (p.guns.length > 0) {
      p.share = {};
      const bat = DONORS.navyBattery.build(c, f, p);
      if (!bat || (hang(c, line[0] as number, bat, side) ?? hang(c, line[line.length - 1] as number, bat, OPP[side])) === null) return no(c, 'guns');
    }
    c.parts.push('sponsons');
  }
  const t = ties(c);
  if (t > 0) c.parts.push(`ties ${t}`);
  const k = corners(c);
  if (k.diagonal + k.dogleg > 0) c.parts.push(`corners ${k.diagonal}/${k.dogleg}`);
  return improvise(c, p);
}

export const SCRAP_GRAMMARS: Record<ScrapGrammar, (c: Ctx, f: FactionDef) => boolean> = {
  heap: (c, f) => compose(c, f, 'heap'),
  raft: (c, f) => compose(c, f, 'raft'),
  chain: (c, f) => compose(c, f, 'chain'),
};
