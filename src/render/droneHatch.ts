import { Container, Sprite } from 'pixi.js';
import type { World } from '../sim/ecs';
import { DroneC } from '../sim/drones/components';
import { ModuleC } from '../sim/modules/components';
import { rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { DRONE_HATCH_SHARE, DRONE_LIFT_SEC } from '../sim/tuning';
import type { Atlas } from './assets/loader';
import { sectorArt } from './sectorPos';

/**
 * The drone bay's ceiling hatch (#324 art `module.drone_bay.hatch.f0..f4`, `.hatch.stowed`), drawn at roof height over the bay like the
 * weapon hatches. It opens while one of the bay's drones launches or lands (the sim's lift timing: it is fully open as the drone starts up)
 * and closes behind it. On a roofed ship it is always there (stowed when shut). On the cutaway player ship it shows only while it is not
 * shut: the bay's tall frame stands in the cutaway, so its lid is drawn solid on top of it rather than ghosted like the roof turrets (a shut
 * lid would hide the docked drones). Reads the sim only.
 */
export const HATCH_FRAMES = 5;

/** Seconds the hatch takes to open or shut: the part of a launch the drone spends sliding to it. */
export const HATCH_SEC = DRONE_LIFT_SEC * DRONE_HATCH_SHARE;

/** Art id of the hatch at `open` 0..1: shut is `.stowed`, then the frames f0..f4 (f4 fully open). */
export function hatchArtId(asset: string, open: number): string {
  if (open <= 0) return `${asset}.hatch.stowed`;
  return `${asset}.hatch.f${Math.min(HATCH_FRAMES - 1, Math.floor(open * HATCH_FRAMES))}`;
}

/** Move the shown opening toward `want` (0 or 1) over `dt` seconds at the hatch's speed. */
export function stepHatch(open: number, want: number, dt: number): number {
  const k = dt / HATCH_SEC;
  return want > open ? Math.min(want, open + k) : Math.max(want, open - k);
}

export interface HatchHost {
  layer: Container;
  modules: Readonly<Record<string, ModuleDef>>;
  atlas?: Pick<Atlas, 'stat'>;
  /** True if the ship is drawn with its roof on (enemy ships); false for the cutaway player ship. */
  roofed: (ship: number) => boolean;
  /** Ship (ShipC id) of a module. */
  shipOf: (module: number) => number;
}

interface Hatch {
  spr: Sprite;
  open: number;
}

export function createHatchView(world: World, host: HatchHost): { update(dt: number): void; dispose(): void } {
  const hatches = new Map<number, Hatch>();
  return {
    update(dt) {
      const busy = new Set<number>();
      for (const id of world.query(DroneC)) {
        const d = world.get(id, DroneC);
        if (d && d.bay && (d.state === 'launch' || d.state === 'land')) busy.add(d.bay);
      }
      const live = new Set<number>();
      for (const id of world.query(ModuleC)) {
        const m = world.get(id, ModuleC);
        const def = m && host.modules[m.def];
        if (!m || !def?.droneBay || !host.atlas) continue;
        let h = hatches.get(id);
        const open = stepHatch(h?.open ?? 0, busy.has(id) && m.hp > 0 ? 1 : 0, dt);
        const roofed = host.roofed(host.shipOf(id));
        const st = host.atlas.stat(hatchArtId(def.asset, open));
        if (!st || (!roofed && open <= 0)) {
          if (h) h.open = open;
          if (h) h.spr.visible = false;
          if (h) live.add(id);
          continue;
        }
        if (!h) {
          h = { spr: new Sprite(), open };
          host.layer.addChild(h.spr);
          hatches.set(id, h);
        }
        live.add(id);
        h.open = open;
        const [w, hh] = rotatedSize(def, m.rot);
        const p = sectorArt(m.x + w / 2, m.y + hh / 2);
        h.spr.visible = true;
        h.spr.texture = st.tex;
        h.spr.position.set(Math.round(p.x - st.ax), Math.round(p.y - st.ay));
        // Over the bay's own art and a drone inside it (front tile +1.25); on a roofed ship over the roof plating, as the turrets (+2.95).
        h.spr.zIndex = m.x + w - 1 + m.y + hh - 1 + (roofed ? 2.95 : 1.25);
      }
      for (const [id, h] of hatches) {
        if (live.has(id)) continue;
        h.spr.destroy();
        hatches.delete(id);
      }
    },
    dispose() {
      for (const h of hatches.values()) h.spr.destroy();
      hatches.clear();
    },
  };
}
