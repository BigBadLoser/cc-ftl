import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { depthKey } from './iso';
import { diagonalFront, type ModuleLayer } from './moduleArt';
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
