import { Container, Graphics } from 'pixi.js';
import { CombatC, ShipC, WeaponC, type Target } from '../sim/combat/components';
import type { World } from '../sim/ecs';
import { ModuleC } from '../sim/modules/components';
import { rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { ROOF_H } from './heights';
import { footprintQuad, isoBracketSegments, MODULE_RISE, padQuad } from './targetBrackets';
import { onShip } from './regionRules';

/** Bracket colours, the combat panel's: the ship-wide target red, a weapon's own aim cyan, the pointer's preview white. */
const C_SHIP = 0xff5a5a;
const C_OWN = 0x36d4ff;
const C_HOVER = 0xffffff;
const C_OUTLINE = 0x05080d;

/** What the pointer would aim at while "Target in view" is armed: a ship tile, and the module on it when that is what a click would pick. */
export interface AimHover {
  shipId: number;
  x: number;
  y: number;
  moduleId: number;
}

export interface AimMarksHost {
  world: World;
  modules: Readonly<Record<string, ModuleDef>>;
  /** The camera ship (the player's): whose aims are drawn. */
  refId(): number;
  /** True if the region is roofed (its marks sit on the roof). */
  roofed(shipId: number): boolean;
  /** The sector layer's scale, so bracket widths stay constant on screen. */
  scale(): number;
}

/**
 * Target brackets in the main view: over the enemy tile or module the player's ship (and each of its weapons) is aimed at, and a white
 * preview under the pointer while "Target in view" is armed. Drawn in the sector frame above the roofs.
 */
export interface AimMarks {
  setHover(h: AimHover | null): void;
  update(): void;
}

export function createAimMarks(host: AimMarksHost, parent: Container): AimMarks {
  const gfx = new Graphics();
  parent.addChild(gfx);
  let hover: AimHover | null = null;

  /** Footprint (sector tile top-left and size) of a target: its module's, else its tile; null when it is not on the ship. */
  function rectOf(t: Target): { x: number; y: number; w: number; h: number } | null {
    if (t.tile) return { x: t.tile.x, y: t.tile.y, w: 1, h: 1 };
    const m = t.moduleId ? host.world.get(t.moduleId, ModuleC) : undefined;
    const def = m && host.modules[m.def];
    if (!m || !def) return null;
    const [w, h] = rotatedSize(def, m.rot);
    return { x: m.x, y: m.y, w, h };
  }

  function bracket(shipId: number, r: { x: number; y: number; w: number; h: number }, color: number, alpha: number, pad: number, isModule: boolean): void {
    const s = host.scale();
    const lift = host.roofed(shipId) ? ROOF_H : 0;
    const quad = footprintQuad(r.x, r.y, r.w, r.h, { x: 0, y: 0 }, lift, (ax, ay) => ({ x: ax * s, y: ay * s }), isModule ? MODULE_RISE : 0);
    const segs = isoBracketSegments(padQuad(quad, pad));
    const px = (n: number) => n / s;
    for (const sg of segs) gfx.moveTo(px(sg.x1), px(sg.y1)).lineTo(px(sg.x2), px(sg.y2));
    gfx.stroke({ width: px(6), color: C_OUTLINE, alpha: 0.85 * alpha, cap: 'square' });
    for (const sg of segs) gfx.moveTo(px(sg.x1), px(sg.y1)).lineTo(px(sg.x2), px(sg.y2));
    gfx.stroke({ width: px(3), color, alpha, cap: 'square' });
  }

  return {
    setHover(h) {
      hover = h;
    },
    update() {
      gfx.clear();
      const ref = host.refId();
      const refShip = host.world.get(ref, ShipC);
      if (!refShip) return;
      const draw = (t: Target | null | undefined, color: number): void => {
        if (!t || t.vehicle || host.world.get(t.ship, ShipC)?.state === 'wreck' || !host.world.get(t.ship, ShipC)) return;
        const r = rectOf(t);
        if (r && (t.tile || host.world.get(t.moduleId, ModuleC))) bracket(t.ship, r, color, 1, t.tile ? 3 : 0, !t.tile);
      };
      draw(host.world.get(ref, CombatC)?.target, C_SHIP);
      for (const id of host.world.query(WeaponC, ModuleC)) {
        const m = host.world.get(id, ModuleC);
        if (m && onShip(refShip, m)) draw(host.world.get(id, WeaponC)?.target, C_OWN);
      }
      if (hover) {
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 180);
        const r = hover.moduleId ? rectOf({ ship: hover.shipId, moduleId: hover.moduleId }) : { x: hover.x, y: hover.y, w: 1, h: 1 };
        if (r) bracket(hover.shipId, r, C_HOVER, pulse, 3, hover.moduleId !== 0);
      }
    },
  };
}
