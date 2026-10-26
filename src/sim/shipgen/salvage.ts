import { isContainerCell } from './containerCells';
import type { Arranger, Block, BlockPort, Side } from './arranger';
import { blockFrom } from './blocks';
import type { Builder } from './builder';
import { roleOfLetter } from './canvas';
import { shuffle, type RoomSpec } from './plan';
import type { Rng } from '../rng';
import type { AccessKind, RoomRole } from './types';

/**
 * Salvage operations on a drawn section (a local Builder) before it is frozen into a block: cut it off at a seam,
 * knock corners off it, then find its graft ports from whatever outline is left. Rooms are never cut through: cuts
 * run along wall lines and corridors, damage only takes floor a room can spare, and every cut edge is resealed
 * into wall.
 */

const isFloor = (c: string): boolean => c === '_';

/** The role and contents of the room under a cell (undefined: not a room). */
export function roomAt(b: Builder, x: number, y: number): { role: RoomRole; spec?: RoomSpec; label: number } | undefined {
  const l = b.cv.labelAt(x, y);
  if (l < 0 || !isFloor(b.cv.at(x, y))) return undefined;
  const lab = b.cv.labels[l] as { chunk: string; letter: string };
  const part = b.parts.find((p) => p.key === lab.chunk);
  const k = `${lab.chunk}:${lab.letter}`;
  const role = part?.role ?? b.chunkRoles.get(k) ?? roleOfLetter(lab.letter) ?? 'cargo';
  const spec = part?.spec ?? b.chunkSpecs.get(k);
  return { role, label: l, ...(spec ? { spec } : {}) };
}

function bbox(b: Builder): { x0: number; y0: number; x1: number; y1: number } {
  const c = b.cv.crop();
  return { x0: c.ox + 1, y0: c.oy + 1, x1: c.ox + c.width - 2, y1: c.oy + c.height - 2 };
}

/** Turn the given floor cells into wall where they touch space (diagonally too, with `diag`): a cut edge becomes hull. */
function reseal(b: Builder, cells: [number, number][], diag: boolean): void {
  const near = diag ? [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] : [[0, -1], [-1, 0], [1, 0], [0, 1]];
  const hit = cells.filter(([x, y]) => (isFloor(b.cv.at(x, y)) || b.cv.at(x, y) === 'D') && near.some(([dx, dy]) => b.cv.at(x + (dx as number), y + (dy as number)) === '.'));
  for (const [x, y] of hit) b.cv.put(x, y, '#');
}

/**
 * Cut the section off at a seam column (only walls, space, beams and at most two corridor tiles in it: no room is
 * cut through), keeping the west or east part. Returns false when no seam leaves a useful piece.
 */
export function cutSeam(b: Builder, rng: Rng, keep: 'w' | 'e', minKeep = 0.45, minLoss = 0.15): boolean {
  const { x0, y0, x1, y1 } = bbox(b);
  const floorIn = (a: number, z: number): number => {
    let n = 0;
    for (let y = y0; y <= y1; y++) for (let x = a; x <= z; x++) if (isFloor(b.cv.at(x, y))) n++;
    return n;
  };
  const total = floorIn(x0, x1);
  const seams: number[] = [];
  for (let X = x0 + 3; X <= x1 - 3; X++) {
    let hall = 0;
    let ok = true;
    for (let y = y0; y <= y1 && ok; y++) {
      // A door in the seam would leave the room behind it shut.
      const inner = roomAt(b, keep === 'w' ? X - 1 : X + 1, y);
      if (b.cv.at(X, y) === 'D' && inner && inner.role !== 'hall') ok = false;
      // Never through a sealed container: it goes whole or stays whole.
      if (isContainerCell(b.cv.at(X, y))) ok = false;
      const r = roomAt(b, X, y);
      if (!r) continue;
      if (r.role === 'hall') hall++;
      else ok = false;
    }
    if (!ok || hall > 2) continue;
    const kept = keep === 'w' ? floorIn(x0, X - 1) : floorIn(X + 1, x1);
    if (kept >= minKeep * total && total - kept >= minLoss * total) seams.push(X);
  }
  if (seams.length === 0) return false;
  const X = rng.pick(seams);
  for (let y = y0 - 1; y <= y1 + 1; y++) {
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (keep === 'w' ? x > X : x < X) b.cv.put(x, y, '.');
      else if (x === X && b.cv.at(x, y) !== '.' && b.cv.at(x, y) !== '=') b.cv.put(x, y, '#');
    }
  }
  const edge: [number, number][] = [];
  for (let y = y0; y <= y1; y++) for (let x = X - 1; x <= X + 1; x++) edge.push([x, y]);
  reseal(b, edge, false);
  return true;
}

