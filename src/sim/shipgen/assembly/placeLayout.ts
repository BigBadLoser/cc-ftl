import type { ModuleDef } from '../../registry';
import type { RoomSpec, ShipPlan } from '../plan';
import { MIN_DEPTH, outlineFrame, type Frame, type Mask } from './frame';
import { areaOf, capOf, gunsAndReactors, minLen, mirrorPairs, type Pair } from './pairs';
import { CABIN_TIER, cabinsFor } from './cabinBlock';
import { SLEEPER } from './quarters';
import { FILL_MAX, fillerSpec, maxArea, type Filler } from './roomSize';
import { opensThrough, roomKind, type RoomKind } from './roomAccess';

/**
 * PROTOTYPE (#581): rooms placed one by one into the outline's frame, the hardest first, with backtracking, instead of
 * one splitter pass. The frame (drive, bridge, spine, the dock's cross corridor) cuts each side into blocks; a room takes
 * columns at a free end of a block, full depth or one of two tiers (the other tier left open for a later room); flexible
 * rooms then take open tiers or block ends; fillers take what is left where they have a way in. Every complete layout
 * found is scored (filler floor, corridor, growth) and the best kept. North side; the south mirrors the shapes.
 */

/** A rectangle of a piece: columns [x0, x1), floor rows r0..r1 (r1 Infinity: to the hull), a spec a side or open. */
export interface Part { x0: number; x1: number; r0: number; r1: number; spec: [RoomSpec | null, RoomSpec | null]; fill?: boolean; grown?: boolean }
export interface Piece { x0: number; x1: number; parts: Part[]; cabins?: boolean }
/** A side's stretch between corridors and the drive: columns [a, b), its free runs (end exclusive) and its pieces. */
export interface Block { a: number; b: number; crossL: boolean; crossR: boolean; free: [number, number][]; pieces: Piece[] }
/** A corridor stub: a hall column from the spine to the hull. */
export interface Stub { x: number }
export interface Layout { blocks: Block[]; stern: Part | null; stubs: Stub[]; /** Program pairs placed out of turn (stacked with another). */ done: number[] }
export interface Placed { fr: Frame; lay: Layout; score: number; viable: number; nodes: number; why: Map<string, number>; /** Gun pairs pinned to the outline's gun sites, of how many sites. */ pins: number; sites: number; /** The battery's gun pairs, a blister each (prototype). */ battery: Pair[] }

const ASPECT = 3, DEEP = 1.25;
/** Floor any room may take, past its own cap: the least room a deep hull can cut (three columns by seven rows, about). */
const SMALL = 24;
/** A free stretch narrower than this is a strip: the room beside it takes it rather than a filler. */
const THIN = 6, CABIN_LEN = 11;
/** Filler rooms' specs (for the score and the prototype's metrics). */
export const fillers = new WeakSet<RoomSpec>(), repeats = new WeakSet<RoomSpec>();
const clone = (l: Layout): Layout => ({
  blocks: l.blocks.map((b) => ({ ...b, free: b.free.map(([u, v]) => [u, v] as [number, number]), pieces: b.pieces.map((p) => ({ ...p, parts: p.parts.map((q) => ({ ...q, spec: [...q.spec] as Part['spec'] })) })) })),
  stern: l.stern ? { ...l.stern, spec: [...l.stern.spec] as Part['spec'] } : null, stubs: [...l.stubs], done: [...l.done],
});

