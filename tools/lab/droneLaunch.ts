import { Container, Graphics, Sprite } from 'pixi.js';
import { drones } from '../../src/content/drones';
import { applyDroneArt, createDroneArtSprites, droneArtIds } from '../../src/render/droneArt';
import { hatchArtId, stepHatch, HATCH_SEC } from '../../src/render/droneHatch';
import { Z_PX } from '../../src/render/heights';
import { sectorArt } from '../../src/render/sectorPos';
import { ALT } from '../../src/sim/body';
import { liftPose } from '../../src/sim/drones/space';
import { DRONE_LIFT_SEC } from '../../src/sim/tuning';
import { strip, type LabCell, type LabCtx, type LabPanel } from './panel';

/**
 * `?panel=droneLaunch`: a drone going up through its bay's ceiling hatch and coming back down (#318 slice 2), through the game's own code:
 * the sim's lift pose (sim/drones/space.ts `liftPose`), the hatch timing and art (render/droneHatch.ts) and the drone art (droneArt.ts).
 * Row 1 the launch, row 2 the landing (strips of `frames=8` stills, the hatch shutting after), row 3 the drone in space: its eight headings
 * flying, the two firing frames, and drifting knocked out. `def=drone.defence` picks the drone.
 */
const BAY = 'module.drone_bay';
/** Cell size and where the bay's footprint centre sits in it. */
const W = 220, H = 300, OX = 110, OY = 250;

/** The hatch opening at `t` seconds into a launch or a landing (the game's stepHatch: open while the drone is in the lift, then shut). */
function hatchAt(t: number): number {
  let open = 0;
  for (let s = 0; s < t; s += 1 / 60) open = stepHatch(open, s < DRONE_LIFT_SEC ? 1 : 0, 1 / 60);
  return open;
}

function bayCell(ctx: LabCtx, def: string, label: string, note: string, t: number, up: boolean, newRow: boolean): LabCell {
  return {
    label, note, w: W, h: H, at: t, loop: DRONE_LIFT_SEC + HATCH_SEC, newRow,
    mount(root: Container) {
      const { atlas } = ctx;
      const bay = new Sprite(), front = new Sprite(), hatch = new Sprite();
      const low = new Container(), high = new Container();
      const art = createDroneArtSprites(low);
      root.addChild(bay, low, front, hatch, high);
      const at = (id: string, spr: Sprite, x: number, y: number): void => {
        const st = atlas.stat(id);
        spr.visible = !!st;
        if (!st) return;
        spr.texture = st.tex;
        spr.position.set(Math.round(x - st.ax), Math.round(y - st.ay));
      };
      // Bay at tiles (0, 0)-(1, 1): slot 0 is tile (0, 0), the hatch the footprint's middle.
      const c = sectorArt(1, 1);
      const base = { x: OX - c.x, y: OY - c.y };
      return (time) => {
        const p = liftPose({ x: 0.5, y: 0.5 }, { x: 1, y: 1 }, Math.min(1, time / DRONE_LIFT_SEC), up);
        at(`${BAY}.r0`, bay, OX, OY);
        at(`${BAY}.r0.front`, front, OX, OY);
        at(hatchArtId(BAY, hatchAt(time)), hatch, OX, OY);
        const docked = up ? time <= 0 : time >= DRONE_LIFT_SEC;
        const ids = droneArtIds(def, { down: false, working: false, docked }, Math.PI / 4, time);
        const q = sectorArt(p.x, p.y);
        (p.alt > ALT.roof ? high : low).addChild(art.shadow, art.beam, art.body, art.glow);
        for (const s of [art.shadow, art.beam, art.body, art.glow]) s.parent?.position.set(Math.round(base.x + q.x), Math.round(base.y + q.y));
        applyDroneArt(atlas, art, ids, p.alt * Z_PX);
      };
    },
  };
}

function spaceCell(ctx: LabCtx, def: string, label: string, heading: number, s: { working?: boolean; down?: boolean }, newRow: boolean, t = 0): LabCell {
  return {
    label, w: 170, h: 170, at: t, loop: 0.32, newRow,
    mount(root: Container) {
      const g = new Container();
      g.position.set(85, 150);
      root.addChild(new Graphics().ellipse(85, 150, 30, 15).stroke({ color: 0x3a4a5a, width: 1 }), g);
      const art = createDroneArtSprites(g);
      return (time) => applyDroneArt(ctx.atlas, art, droneArtIds(def, { down: !!s.down, working: !!s.working, docked: false }, heading, time), ALT.drone * Z_PX);
    },
  };
}

export const droneLaunchPanel: LabPanel = {
  id: 'droneLaunch',
  title: 'Drone launch and landing through the bay hatch',
  help: `def=${Object.keys(drones).join('|')}&frames=8`,
  zoom: 1,
  async cells(ctx) {
    const def = ctx.params.get('def') ?? 'drone.defence';
    const n = Number(ctx.params.get('frames') ?? 8) || 8;
    for (const id of [...ctx.atlas.ids(BAY), ...ctx.atlas.ids(def), 'drone.shadow']) ctx.atlas.stat(id);
    await ctx.atlas.whenIdle();
    const len = DRONE_LIFT_SEC + HATCH_SEC;
    const cells: LabCell[] = [];
    strip(len, n).forEach((t, i) => cells.push(bayCell(ctx, def, 'launch', `${t.toFixed(2)} s`, t, true, i === 0)));
    strip(len, n).forEach((t, i) => cells.push(bayCell(ctx, def, 'landing', `${t.toFixed(2)} s`, t, false, i === 0)));
    for (let d = 0; d < 8; d++) cells.push(spaceCell(ctx, def, `fly ${d * 45}°`, (d * Math.PI) / 4 - Math.PI / 2, {}, d === 0));
    cells.push(spaceCell(ctx, def, 'firing f0', Math.PI / 4, { working: true }, false, 0));
    cells.push(spaceCell(ctx, def, 'firing f1', Math.PI / 4, { working: true }, false, 0.2));
    cells.push(spaceCell(ctx, def, 'knocked out', Math.PI / 4, { down: true }, false));
    return cells;
  },
};
