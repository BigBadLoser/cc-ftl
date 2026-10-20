import { Container, Sprite } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { PointDefenseC, WeaponC } from '../sim/combat/components';
import { ModuleC } from '../sim/modules/components';
import { rotatedSize } from '../sim/modules/footprint';
import { DEPLOY_FRAMES, RISE_PX, deployId, deployStage } from './deployArt';
import { resolveArt } from './assets/fallback';
import type { Atlas } from './assets/loader';
import { createGhostFilter, setGhostZoom } from './ghost';
import { ROOF_H } from './heights';
import { depthKey, iso } from './iso';
import type { Layers } from './layers';
import { lightTint, mulColor } from './lightTint';
import type { ModuleDefs } from './moduleView';

export interface TurretView {
  update(): void;
  /** Roofed ships draw turrets solid on top of the roof; cutaway ships as ghosts (faint, with a light outline). */
  setRoofed(roofed: boolean): void;
  dispose(): void;
}

interface Turret {
  root: Container;
  spr: Sprite;
  /** Stand-in barrel dots (only while the turret is a placeholder). */
  barrel: Sprite[];
  ghost: ReturnType<typeof createGhostFilter>;
  texId: number;
}

const BARREL_AT = [0.3, 0.55, 0.8];

/** Asset id stem of a weapon module: `module.burst_laser` -> `burst_laser`. */
export const turretStem = (asset: string): string => asset.replace(/^module\./, '');

/**
 * Roof turrets of weapon and point-defence modules (`PointDefenseC.aim`, never charged): `turret.<weapon>.d{0..7}` (`.charged` when fully charged) chosen from `WeaponC.aim`,
 * drawn centred above the bay; real art is modelled on the roof plane and anchored at the bay centre on the floor, stand-ins are lifted by `ROOF_H`.
 * Stand-ins get a row of dots along the aim direction so the aim is readable.
 */
export function createTurretView(world: World, atlas: Atlas, L: Layers, grid: Grid, defs: ModuleDefs): TurretView {
  const turrets = new Map<number, Turret>();
  let roofed = true;

  function drop(t: Turret): void {
    t.root.destroy({ children: true });
  }

  function make(): Turret {
    const root = new Container();
    const spr = new Sprite();
    root.addChild(spr);
    L.sorted.addChild(root);
    return { root, spr, barrel: [], ghost: createGhostFilter(), texId: -1 };
  }

  return {
    update() {
      const live = new Set<number>();
      const turretIds = [...world.query(ModuleC, WeaponC), ...world.query(ModuleC, PointDefenseC)];
      for (const id of turretIds) {
        const m = world.get(id, ModuleC);
        const w: { aim: number; charge?: number } | undefined = world.get(id, WeaponC) ?? world.get(id, PointDefenseC);
        const def = m && defs[m.def];
        if (!m || !w || !def || m.gridId !== grid.id) continue;
        const stage = def.deploySec === undefined ? DEPLOY_FRAMES : deployStage(world, id);
        // Stowed: a hatch on a roofed (enemy) ship, nothing at all on the player's cutaway ship.
        if (stage < 0 && !roofed) continue;
        const out = stage >= DEPLOY_FRAMES;
        const aim = out ? ((Math.round(w.aim) % 8) + 8) % 8 : 0;
        const stem = `turret.${turretStem(def.asset)}`;
        const base = `${stem}.d${aim}`;
        const charged = out && (w.charge ?? 0) >= 1;
        const art = out
          ? resolveArt(atlas, charged ? [`${base}.charged`, base] : [base], charged ? 'turret.generic.charged' : 'turret.generic')
          : resolveArt(atlas, [deployId(stem, stage)]);
        if (!art) continue;
        live.add(id);
        let t = turrets.get(id);
        if (!t) turrets.set(id, (t = make()));
        const [bw, bh] = rotatedSize(def, m.rot);
        const cx = m.x + (bw - 1) / 2;
        const cy = m.y + (bh - 1) / 2;
        const p = iso(cx, cy);
        t.spr.texture = art.s.tex;
        // Real turret art is modelled on the roof plane (anchor = bay centre on the floor); stand-ins are lifted to it.
        const lift = art.fallback ? ROOF_H : 0;
        t.spr.position.set(Math.round(p.x - art.s.ax), Math.round(p.y - art.s.ay - lift + (1 - art.rise) * RISE_PX));
        const lx = Math.min(grid.width - 1, Math.max(0, Math.round(cx)));
        const ly = Math.min(grid.height - 1, Math.max(0, Math.round(cy)));
        t.spr.tint = mulColor(lightTint(grid.get('light', lx, ly), false, -1), art.tint);
        // The front tile of the bay, +0.93: over the roof tiles of the footprint, behind the next tile row.
        t.root.zIndex = depthKey(m.x + bw - 1, m.y + bh - 1) + 0.93;
        if (art.fallback && out) {
          while (t.barrel.length < BARREL_AT.length) {
            const dot = new Sprite();
            t.root.addChild(dot);
            t.barrel.push(dot);
          }
          const dot = resolveArt(atlas, ['fx.spark']);
          const a = (aim * Math.PI) / 4;
          const dx = Math.cos(a);
          const dy = Math.sin(a);
          t.barrel.forEach((d, i) => {
            if (!dot) return;
            const k = BARREL_AT[i] as number;
            d.texture = dot.s.tex;
            d.anchor.set(0.5);
            d.scale.set(5 - i);
            d.tint = charged ? 0xffe070 : 0xffffff;
            d.position.set(Math.round(p.x + (dx - dy) * 32 * k), Math.round(p.y - ROOF_H - 16 + (dx + dy) * 16 * k));
          });
        } else {
          for (const d of t.barrel) d.destroy();
          t.barrel = [];
        }
        t.root.filters = roofed ? [] : [t.ghost];
        setGhostZoom(t.ghost, L.scale);
      }
      for (const [id, t] of turrets) {
        if (live.has(id)) continue;
        drop(t);
        turrets.delete(id);
      }
    },
    setRoofed(r) {
      roofed = r;
    },
    dispose() {
      for (const t of turrets.values()) drop(t);
      turrets.clear();
    },
  };
}
