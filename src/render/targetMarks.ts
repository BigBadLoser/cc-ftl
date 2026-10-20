import { Sprite, type Container } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { ModuleC } from '../sim/modules/components';
import { footprintTiles } from '../sim/modules/footprint';
import { diamondTextures } from './diamonds';
import { iso } from './iso';
import { isTargetable } from './moduleArt';
import type { ModuleDefs } from './moduleView';

const TARGETABLE = 0x4fd6ee;
const TARGETED = 0xffc83d;

export interface TargetMarks {
  /** Outline every targetable module (weapons, engines, shield generators, the AI core) and the `targeted` ones in amber, lifted by `lift` art px. */
  update(show: boolean, targeted: ReadonlySet<number>, lift: number): void;
  dispose(): void;
}

/** Diamond outlines over module footprints: how the combat overlay shows what can be targeted and what is. */
export function createTargetMarks(grid: Grid, world: World, defs: ModuleDefs, parent: Container): TargetMarks {
  const tex = diamondTextures().outline;
  const pool: Sprite[] = [];
  return {
    update(show, targeted, lift) {
      let n = 0;
      if (show) {
        const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 160);
        for (const id of world.query(ModuleC)) {
          const m = world.get(id, ModuleC);
          const def = m && defs[m.def];
          if (!m || !def || m.gridId !== grid.id) continue;
          const hit = targeted.has(id);
          if (!hit && !isTargetable(def)) continue;
          for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
            let s = pool[n];
            if (!s) {
              s = new Sprite(tex);
              s.anchor.set(0.5);
              parent.addChild(s);
              pool[n] = s;
            }
            n++;
            const p = iso(t.x - grid.x0, t.y - grid.y0); // region-local
            s.position.set(p.x, p.y - lift);
            s.tint = hit ? TARGETED : TARGETABLE;
            s.alpha = hit ? pulse : 0.55;
            s.visible = true;
          }
        }
      }
      for (let i = n; i < pool.length; i++) (pool[i] as Sprite).visible = false;
    },
    dispose() {
      for (const s of pool) s.destroy();
      pool.length = 0;
    },
  };
}
