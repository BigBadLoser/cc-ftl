import { describe, expect, it } from "vitest";
import { Struct } from "../sim/structure";
import { outward, touchesSpace, wallCorners, wallMask, wallPieces, type CutawayMode, type KindAt, type Piece } from "./tiles";

const W = Struct.Wall;
const F = Struct.Floor;
const S = Struct.Space;
const D = Struct.Door;
const grid = (rows: number[][]) => (x: number, y: number) => rows[y]?.[x] ?? S;

/** wallPieces before the corner fills (walls pass 10), kept verbatim as the non-regression reference. */
function legacyPieces(kindAt: KindAt, x: number, y: number, kind: number, mode: CutawayMode, ghosts = true, gap: (x: number, y: number) => boolean = () => false): Piece[] {
  const solidish = (k: number) => k === Struct.Wall || k === Struct.Door;
  const level = mode === "up" ? "up" : mode === "down" ? "low" : "cut";
  const PRE = { up: "full.", cut: "", low: "low." }[level];
  const ghostAt = (gx: number, gy: number) =>
    kindAt(gx, gy) === Struct.Wall && touchesSpace(kindAt, gx, gy) && (outward(kindAt, gx, gy) > 0 || level === "low");
  const o = outward(kindAt, x, y);
  if (kind === Struct.Door) {
    const ax = solidish(kindAt(x - 1, y)) && solidish(kindAt(x + 1, y)) ? "x" : "y";
    const out: Piece[] = [{ chain: [`tile.door.${ax}`], order: 0 }];
    if (o && ghosts) out.push({ chain: [`tile.hull.drop.${o & 1 ? "s" : "e"}`], order: 1, under: true });
    return out;
  }
  const mask = wallMask(kindAt, x, y);
  const hull = touchesSpace(kindAt, x, y);
  const v = hull && (((x + y) % 3) + 3) % 3 === 0 ? ".v1" : "";
  if (ghosts && hull && o) {
    const out: Piece[] = [{ chain: [`tile.hull.o${o}.m${mask}`], order: 0 }];
    if (o < 4) out.push({ chain: [`tile.hull.belly.o${o}.m${mask}${v}`, `tile.hull.belly.o${o}.m${mask}`], order: 1, under: true });
    return out;
  }
  if (ghosts && hull && level === "low") {
    const room = (kindAt(x, y - 1) === Struct.Floor ? 1 : 0) | (kindAt(x - 1, y) === Struct.Floor ? 8 : 0);
    const id = `tile.hull.ghost.m${mask}`;
    return [{ chain: room ? [`${id}.r${room}`, id] : [id], order: 0 }];
  }
  const fam = hull ? "hull" : "wall";
  const base = `tile.${fam}.${PRE}m${mask}`;
  const out: Piece[] = [{ chain: [base + v, base], order: 0 }];
  if (mask & 4 && ((ghosts && ghostAt(x, y + 1)) || gap(x, y + 1))) out.push({ chain: [`tile.${fam}.${PRE}end.s`], order: 1 });
  if (mask & 2 && ((ghosts && ghostAt(x + 1, y)) || gap(x + 1, y))) out.push({ chain: [`tile.${fam}.${PRE}end.e`], order: 1 });
  return out;
}

/** Small deterministic LCG (tests only). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

function randomGrid(r: () => number, w: number, h: number, pWall: number): number[][] {
  return Array.from({ length: h }, () =>
    Array.from({ length: w }, () => {
      const t = r();
      return t < pWall ? W : t < pWall + 0.05 ? D : t < 0.85 ? F : S;
    }),
  );
}

const has2x2 = (k: KindAt, x: number, y: number) => {
  // Any 2x2 of solid wall that contains (x, y).
  for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]] as const)
    if ([0, 1].every((a) => [0, 1].every((b) => k(x + dx + a, y + dy + b) === W))) return true;
  return false;
};

describe("wall corner fills", () => {
  it("sets a corner only for two connected arms and a solid diagonal; doors break it", () => {
    const block = grid([
      [W, W, W],
      [W, W, W],
      [W, W, W],
    ]);
    expect(wallCorners(block, 1, 1, wallMask(block, 1, 1))).toBe(15);
    expect(wallCorners(block, 0, 0, wallMask(block, 0, 0))).toBe(2);
    const door = grid([
      [W, D, W],
      [W, W, W],
      [W, W, W],
    ]);
    expect(wallCorners(door, 1, 1, wallMask(door, 1, 1))).toBe(2 | 4);
    expect(wallCorners(door, 0, 1, wallMask(door, 0, 1))).toBe(2);
    const ell = grid([
      [W, W, F],
      [W, F, F],
    ]);
    expect(wallCorners(ell, 0, 0, wallMask(ell, 0, 0))).toBe(0);
  });
  it("adds the corner suffix and keeps today's id last in every chain", () => {
    const k = grid([
      [S, S, S, S, S],
      [S, W, W, W, S],
      [S, W, W, W, S],
      [S, W, W, F, S],
      [S, W, W, F, S],
      [S, S, S, S, S],
    ]);
    expect(wallPieces(k, 2, 2, W, "up")[0]?.chain).toEqual(["tile.wall.full.m15c13", "tile.wall.full.m15"]);
    expect(wallPieces(k, 1, 1, W, "auto")[0]?.chain).toEqual(["tile.hull.m6c2", "tile.hull.m6"]);
    expect(wallPieces(k, 1, 1, W, "down")[0]?.chain).toEqual(["tile.hull.ghost.m6c2", "tile.hull.ghost.m6"]);
    expect(wallPieces(k, 2, 3, W, "auto").map((p) => p.chain)).toEqual([
      ["tile.wall.m13c12", "tile.wall.m13"],
      ["tile.wall.end.s.c4", "tile.wall.end.s"],
    ]);
  });
  it("matches the legacy pieces wherever no 2x2 wall block exists, and ends every chain with the legacy id", () => {
    const r = rng(7);
    let compared = 0;
    let filled = 0;
    for (let n = 0; n < 300; n++) {
      const w = 6 + Math.floor(r() * 6);
      const h = 6 + Math.floor(r() * 6);
      const rows = randomGrid(r, w, h, 0.2 + r() * 0.5);
      const k = grid(rows);
      const gap = (x: number, y: number) => (x * 7 + y * 3 + n) % 11 === 0 && k(x, y) === W;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const kind = k(x, y);
          if (kind !== W && kind !== D) continue;
          for (const mode of ["up", "auto", "down"] as const)
            for (const ghosts of [true, false]) {
              const now = wallPieces(k, x, y, kind, mode, ghosts, gap);
              const old = legacyPieces(k, x, y, kind, mode, ghosts, gap);
              if (!has2x2(k, x, y)) {
                expect(now).toEqual(old);
                compared++;
              } else filled++;
              expect(now.map((p) => p.chain.at(-1))).toEqual(old.map((p) => p.chain.at(-1)));
              expect(now.map((p) => [p.order, !!p.under])).toEqual(old.map((p) => [p.order, !!p.under]));
            }
        }
    }
    expect(compared).toBeGreaterThan(1000);
    expect(filled).toBeGreaterThan(1000);
  });
});

void F;