/** Floor a room can lose and still hold its modules (interior minus footprints, less a walkway). */
function slack(b: Builder, label: number, spec: RoomSpec | undefined, defs: Record<string, { footprint: readonly number[] }>): number {
  let area = 0;
  for (let k = 0; k < b.cv.label.length; k++) if (b.cv.label[k] === label && b.cv.cells[k] === '_') area++;
  const need = (spec?.mods ?? []).reduce((t, m) => t + ((defs[m]?.footprint[0] ?? 1) * (defs[m]?.footprint[1] ?? 1)), 0);
  return area - need * 2 - 2;
}

/**
 * Knock a k x k corner off the section (a missing corner, the stub of a breach welded shut): only on a convex outer
 * corner of a room that can spare the floor, never through a door, a corridor, a sealed pod or an engine room.
 */
export function notch(b: Builder, rng: Rng, k: number, defs: Record<string, { footprint: readonly number[] }>): boolean {
  const { x0, y0, x1, y1 } = bbox(b);
  const corners: { x: number; y: number; dx: number; dy: number }[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (b.cv.at(x, y) !== '#') continue;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        if (b.cv.at(x + dx, y) === '.' && b.cv.at(x, y + dy) === '.' && b.cv.at(x + dx, y + dy) === '.' && isFloor(b.cv.at(x - dx, y - dy))) corners.push({ x, y, dx, dy });
      }
    }
  }
  for (const c of shuffle(rng, corners)) {
    const cut: [number, number][] = [];
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) cut.push([c.x - c.dx * i, c.y - c.dy * j]);
    const ring: [number, number][] = [];
    for (let j = 0; j <= k; j++) for (let i = 0; i <= k; i++) if (i === k || j === k) ring.push([c.x - c.dx * i, c.y - c.dy * j]);
    const touched = [...cut, ...ring];
    if (touched.some(([x, y]) => b.cv.at(x, y) === 'D' || b.cv.at(x, y) === '=' || isContainerCell(b.cv.at(x, y)))) continue;
    const rooms = new Set<number>();
    let ok = true;
    for (const [x, y] of touched) {
      const r = roomAt(b, x, y);
      if (!r) continue;
      if (r.role === 'hall' || r.role === 'engine' || r.role === 'dock' || r.spec?.sealed) ok = false;
      rooms.add(r.label);
    }
    if (!ok || rooms.size !== 1) continue;
    const label = [...rooms][0] as number;
    const spec = roomAt(b, c.x - c.dx, c.y - c.dy)?.spec;
    if (slack(b, label, spec, defs) < k * k) continue;
    for (const [x, y] of cut) b.cv.put(x, y, '.');
    reseal(b, ring, true);
    // A cut cell diagonal to a neighbouring room's floor was that room's hull corner: it stays wall, so no corner opens.
    for (const [x, y] of cut) if ([-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => isFloor(b.cv.at(x + dx, y + dy)) || b.cv.at(x + dx, y + dy) === 'D'))) b.cv.put(x, y, '#');
    return true;
  }
  return false;
}