export function placeLayout(plan: ShipPlan, m: Mask, defs: Record<string, ModuleDef>, budget = 4000): Placed | null {
  const fr = outlineFrame(plan, m);
  if (!fr) return null;
  const { depth, xBand, dockAt, CW, xS, W, sternMax, used } = fr;
  const floor = (x: number, r0: number, r1: number): number => Math.max(0, Math.min(r1, depth(x)) - r0 + 1);
  const area = (x0: number, x1: number, r0: number, r1: number): number => { let a = 0; for (let x = x0; x < x1; x++) a += floor(x, r0, r1); return a; };
  const least = (x0: number, x1: number, r0: number, r1: number): number => { let a = Infinity; for (let x = x0; x < x1; x++) a = Math.min(a, floor(x, r0, r1)); return a; };
  /** A room's rows for its modules: its average depth (a notch or a step at one end takes a row off a column or two). */
  const rowsOf = (x0: number, x1: number, r0: number, r1: number): number => Math.max(least(x0, x1, r0, r1), Math.round(area(x0, x1, r0, r1) / Math.max(1, x1 - x0)));
  const fits = (r: RoomSpec, len: number, rows: number): boolean => (len >= r.w && rows >= r.h) || (len >= r.h && rows >= r.w);
  const shapely = (len: number, a: number): boolean => { const rows = a / Math.max(1, len); return len <= ASPECT * rows + 1 && rows <= DEEP * len + 1; };
  const kinds = (p: Pair | Part['spec']): RoomKind[] => p.map((r) => (r ? roomKind(r) : 'other'));

  // The program: the cabin block, then guns and reactors (the hardest to place), then the rest largest first.
  const { gunPairs, lone, reactors } = gunsAndReactors(plan, defs);
  const blockBeds = plan.quarters.filter((q) => q.block).reduce((n, q) => n + q.mods.length, 0);
  // Rooms with an annex pair together (both two tiers deep, or both with the annex beside), the rest as before.
  const restRooms = [...lone, ...reactors, ...plan.shields, ...(plan.core ? [plan.core] : []), ...plan.quarters.filter((q) => !q.block), ...plan.support, ...plan.cargo, ...plan.hangars];
  const hosts = restRooms.filter((r) => r.annex), even = hosts.slice(0, hosts.length - (hosts.length % 2));
  const others = [...mirrorPairs(restRooms.filter((r) => !even.includes(r))), ...Array.from({ length: even.length / 2 }, (_, k): Pair => {
    const a = even[2 * k] as RoomSpec, b = even[2 * k + 1] as RoomSpec, w = Math.max(a.w, b.w), h = Math.max(a.h, b.h);
    return [{ ...a, w, h }, { ...b, w, h }];
  })];
  const hard = (p: Pair): boolean => kinds(p).some((k) => k === 'reactor' || k === 'guns');
  const cabinPairs: Pair[] = [];
  if (blockBeds > 0) {
    const north = 2 * Math.ceil(blockBeds / 4), south = blockBeds - north;
    const spec = (n: number): RoomSpec => ({ role: 'quarters', mods: Array<string>(n).fill('module.bed'), w: 0, h: 0, block: true, cabins: false });
    cabinPairs.push([spec(north), spec(south)]);
  }
  // With a battery its gun pairs stand in its blisters, out of the search; any more are placed as usual.
  const searched = fr.maint ? gunPairs.slice(fr.maint.guns.length) : gunPairs;
  const order = [...cabinPairs, ...[...others.filter(hard), ...searched].sort((a, b) => areaOf(b) - areaOf(a)), ...others.filter((p) => !hard(p)).sort((a, b) => areaOf(b) - areaOf(a))];

  const blocks: Block[] = [
    { a: xBand, b: dockAt - 1, crossL: false, crossR: true, free: [[xBand, dockAt - 1]], pieces: [] },
    { a: dockAt + CW + 1, b: xS, crossL: true, crossR: false, free: [[dockAt + CW + 1, xS]], pieces: [] },
  ];
  const stern: Part | null = sternMax - used - 1 >= MIN_DEPTH ? { x0: xS + 1, x1: W, r0: used + 2, r1: Infinity, spec: [null, null] } : null;
  const start: Layout = { blocks, stern, stubs: [], done: [] };
  const crossEdge = (b: Block, x0: number, x1: number): boolean => (b.crossL && x0 === b.a) || (b.crossR && x1 === b.b);

  type Cand = { lay: Layout; cost: number };
  const why = new Map<string, number>();
  const note = (k: string): void => { why.set(k, (why.get(k) ?? 0) + 1); };

  /** Placements of a pair: a piece at a block's free end (full depth, or one tier with the other open), or an open tier. */
  /** Whether pair `q` fits columns x0..x1, rows r0..r1: its floor within its range, its modules, no strip. */
  const sized = (q: Pair, x0: number, x1: number, r0: number, r1: number): boolean => {
    const plan = areaOf(q), cap = Math.max(SMALL, Math.ceil(1.2 * plan), capOf(q)), a = area(x0, x1, r0, r1), rows = rowsOf(x0, x1, r0, r1);
    return a >= plan && a <= cap && q.every((r) => fits(r, x1 - x0, rows)) && shapely(x1 - x0, a);
  };
  function cands(lay: Layout, p: Pair, i: number, extra: [number, 'L' | 'R', number?][] = [], capAt = 0): Cand[] {
    const out: Cand[] = [];
    const ks = kinds(p), gun = ks.includes('guns'), spine = ks.includes('reactor'), annex = !!(p[0].annex || p[1].annex);
    const block = p[0].block ? p : null;
    const hostPlan = Math.max(p[0].w * p[0].h, p[1].w * p[1].h), plan0 = annex ? hostPlan : areaOf(p);
    // Some room to grow past the plan even where a pair's caps disagree (a brig opposite a med bay).
    const cap = Math.max(capAt, SMALL, Math.ceil(1.2 * plan0), annex ? Math.min(maxArea(p[0]), maxArea(p[1])) : capOf(p));
    // The annexes share a shape: the larger one's cap holds for both.
    const annexCap = Math.max(SMALL, ...p.map((h) => (h.annex ? maxArea(h.annex) * 1.3 : 0)));
    const good = (a: number): boolean => a >= plan0 && a <= cap;
    const ok = (len: number, rows: number): boolean => p.every((r) => fits(r, len, rows));
    lay.blocks.forEach((b, bi) => b.free.forEach(([L, R], fi) => {
      // Anchors: a room starts or ends at a free run's end or where the hull steps (a wing root, a taper), leaving no
      // run too short for a room beside it.
      const steps = Array.from({ length: R - L }, (_, k) => L + k).filter((x) => x > L && depth(x) !== depth(x - 1));
      const anchors: [number, 'L' | 'R', number?][] = [[L, 'L'], [R, 'R'], ...steps.flatMap((x): [number, 'L' | 'R'][] => [[x, 'L'], [x, 'R']]), ...extra.filter(([x]) => x >= L && x <= R)];
      for (const [at, end, fixed] of anchors) {
        const w = end === 'L' ? R - at : at - L;
        const x0of = (len: number): number => (end === 'L' ? at : at - len);
        const room = (x0: number, x1: number): boolean => x0 >= L && x1 <= R && (x0 === L || x0 - 1 - L >= MIN_DEPTH) && (x1 === R || R - x1 - 1 >= MIN_DEPTH);
        const lens: number[] = [];
        const put = (len: number, parts: (Omit<Part, 'x0' | 'x1'> & { x0?: number; x1?: number })[], cost: number, cabins = false): void => {
          const x0 = x0of(len), x1 = x0 + len, nl = clone(lay), nb = nl.blocks[bi] as Block;
          nb.pieces.push({ x0, x1, parts: parts.map((q) => ({ x0, x1, ...q })), ...(cabins ? { cabins } : {}) });
          nb.free.splice(fi, 1, ...(x0 > L ? [[L, x0 - 1] as [number, number]] : []), ...(x1 < R ? [[x1 + 1, R] as [number, number]] : []));
          out.push({ lay: nl, cost });
        };
        if (block) {
          // A cabin block: one unit (11 columns), a column of cabins each side of its corridor (bunks when the beds
          // outnumber the cabins); never more, two units is a sprawl of cabins.
          const per = Math.max(p[0].mods.length, p[1].mods.length);
          for (const [units, len] of [[1, CABIN_LEN]] as const) {
            const rows = CABIN_TIER * Math.max(2, Math.ceil(per / (2 * units * SLEEPER.sleepers))) - 1, x0 = x0of(len);
            if (len > w || !room(x0, x0 + len) || least(x0, x0 + len, 1, Infinity) < rows) continue;
            put(len, [{ r0: 1, r1: Infinity, spec: [{ ...p[0], w: len, h: rows }, { ...p[1], w: len, h: rows }] }], x0 + len === b.b ? 0 : 0.5, true);
          }
          continue;
        }
        // (A fixed length: a gun site's span.)
        for (let len = Math.max(...p.map(minLen), MIN_DEPTH); len <= w; len++) if ((fixed === undefined || len === fixed) && room(x0of(len), x0of(len) + len)) lens.push(len);
        // Full depth: the shortest length that holds the room (and the free end exactly, when that is in range).
        if (!annex) for (const len of lens) {
          const x0 = x0of(len), a = area(x0, x0 + len, 1, Infinity);
          if (a > cap) break;
          if (good(a) && ok(len, rowsOf(x0, x0 + len, 1, Infinity)) && shapely(len, a)) { put(len, [{ r0: 1, r1: Infinity, spec: [p[0], p[1]] }], a / plan0 - 1); break; }
        }
        // A room with an annex too shallow for it behind: the annex beside it, opening only into it.
        if (annex) for (let lh = Math.max(MIN_DEPTH, ...p.map((h) => Math.min(h.w, h.h))); lh <= w; lh++) {
          const x0 = end === 'L' ? at : at - lh, ah = area(x0, x0 + lh, 1, Infinity);
          if (ah > cap) break;
          if (!good(ah) || !ok(lh, rowsOf(x0, x0 + lh, 1, Infinity)) || !shapely(lh, ah)) continue;
          let la = MIN_DEPTH;
          const ax = (l: number): number => (end === 'L' ? x0 + lh + 1 : x0 - 1 - l);
          const enough = (l: number): boolean => p.every((h) => !h.annex || (area(ax(l), ax(l) + l, 1, Infinity) >= h.annex.w * h.annex.h && fits(h.annex, l, least(ax(l), ax(l) + l, 1, Infinity))));
          while (lh + 1 + la <= w && !enough(la)) la++;
          const len = lh + 1 + la;
          if (!enough(la) || !lens.includes(len) || x0of(len) !== Math.min(x0, ax(la)) || p.some((h) => h.annex && area(ax(la), ax(la) + la, 1, Infinity) > annexCap)) break;
          put(len, [{ r0: 1, r1: Infinity, spec: [p[0], p[1]], x0, x1: x0 + lh }, { r0: 1, r1: Infinity, spec: [p[0].annex ?? null, p[1].annex ?? null], x0: ax(la), x1: ax(la) + la }], ah / plan0 - 1 + 0.4);
          break;
        }
        // Two tiers, the room in front (on the spine) or behind (on the hull), split at row r.
        if (lens.length === 0) continue;
        const dMax = least(x0of(lens[0] as number), x0of(lens[0] as number) + (lens[0] as number), 1, Infinity);
        for (let r = MIN_DEPTH; r <= dMax - MIN_DEPTH - 1; r++) {
          for (const front of [true, false]) {
            if ((front && gun) || (!front && (spine || annex))) continue;
            for (const len of lens) {
              const x0 = x0of(len), x1 = x0 + len;
              if (least(x0, x1, 1, Infinity) - r - 1 < MIN_DEPTH) break;
              const [r0, r1] = front ? [1, r] : [r + 2, Infinity], a = area(x0, x1, r0, r1);
              if (a > cap) break;
              if (!good(a) || !ok(len, rowsOf(x0, x1, r0, r1)) || !shapely(len, a)) continue;
              const self: Omit<Part, 'x0' | 'x1'> = { r0, r1, spec: [p[0], p[1]] }, rest: Omit<Part, 'x0' | 'x1'> = { r0: front ? r + 2 : 1, r1: front ? Infinity : r, spec: [null, null] };
              if (annex && !(p[0].annex && p[1].annex) && !crossEdge(b, x0, x1)) break;
              if (annex) {
                // The annex behind its host from the end away from a cross corridor, as long as it needs; the rest of
                // the back tier stays open (on the corridor where there is one).
                const toL = !(b.crossL && x0 === b.a), need = (la: number, at: number): boolean => p.every((h) => !h.annex || (area(at, at + la, r + 2, Infinity) >= h.annex.w * h.annex.h && fits(h.annex, la, least(at, at + la, r + 2, Infinity))));
                let la = MIN_DEPTH;
                const at = (l: number): number => (toL ? x0 : x1 - l);
                while (la < len && !need(la, at(la))) la++;
                if (!need(la, at(la))) continue;
                if (len - la - 1 < MIN_DEPTH) la = len;
                if (p.some((h) => h.annex && area(at(la), at(la) + la, r + 2, Infinity) > annexCap)) continue;
                const an = { r0: r + 2, r1: Infinity, spec: [p[0].annex ?? null, p[1].annex ?? null] as Part['spec'], x0: at(la), x1: at(la) + la };
                const more = la < len ? [{ r0: r + 2, r1: Infinity, spec: [null, null] as Part['spec'], x0: toL ? x0 + la + 1 : x0, x1: toL ? x1 : x1 - la - 1 }] : [];
                put(len, [self, an, ...more], a / plan0 - 1 + 0.3);
                break;
              }
              // Behind with no way in but through the room in front (still open): a little dearer than on a cross corridor.
              // Left open only where something could still take that tier: a cross corridor, a filler with a way in,
              // the room growing into it, or a later pair (stacked below).
              const fillable = crossEdge(b, x0, x1) || (front ? ks.every((k) => k === 'workshop' || k === 'farm' || k === 'other') || area(x0, x1, 1, Infinity) <= cap * 1.25 : ks.every((k) => k === 'guns'));
              if (fillable) put(len, front ? [self, rest] : [rest, self], a / plan0 - 1 + 0.3 + (!front && !crossEdge(b, x0, x1) ? 0.2 : 0));
              // Stacked: a later pair takes the other tier now, where it has a way in (a cross corridor, or through the
              // room in front).
              for (let j = 0; j < order.length; j++) {
                if (j === i) continue;
                const q = order[j] as Pair, kq = kinds(q);
                if (lay.done.includes(j) || q[0].block || q[0].annex || q[1].annex || (front ? kq.includes('reactor') : kq.includes('guns'))) continue;
                if (!sized(q, x0, x1, rest.r0, rest.r1)) continue;
                const via = crossEdge(b, x0, x1) || (front ? kq.every((k, s) => opensThrough(k, ks[s] as RoomKind)) : ks.every((k, s) => opensThrough(k, kq[s] as RoomKind)));
                if (!via) continue;
                const two = { ...rest, spec: [q[0], q[1]] as Part['spec'] };
                put(len, front ? [self, two] : [two, self], a / plan0 - 1 - 0.2);
                (out[out.length - 1] as Cand).lay.done.push(j);
              }
              break;
            }
          }
        }
      }
    }));
    // Open tiers a room takes whole or from one end (the rest staying open where a room still fits it).
    const slots: [Part, Part | null, Block | null][] = [];
    for (const b of lay.blocks) for (const pc of b.pieces) for (const q of pc.parts) if (!q.spec[0] && !q.spec[1] && !q.fill) slots.push([q, pc.parts.find((o) => o !== q) ?? null, b]);
    if (lay.stern && !lay.stern.spec[0]) slots.push([lay.stern, null, null]);
    if (!block && !annex) for (const [q, o, b] of slots) {
      const back = q.r1 === Infinity && q.r0 > 1;
      if ((gun && !back) || (spine && back)) continue;
      for (const [x0, x1] of [[q.x0, q.x1], ...[...Array(Math.max(0, q.x1 - q.x0 - MIN_DEPTH - 1)).keys()].flatMap((k) => { const l = k + MIN_DEPTH; return [[q.x0, q.x0 + l], [q.x1 - l, q.x1]]; })] as [number, number][]) {
        const a = area(x0, x1, q.r0, q.r1), len = x1 - x0;
        if (!good(a) || !ok(len, rowsOf(x0, x1, q.r0, q.r1)) || !shapely(len, a)) continue;
        if (x1 - x0 < q.x1 - q.x0 && q.x1 - q.x0 - len - 1 < MIN_DEPTH) continue;
        // Its way in: the spine (in front), a cross corridor it touches, the room in front (or the engines astern).
        const ins = !b ? ks.every((k) => opensThrough(k, 'engine'))
          : !back ? (!o?.spec[0] || (b && crossEdge(b, o.x0, o.x1)) || kinds(o.spec).every((f, s) => opensThrough(f, ks[s] as RoomKind)))
            : crossEdge(b, x0, x1) || (!!o?.spec[0] && kinds(o.spec).every((f, s) => opensThrough(ks[s] as RoomKind, f)));
        if (!ins) continue;
        const nl = clone(lay);
        const find = (l: Layout): Part => (b ? (l.blocks.flatMap((bb) => bb.pieces.flatMap((pc) => pc.parts)).find((z) => z.x0 === q.x0 && z.r0 === q.r0 && z.x1 === q.x1) as Part) : (l.stern as Part));
        const nq = find(nl), pc = b ? nl.blocks.flatMap((bb) => bb.pieces).find((z) => z.parts.includes(nq)) : null;
        if (x1 - x0 === q.x1 - q.x0) nq.spec = [p[0], p[1]];
        else {
          const restP: Part = { ...nq, x0: x0 === q.x0 ? x1 + 1 : q.x0, x1: x0 === q.x0 ? q.x1 : x0 - 1, spec: [null, null] };
          Object.assign(nq, { x0, x1, spec: [p[0], p[1]] });
          pc?.parts.push(restP);
        }
        out.push({ lay: nl, cost: a / plan0 - 1 - 0.2 });
      }
    }
    return out.sort((x, y) => x.cost - y.cost);
  }

  // Fillers into what is left; null (with the reason noted) where some floor has no legal room or way in.
  const fillLeft = (): Filler[] => ['workshop', 'lounge', 'armoury', 'gym', 'farm'];
  function finish(lay0: Layout): Layout | null {
    const lay = clone(lay0), left = fillLeft();
    const pick = (ok: (k: RoomKind) => boolean, a: number): RoomSpec | null => {
      // The kinds left first, then holds; past those, a kind again (counted: the fillers' one-a-ship rule broken).
      for (const f of [...left, 'hold' as const, ...fillLeft().filter((k) => !left.includes(k))]) {
        const s = fillerSpec(f, a);
        if (a >= 9 && ok(roomKind(s))) { if (left.includes(f)) left.splice(left.indexOf(f), 1); else if (f !== 'hold') repeats.add(s); fillers.add(s); return s; }
      }
      return null;
    };
    const cut = (x0: number, x1: number, n: number): [number, number][] => Array.from({ length: n }, (_, k) => [x0 + Math.round(((x1 - x0 + 1) * k) / n), x0 + Math.round(((x1 - x0 + 1) * (k + 1)) / n) - 1]);
    const add = (b: Block, x0: number, x1: number, r0: number, r1: number, s: RoomSpec): void => { b.pieces.push({ x0, x1, parts: [{ x0, x1, r0, r1, spec: [s, s], fill: true }] }); };
    // Fillers cut along a tier, as many as keep each within the fillers' size and no narrower than a room.
    const row = (b: Block, x0: number, x1: number, r0: number, r1: number): void => {
      const n = Math.max(1, Math.min(Math.floor((x1 - x0 + 1) / (THIN + 1)), Math.ceil(area(x0, x1, r0, r1) / FILL_MAX)));
      for (const [c0, c1] of cut(x0, x1, n)) add(b, c0, c1, r0, r1, pick(() => true, area(c0, c1, r0, r1)) ?? fillerSpec('hold', 9));
    };
    const deepCol = (x: number): boolean => depth(x) >= 2 * MIN_DEPTH + 1;
    // A free stretch too narrow for a filler that isn't a strip: the rooms beside it share it (the plating column between
    // them moves), or the one that can take it alone; a cabin block widens its cabins up to five columns more.
    for (const b of lay.blocks) b.free = b.free.filter(([L, R]) => {
      if (R - L >= THIN) return true;
      const ok = (pc: Piece | undefined, x0: number, x1: number): pc is Piece => !!pc && (!pc.cabins || pc.parts.every((q) => q.spec.every((h) => !h || cabinsFor(h, x1 - x0, least(x0, x1, 1, Infinity))?.stubs.length === 1)));
      const lp0 = b.pieces.find((pc) => pc.x1 === L - 1), rp0 = b.pieces.find((pc) => pc.x0 === R + 1);
      const to = (pc: Piece, x0: number, x1: number): void => {
        for (const q of pc.parts) { if (q.x0 === pc.x0) q.x0 = x0; if (q.x1 === pc.x1) q.x1 = x1; }
        pc.x0 = x0; pc.x1 = x1;
      };
      const m = (L - 1 + R) >> 1;
      if (ok(lp0, lp0?.x0 ?? 0, m) && ok(rp0, m + 1, rp0?.x1 ?? 0) && !lp0.cabins && !rp0.cabins) { to(lp0, lp0.x0, m); to(rp0, m + 1, rp0.x1); return false; }
      if (ok(lp0, lp0?.x0 ?? 0, R)) { to(lp0, lp0.x0, R); return false; }
      if (ok(rp0, L, rp0?.x1 ?? 0)) { to(rp0, L, rp0.x1); return false; }
      return true;
    });
    for (const [bi, b] of lay.blocks.entries()) for (const [L, R] of b.free) {
      const w = R - L;
      if (w < MIN_DEPTH) { note(`sliver b${bi}`); return null; }
      // A free stretch in runs of shallow and deep columns (a run narrower than a room joins its neighbour), a plating
      // column between runs: shallow runs full-depth fillers; deep runs two tiers, the back on a cross corridor, on a
      // corridor stub of its own, or a hold behind a workshop.
      const runs: [number, number, boolean][] = [];
      for (let x = L; x < R;) { const dp = deepCol(x); let e = x; while (e < R && deepCol(e) === dp) e++; runs.push([x, e, dp]); x = e; }
      for (let i = 0; i < runs.length;) {
        const [x0, x1] = runs[i] as [number, number, boolean];
        if (x1 - x0 >= MIN_DEPTH + 1 || runs.length === 1) { i++; continue; }
        const j = i > 0 ? i - 1 : i + 1, o = runs[j] as [number, number, boolean];
        runs.splice(Math.min(i, j), 2, [Math.min(x0, o[0]), Math.max(x1, o[1]), o[2]]);
        i = 0;
      }
      for (const [k, [s0, e0, dp]] of runs.entries()) {
        const x0 = s0, x1 = k < runs.length - 1 ? e0 - 1 : e0, dMin = least(x0, x1, 1, Infinity);
        const r = Math.max(MIN_DEPTH, Math.min(dMin - MIN_DEPTH - 1, Math.round(dMin / 2)));
        const wide = Math.ceil(area(x0, x1, 1, Infinity) / FILL_MAX) <= Math.floor((x1 - x0 + 1) / (THIN + 1));
        if (!dp || dMin - r - 1 < MIN_DEPTH || wide) { row(b, x0, x1, 1, Infinity); continue; }
        if (crossEdge(b, x0, x1) && area(x0, x1, r + 2, Infinity) <= 1.3 * FILL_MAX) { row(b, x0, x1, 1, r); add(b, x0, x1, r + 2, Infinity, pick(() => true, area(x0, x1, r + 2, Infinity)) as RoomSpec); continue; }
        // A stub: amid a run wide enough for a room each side, else at its end farther from other corridors (none
        // nearer than two rooms' width).
        const near = (c: number): number => Math.min(Math.abs(c - dockAt), Math.abs(c - dockAt - CW + 1), ...lay.stubs.map((q) => Math.abs(c - q.x)));
        const endSt = near(x0) >= near(x1 - 1) ? x0 : x1 - 1;
        if (x1 - x0 >= MIN_DEPTH + 2 && x1 - x0 < 2 * MIN_DEPTH + 3 && near(endSt) >= 2 * MIN_DEPTH + 4) {
          lay.stubs.push({ x: endSt });
          const [h0, h1] = endSt === x0 ? [x0 + 1, x1] : [x0, x1 - 1];
          row(b, h0, h1, 1, r);
          add(b, h0, h1, r + 2, Infinity, pick(() => true, area(h0, h1, r + 2, Infinity)) as RoomSpec);
          continue;
        }
        if (x1 - x0 >= 2 * MIN_DEPTH + 3) {
          const st = x0 + ((x1 - x0) >> 1);
          lay.stubs.push({ x: st });
          for (const [h0, h1] of [[x0, st], [st + 1, x1]] as const) {
            row(b, h0, h1, 1, r);
            const back = dMin - r - 1, m = Math.max(1, Math.min(Math.floor((back + 1) / (MIN_DEPTH + 1)), Math.ceil(area(h0, h1, r + 2, Infinity) / FILL_MAX)));
            for (let j = 0; j < m; j++) {
              const r0 = r + 2 + Math.round((j * (back + 1)) / m), r1 = j === m - 1 ? Infinity : r + 2 + Math.round(((j + 1) * (back + 1)) / m) - 2;
              add(b, h0, h1, r0, r1, pick(() => true, area(h0, h1, r0, r1)) as RoomSpec);
            }
          }
          continue;
        }
        if (left.includes('workshop')) {
          left.splice(left.indexOf('workshop'), 1);
          const ws = fillerSpec('workshop', area(x0, x1, 1, r)), hold = fillerSpec('hold', area(x0, x1, r + 2, Infinity));
          fillers.add(ws); fillers.add(hold);
          b.pieces.push({ x0, x1, parts: [{ x0, x1, r0: 1, r1: r, spec: [ws, ws], fill: true }, { x0, x1, r0: r + 2, r1: Infinity, spec: [hold, hold], fill: true }] });
          continue;
        }
        note(`deep-noaccess b${bi} x${x0}-${x1} d${dMin}`);
        return null;
      }
    }
    // Open tiers: a filler with a way in, else the room in front grows into it, else this layout fails.
    for (const [bi, b] of lay.blocks.entries()) for (const pc of b.pieces) for (const q of [...pc.parts].sort((u, v) => u.r0 - v.r0)) {
      if ((q.spec[0] && q.spec[1]) || q.fill || q.x1 <= q.x0) continue;
      const o = pc.parts.find((z) => z !== q && z.x0 <= q.x0 && q.x1 <= z.x1 && z.r0 !== q.r0) ?? pc.parts.find((z) => z !== q && z.r0 !== q.r0);
      const back = q.r1 === Infinity && q.r0 > 1, a = area(q.x0, q.x1, q.r0, q.r1);
      // The room in front grows into it where both sides are open and it stays near its cap.
      const a2 = o ? area(o.x0, o.x1, Math.min(o.r0, q.r0), Infinity) : Infinity;
      if (!q.spec[0] && !q.spec[1] && o?.spec[0] && o.spec[1] && !o.fill && o.x0 === q.x0 && o.x1 === q.x1 && a2 <= Math.max(SMALL, capOf([o.spec[0], o.spec[1]])) * 1.25) {
        o.r0 = Math.min(o.r0, q.r0); o.r1 = Math.max(o.r1, q.r1); o.grown = true; q.x1 = q.x0; continue;
      }
      for (const side of [0, 1] as const) {
        if (q.spec[side]) continue;
        const f = o?.spec[side] ? roomKind(o.spec[side] as RoomSpec) : null;
        const s = back
          ? pick((k) => crossEdge(b, q.x0, q.x1) || (!!f && opensThrough(k, f) && !(k === 'cargo' && f === 'cargo')), a)
          : pick((k) => k !== 'cargo' && (!f || !o || crossEdge(b, o.x0, o.x1) || opensThrough(f, k)), a);
        if (!s) { note(`pocket b${bi} ${back ? 'behind' : 'before'} ${f ?? '?'} x${q.x0}-${q.x1} d${least(q.x0, q.x1, 1, Infinity)}`); return null; }
        q.spec[side] = s;
      }
    }
    if (lay.stern && !lay.stern.spec[0]) lay.stern.grown = true;
    return lay;
  }

  const roomsOf = (l: Layout): Part[] => l.blocks.flatMap((b) => b.pieces.flatMap((pc) => pc.parts)).filter((q) => q.spec.some((v) => v) && q.x1 > q.x0);
  const score = (l: Layout): number => {
    let fill = 0, grow = 0;
    for (const q of roomsOf(l)) {
      const a = area(q.x0, q.x1, q.r0, q.r1);
      // A strip: narrower than a filler may be and deeper than wide.
      if (q.x1 - q.x0 < THIN - 1 && a > (q.x1 - q.x0) ** 2 && !q.spec.some((h) => h?.block)) fill += 40;
      for (const r of q.spec) if (r && fillers.has(r)) fill += a / 2; else if (r && !r.block) grow += Math.max(0, a / Math.max(1, r.w * r.h) - 1) / 2;
    }
    return fill + 4 * l.stubs.reduce((t, s) => t + depth(s.x), 0) + 15 * grow;
  };

  let last: Layout = start, nodes = 0, viable = 0, best: Layout | null = null, bestScore = Infinity, deepest = -1;
  // PROTOTYPE: with gun sites on the outline, a gun pair goes only on a free site (its room within the blister, give or
  // take a tile, reaching the hull), while one is left; other rooms never stack a gun outside one.
  // Sites on the band only (none in the bridge or the drive).
  const sites = (m.sites ?? []).filter(([s0, s1]) => s0 > xBand + MIN_DEPTH && s1 < xS - 1);
  // The blister exactly, on the hull.
  const inSite = (q: Part, [s0, s1]: [number, number]): boolean => q.r1 === Infinity && q.x0 === s0 && q.x1 === s1;
  const guns = (l: Layout): Part[] => l.blocks.flatMap((b) => b.pieces.flatMap((pc) => pc.parts)).filter((q) => q.spec.some((h) => h && roomKind(h) === 'guns'));
  function candsAt(lay: Layout, k: number): Cand[] {
    const p = order[k] as Pair, had = guns(lay);
    const free = sites.filter((st) => !had.some((q) => q.x0 < st[1] && st[0] < q.x1));
    const isGun = kinds(p).includes('guns');
    const spans = free.flatMap(([s0, s1]) => [[s0, 'L', s1 - s0] as [number, 'L', number]]);
    const cs = cands(lay, p, k, isGun ? spans : []);
    if (sites.length === 0) return cs;
    return cs.filter((c) => {
      const added = guns(c.lay).filter((q) => !had.some((h) => h.x0 === q.x0 && h.r0 === q.r0 && h.spec[0] === q.spec[0]));
      if (!added.every((q) => (isGun && q.spec[0] === p[0] && free.length === 0) || free.some((st) => inSite(q, st)))) return false;
      // A free site's hull side is kept for a gun: no other room reaches the hull across it.
      const left = free.filter((st) => !added.some((q) => q.x0 < st[1] && st[0] < q.x1));
      const parts = c.lay.blocks.flatMap((b) => b.pieces.flatMap((pc) => pc.parts)).filter((q) => q.r1 === Infinity && q.spec.some((h) => h && roomKind(h) !== 'guns'));
      return !parts.some((q) => left.some(([s0, s1]) => q.x0 < s1 && s0 < q.x1));
    });
  }
  // The most constrained pair next (fewest placements left; the program's order breaks ties), its best few tried in turn.
  // Whether the layout got past its next pair (a placement that strands a later pair at once is not counted a try).
  const dfs = (lay: Layout): boolean => {
    if (nodes++ > budget) return true;
    let todo = order.map((_, k) => k).filter((k) => !lay.done.includes(k));
    // With gun sites, the guns first (they take their sites), the rest filled round them.
    const gunsLeft = todo.filter((k) => kinds(order[k] as Pair).includes('guns'));
    if (sites.length > 0 && gunsLeft.length > 0 && sites.some((st) => !guns(lay).some((q) => q.x0 < st[1] && st[0] < q.x1))) todo = gunsLeft;
    if (todo.length === 0) {
      const done = finish(lay);
      if (!done) last = lay;
      if (done) { viable++; const s = score(done); if (s < bestScore) { bestScore = s; best = done; } }
      return true;
    }
    let i = -1, cs: Cand[] = [];
    for (const k of todo) {
      const c = candsAt(lay, k);
      if (i < 0 || c.length < cs.length) { i = k; cs = c; }
      if (cs.length === 0) break;
    }
    if (cs.length === 0) {
      if (lay.done.length >= deepest) { deepest = lay.done.length; last = lay; note(`no place ${kinds(order[i] as Pair).join('/')}`); }
      return false;
    }
    let tries = 0;
    for (const c of cs) {
      if (tries >= 3 || nodes > budget) break;
      c.lay.done.push(i);
      if (dfs(c.lay)) tries++;
    }
    return true;
  };
  dfs(start);
  const gunAt = (l: Layout, [s0, s1]: [number, number]): boolean => l.blocks.some((b) => b.pieces.some((pc) => pc.parts.some((q) => q.spec.some((h) => h && roomKind(h) === 'guns') && q.x0 < s1 && s0 < q.x1)));
  const bat = fr.maint ? gunPairs.slice(0, fr.maint.guns.length) : [];
  const pins = fr.maint ? bat.length : best ? (m.sites ?? []).filter((st) => gunAt(best as Layout, st)).length : 0;
  const nSites = fr.maint ? fr.maint.guns.length : sites.length;
  if (!best) return { fr, lay: last, score: Infinity, viable: 0, nodes, why, pins, sites: nSites, battery: bat };
  return { fr, lay: best, score: bestScore, viable, nodes, why, pins, sites: nSites, battery: bat };
}
