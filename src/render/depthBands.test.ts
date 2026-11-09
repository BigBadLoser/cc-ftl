import { describe, expect, it } from 'vitest';
import { Container } from 'pixi.js';
import { createWorldStack } from './worldLayers';
import { setDepthBandWidth, DEPTH_BAND_WIDTH } from './depthBands';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/**
 * The one sorted layer the bands replace: children in attach order, re-sorted each frame by `zIndex + base`, a stable
 * sort (equal keys keep their previous order).
 */
class Reference {
  list: Container[] = [];
  constructor(private readonly base: (c: Container) => number) {}
  attach(c: Container): void {
    this.list = this.list.filter((x) => x !== c);
    this.list.push(c);
  }
  detach(c: Container): void {
    this.list = this.list.filter((x) => x !== c);
  }
  frame(): Container[] {
    const k = (c: Container) => c.zIndex + this.base(c);
    this.list = this.list.map((c, i) => ({ c, i })).sort((x, y) => k(x.c) - k(y.c) || x.i - y.i).map((x) => x.c);
    return this.list;
  }
}

describe('depth bands', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('draw in exactly the order of the one sorted layer, frame by frame, through moves, ties, adds, removes and re-bases (seed %i)', (seed) => {
    setDepthBandWidth(DEPTH_BAND_WIDTH);
    const r = rng(seed);
    const W = createWorldStack();
    const regions = [W.region(false), W.region(false)];
    const bases = [0, 6];
    regions.forEach((g, i) => g.setOrigin(0, 0, bases[i] as number));
    const parentBase = (c: Container) => (c.parent === regions[0]?.sorted ? (bases[0] as number) : c.parent === regions[1]?.sorted ? (bases[1] as number) : 0);
    const ref = new Reference(parentBase);
    const live: Container[] = [];
    let n = 0;
    // Keys on a coarse grid so equal keys (ties) and band edges come up often.
    const z = () => Math.floor(r() * 40) / 2 - 2;
    for (let frame = 0; frame < 300; frame++) {
      const ops = 1 + Math.floor(r() * 6);
      for (let o = 0; o < ops; o++) {
        const x = r();
        if (x < 0.25 || live.length < 5) {
          const c = new Container();
          c.label = `s${n++}`;
          const parent = r() < 0.15 ? W.low : (regions[Math.floor(r() * 2)] as (typeof regions)[number]).sorted;
          if (r() < 0.5) c.zIndex = z(); // set before the add, or (below) after it as the views mostly do
          parent.addChild(c);
          ref.attach(c);
          if (r() < 0.5) c.zIndex = z();
          live.push(c);
        } else if (x < 0.8) {
          const c = live[Math.floor(r() * live.length)] as Container;
          c.zIndex = r() < 0.7 ? c.zIndex + (r() - 0.5) * 3 : z();
        } else if (x < 0.9) {
          const i = Math.floor(r() * live.length);
          const c = live[i] as Container;
          live.splice(i, 1);
          ref.detach(c);
          c.destroy();
        } else if (x < 0.95) {
          const c = live[Math.floor(r() * live.length)] as Container;
          const to = (regions[Math.floor(r() * 2)] as (typeof regions)[number]).sorted;
          const moved = c.parent !== to;
          to.addChild(c); // a move between regions re-attaches it (pixi only reorders a child added to its own parent)
          if (moved) ref.attach(c);
        } else if (x < 0.96) {
          setDepthBandWidth(r() < 0.5 ? Infinity : DEPTH_BAND_WIDTH); // the debug switch (one band) changes nothing drawn
        } else {
          const i = Math.floor(r() * 2);
          bases[i] = Math.floor(r() * 12);
          (regions[i] as (typeof regions)[number]).setOrigin(0, 0, bases[i] as number);
        }
      }
      expect(W.drawOrder(true).map((c) => c.label)).toEqual(ref.frame().map((c) => c.label));
    }
    setDepthBandWidth(DEPTH_BAND_WIDTH);
  });
});
