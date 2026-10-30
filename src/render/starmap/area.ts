/** Filled areas from the snapshot's outlines (M/L/Z loops, filled even-odd): outer loops, each with the holes cut out of it. */
import type { Graphics } from 'pixi.js';
import { loopsOf } from './pixel';

export interface Region {
  outer: number[];
  holes: number[][];
}

const inLoop = (loop: readonly number[], x: number, y: number): boolean => {
  let hit = false;
  for (let i = 0, j = loop.length - 2; i < loop.length; j = i, i += 2) {
    const xi = loop[i]!;
    const yi = loop[i + 1]!;
    const xj = loop[j]!;
    const yj = loop[j + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

const areaOf = (l: readonly number[]): number => {
  let a = 0;
  for (let i = 0, j = l.length - 2; i < l.length; j = i, i += 2) a += (l[j]! * l[i + 1]! - l[i]! * l[j + 1]!) / 2;
  return Math.abs(a);
};

/** Split loops by nesting: a loop inside an even number of others is filled, inside an odd number it is a hole of the loop around it. */
export function regions(loops: readonly number[][]): Region[] {
  const depth = loops.map((l, i) => loops.reduce((n, o, j) => n + (j !== i && inLoop(o, l[0]!, l[1]!) ? 1 : 0), 0));
  const out = new Map<number, Region>();
  loops.forEach((l, i) => {
    if (depth[i]! % 2 === 0) out.set(i, { outer: l, holes: [] });
  });
  loops.forEach((l, i) => {
    if (depth[i]! % 2 === 0) return;
    let parent = -1;
    loops.forEach((o, j) => {
      if (depth[j] === depth[i]! - 1 && inLoop(o, l[0]!, l[1]!) && (parent < 0 || areaOf(o) < areaOf(loops[parent]!))) parent = j;
    });
    out.get(parent)?.holes.push(l);
  });
  return [...out.values()];
}

/** Fill an outline path (white: tint and alpha colour it later). */
export function fillArea(gfx: Graphics, d: string): void {
  for (const r of regions(loopsOf(d))) {
    gfx.poly(r.outer).fill(0xffffff);
    for (const h of r.holes) gfx.poly(h).cut();
  }
}
