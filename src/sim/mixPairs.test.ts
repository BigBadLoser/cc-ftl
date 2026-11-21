import { describe, expect, it } from 'vitest';
import { conductanceMap, fieldFrame, fieldMirror, mixPairs, writeBackMirror } from './diffusion';
import { gridFromTemplate } from './ship';
import { ShipGrid } from './shipGrid';
import { newSectorGrid, stampGrid } from './stamp';
import { Struct } from './structure';
import { GAS_DIFFUSION, GAS_SUBSTEPS, GAS_VENT } from './tuningGas';

/** An open floor room `w` x `h` inside a hull ring; `hole`: the hull tile opened to Space (a breach), or none. */
function room(w: number, h: number, hole?: [number, number]): ReturnType<typeof gridFromTemplate> {
  const rows = ['.'.repeat(w + 4), '.' + '#'.repeat(w + 2) + '.'];
  for (let y = 0; y < h; y++) rows.push('.#' + '_'.repeat(w) + '#.');
  rows.push('.' + '#'.repeat(w + 2) + '.', '.'.repeat(w + 4));
  const grid = gridFromTemplate({ name: 'r', rows });
  if (hole) grid.set('struct', hole[0], hole[1], Struct.Space);
  return grid;
}

/** `ticks` of gas mixing at the game's rates, as atmosphere.ts runs it (GAS_SUBSTEPS passes a tick, the phase order in turn). */
function mix(grid: ReturnType<typeof gridFromTemplate>, a: Float64Array, b: Float64Array, ticks: number): void {
  const frame = fieldFrame(grid);
  const cond = conductanceMap(grid, frame);
  for (let t = 0; t < ticks; t++) for (let s = 0; s < GAS_SUBSTEPS; s++) mixPairs(frame, cond, a, b, GAS_DIFFUSION, GAS_VENT, t * GAS_SUBSTEPS + s);
}

const sum = (v: Float64Array): number => v.reduce((n, x) => n + x, 0);

describe('pairwise gas mixing (#65)', () => {
  it('conserves gas in a sealed room, never goes negative, and evens the room out', () => {
    const grid = room(12, 8);
    const n = grid.width * grid.height;
    const o2 = new Float64Array(n), co2 = new Float64Array(n);
    o2[3 * grid.width + 3] = 2000; // all the oxygen in one corner tile
    co2[9 * grid.width + 12] = 50;
    mix(grid, o2, co2, 2000);
    expect(sum(o2)).toBeCloseTo(2000, 9);
    expect(sum(co2)).toBeCloseTo(50, 9);
    expect(Math.min(...o2, ...co2)).toBeGreaterThanOrEqual(0);
    const floor = [...o2].filter((_, i) => grid.load('struct')[i] === Struct.Floor);
    expect(Math.max(...floor) - Math.min(...floor)).toBeLessThan(0.01); // 2000 / 96 tiles, even to a hundredth
  });

  it('spreads with no direction leading: a point source stays centred', () => {
    const grid = room(21, 21);
    const w = grid.width, n = w * grid.height, c = 12 * w + 12;
    const o2 = new Float64Array(n), co2 = new Float64Array(n);
    o2[c] = 1000;
    mix(grid, o2, co2, 20);
    let left = 0, right = 0, up = 0, down = 0;
    for (let i = 0; i < n; i++) {
      const x = i % w, y = Math.floor(i / w);
      if (x < 12) left += o2[i]!;
      if (x > 12) right += o2[i]!;
      if (y < 12) up += o2[i]!;
      if (y > 12) down += o2[i]!;
    }
    expect(right / left).toBeCloseTo(1, 1); // within about 2% (a checkerboard effect around the source tile)
    expect(down / up).toBeCloseTo(1, 1);
  });

  it('vents a breached room at the pace the explicit solver did', () => {
    // A 10x10 room with one hull tile open to Space: half its air gone in about 270 ticks (13.5 s), 90% in about 900 (the explicit
    // solver at 0.2 / 0.25 took 267 and 898; the pairwise rates are tuned to match).
    const grid = room(10, 10, [1, 7]);
    const n = grid.width * grid.height;
    const struct = grid.load('struct');
    const o2 = new Float64Array(n).map((_, i) => (struct[i] === Struct.Floor ? 21 : 0)), co2 = new Float64Array(n);
    const mean = (): number => [...o2].filter((_, i) => struct[i] === Struct.Floor).reduce((s, v) => s + v, 0) / 100;
    const frame = fieldFrame(grid);
    const cond = conductanceMap(grid, frame);
    let half = 0, most = 0;
    for (let t = 1; t <= 2000 && !most; t++) {
      for (let s = 0; s < GAS_SUBSTEPS; s++) mixPairs(frame, cond, o2, co2, GAS_DIFFUSION, GAS_VENT, t * GAS_SUBSTEPS + s);
      if (!half && mean() < 10.5) half = t;
      if (mean() < 2.1) most = t;
    }
    expect(half).toBeGreaterThan(230);
    expect(half).toBeLessThan(310);
    expect(most).toBeGreaterThan(780);
    expect(most).toBeLessThan(1020);
  });
});

describe('gas write-back on a sector (#65)', () => {
  it('writes only gas tiles in an untouched chunk, and every tile of a chunk someone else wrote', () => {
    const sector = newSectorGrid();
    stampGrid(sector, room(10, 10), 40, 40);
    const grid = new ShipGrid(1, sector, 40, 40, 14, 14);
    const holds = (k: number): boolean => k === Struct.Floor || k === Struct.Door;
    const step = (): Float64Array => {
      const before = fieldMirror(grid, 'o2');
      const vals = before.slice();
      vals[5 * 14 + 5] = (vals[5 * 14 + 5] ?? 0) + 1; // the solve moved gas on a floor tile
      vals[1 * 14 + 1] = 0; // and left the hull empty, as it does
      writeBackMirror(grid, 'o2', vals, before, 1e-4, holds);
      return vals;
    };
    const start = grid.get('o2', 45, 45);
    step();
    expect(grid.get('o2', 45, 45)).toBe(start + 1);
    grid.set('o2', 41, 41, 7); // gas written into the hull by something else (breathing on the wrong tile, a debug write)
    step();
    expect(grid.get('o2', 41, 41)).toBe(0); // its chunk was written by someone else, so it is compared in full
    expect(grid.get('o2', 45, 45)).toBe(start + 2);
  });
});
