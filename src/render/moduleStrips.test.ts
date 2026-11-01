import { afterEach, describe, expect, it, vi } from 'vitest';
import { Rectangle, Texture, TextureSource } from 'pixi.js';
import { content } from '../content';
import { rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { depthKey } from './iso';
import { animNow, setAnimPaused } from './animClock';
import type { StaticSprite } from './assets/loader';
import { diagonalFront, FLICKER_LIT_MS, stateArt, type ModuleLayer } from './moduleArt';
import { stripFrame } from './moduleStrips';
import { autoStrips, moduleKey } from './moduleView';

const def = (id: string): ModuleDef => (content.modules as Record<string, ModuleDef>)[id] as ModuleDef;
const plain: ModuleLayer = { chain: ['x'], key: 'x', tiles: 'all' };

/**
 * Crew beside a big module must draw over it (playtest: the 4x5 engine painted over crew in front of it). Drawn whole,
 * the sprite sorts by its front-most tile, above crew next to its back half; cut into diagonal strips, the strip under a
 * crew member's screen column sorts by the front-most footprint tile on that diagonal, which is behind them.
 */
describe('big module depth strips', () => {
  it('cuts solid multi-tile modules (engine, refinery, pod bay), not 1x1 ones, own-tile parts, bells or offset overlays', () => {
    for (const id of ['module.engine', 'module.refinery', 'module.pod_bay']) {
      const [w, h] = rotatedSize(def(id), 0);
      expect(autoStrips(def(id), plain, w, h, false), id).toBe(true);
    }
    const lamp = def('module.light');
    expect(autoStrips(lamp, plain, 1, 1, false)).toBe(false);
    const [w, h] = rotatedSize(def('module.engine'), 1);
    expect(autoStrips(def('module.engine'), { ...plain, out: true }, w, h, false)).toBe(false);
    expect(autoStrips(def('module.engine'), { ...plain, at: { x: 0, y: 0 } }, w, h, false)).toBe(false);
    expect(autoStrips(def('module.engine'), { ...plain, dz: 0.03 }, w, h, false)).toBe(false);
    // A roofed engine sorts under the roof plates as a whole.
    expect(autoStrips(def('module.engine'), plain, w, h, true)).toBe(false);
  });

  it('puts crew beside the back half of the engine in front of the strip they stand over, and crew behind it under', () => {
    const d = def('module.engine');
    const [w, h] = rotatedSize(d, 1); // 5 x 4, as on the starter ship
    const mx = 44, my = 52;
    const whole = moduleKey(d, mx + w - 1, my + h - 1);
    const stripKey = (cx: number, cy: number): number => {
      const dd = cx - cy; // the crew's screen column is its diagonal
      const f = diagonalFront(mx, my, w, h, Math.min(mx + w - 1 - my, Math.max(mx - (my + h - 1), dd)));
      return moduleKey(d, f.x, f.y);
    };
    // In front: beyond the module in +x (beside its back rows) or +y (along its front edge).
    for (const [cx, cy] of [[mx + w, my], [mx + w, my + 1], [mx, my + h], [mx + 1, my + h]] as const) {
      expect(depthKey(cx, cy) > whole, `whole sprite over crew at ${cx},${cy}`).toBe(false); // the bug, drawn whole
      expect(depthKey(cx, cy) > stripKey(cx, cy), `crew at ${cx},${cy} in front`).toBe(true);
    }
    // Behind: before the module in -x or -y.
    for (const [cx, cy] of [[mx - 1, my + 1], [mx + 1, my - 1]] as const) {
      expect(depthKey(cx, cy) < stripKey(cx, cy), `crew at ${cx},${cy} behind`).toBe(true);
    }
  });
});

/**
 * Animated stripped modules (a running refinery's `.active.fN` frames, a damaged machine's flicker) swap frames on their
 * strips: each strip must show its own columns of the new frame, and the frames follow the animation clock.
 */
describe('frames on depth strips', () => {
  afterEach(() => {
    setAnimPaused(false);
    vi.restoreAllMocks();
  });
  const sheet = new TextureSource({ width: 512, height: 128 });
  const frame = (x: number, glow: boolean): StaticSprite => ({
    tex: new Texture({ source: sheet, frame: new Rectangle(x, 0, 120, 100) }),
    glow: glow ? new Texture({ source: sheet, frame: new Rectangle(x, 100, 120, 28) }) : null,
    ax: 60, ay: 90, footprint: [3, 4],
  });

  it('cuts the same columns out of the new frame, and refuses a frame that does not line up', () => {
    const a = frame(0, true), b = frame(200, true), dark = frame(320, false);
    const crop = { x0: 32, x1: 96, ax: a.ax, w: a.tex.width };
    const fa = stripFrame(a, crop)!;
    const fb = stripFrame(b, crop)!;
    expect(fa.tex.frame.x).toBe(32);
    expect(fb.tex.frame.x).toBe(232); // frame b's columns 32..96, not frame a's, nor the whole frame
    expect(fb.tex.frame.width).toBe(64);
    expect(fb.tex.source).toBe(sheet);
    expect(fb.glow?.frame.x).toBe(232);
    expect(stripFrame(dark, crop)?.glow).toBeNull(); // the flicker's dark frame has no glow
    expect(stripFrame({ ...b, ax: 61 }, crop)).toBeNull(); // another anchor: rebuild instead
  });

  it('steps a running refinery and flickers a damaged one with the animation clock, and holds both while paused', () => {
    let real = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => real);
    const d = def('module.refinery');
    const ids = new Set(['module.refinery.r0.active', 'module.refinery.r0.active.f1', 'module.refinery.r0.active.f2', 'module.refinery.r0.damaged', 'module.refinery.r0.damaged.flicker']);
    const look = (hp: number) => ({ off: false, now: animNow(), hp, maxHp: d.maxHp, has: (id: string) => ids.has(id) });
    const running = () => stateArt(d, 0, true, look(d.maxHp)).head[0];
    const damaged = () => stateArt(d, 0, true, look(d.maxHp * 0.3)).head[0];
    const seen = new Set<string | undefined>();
    for (let t = 0; t < 1000; t += 50) {
      real = t;
      seen.add(running());
    }
    expect(seen.size).toBe(3); // every active frame comes round
    real = 0;
    const lit = damaged();
    real = FLICKER_LIT_MS + 10;
    expect(damaged()).not.toBe(lit); // the flicker alternates
    setAnimPaused(true);
    const held = [running(), damaged()];
    for (const t of [400, 900, 5000]) {
      real += t;
      expect([running(), damaged()]).toEqual(held);
    }
  });
});