/** Room specs still on the section (to hand back what a cut took away). */
export function survivors(b: Builder): Set<RoomSpec> {
  const out = new Set<RoomSpec>();
  const seen = new Set<number>();
  const { x0, y0, x1, y1 } = bbox(b);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const l = b.cv.labelAt(x, y);
      if (l < 0 || seen.has(l)) continue;
      seen.add(l);
      const s = roomAt(b, x, y)?.spec;
      if (s) out.add(s);
    }
  }
  return out;
}

/** Rooms whose walls take no grafts: their equipment needs its own door and hull where they were built. */
const FIXED = new Set<RoomRole>(['engine', 'dock', 'hangar', 'reactor']);

const OUT: Record<Side, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

/**
 * Graft ports from the outline: every run of outer wall with one room (or corridor) inside and space outside.
 * Corridor ends are 'h' ports, room walls 'r' ports; sealed pods, engine rooms, airlocks and bays take no grafts.
 */
export function autoPorts(b: Builder, access: AccessKind = 'human'): BlockPort[] {
  const { x0, y0, x1, y1 } = bbox(b);
  const ports: BlockPort[] = [];
  const count: Record<string, number> = {};
  for (const side of ['n', 's', 'e', 'w'] as const) {
    const [dx, dy] = OUT[side];
    const horiz = side === 'n' || side === 's';
    const lines = horiz ? [y0, y1] : [x0, x1];
    for (let a = lines[0] as number; a <= (lines[1] as number); a++) {
      let run: { start: number; len: number; label: number; hall: boolean } | null = null;
      const flush = (): void => {
        if (!run) return;
        const pre = run.hall ? 'h' : 'r';
        const id = `${pre}${side}${(count[pre + side] = (count[pre + side] ?? -1) + 1)}`;
        ports.push(horiz ? { id, side, x: run.start, y: a, len: run.len, access } : { id, side, x: a, y: run.start, len: run.len, access });
        run = null;
      };
      const lo = horiz ? x0 : y0;
      const hi = horiz ? x1 : y1;
      for (let t = lo; t <= hi + 1; t++) {
        const x = horiz ? t : a;
        const y = horiz ? a : t;
        const inside = t <= hi && b.cv.at(x, y) === '#' && b.cv.at(x + dx, y + dy) === '.' ? roomAt(b, x - dx, y - dy) : undefined;
        const usable = inside && !inside.spec?.sealed && !FIXED.has(inside.role);
        if (usable && run && run.label === inside.label) { run.len++; continue; }
        flush();
        if (usable) run = { start: t, len: 1, label: inside.label, hall: inside.role === 'hall' };
      }
    }
  }
  return ports;
}

/**
 * Freeze a drawn section into a block with outline ports. A section drawn by an arranger (a real generated navy or
 * drone section) carries that arranger's engine rays and kept-open cells along, minus whatever was cut away.
 */
export function freeze(b: Builder, kind: string, label: string, donor: string, access: AccessKind = 'human', from?: Arranger): Block {
  b.cv.fixDoors();
  const blk = blockFrom(b, kind, label, access, autoPorts(b, access));
  const out: Block = { ...blk, donor, label: `${donor}: ${label}` };
  if (!from) return out;
  const { rays, open } = from.frozen();
  const o = blk.origin;
  const faceE = rays.filter((r) => b.cv.at(r.x, r.y0) === '#').map((r) => ({ x: r.x - o.x, y0: r.y0 - o.y, y1: r.y1 - o.y }));
  const near = (x: number, y: number): boolean => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => b.cv.at(x + (dx as number), y + (dy as number)) !== '.');
  const exposed = open.filter((e) => b.cv.at(e.x, e.y) === '.' && near(e.x, e.y)).map((e) => ({ x: e.x - o.x, y: e.y - o.y }));
  return { ...out, faceE: [...out.faceE, ...faceE], exposed: [...out.exposed, ...exposed] };
}
