import { Container, Sprite } from 'pixi.js';
import { diamondTextures } from '../../src/render/diamonds';
import { Z_PX } from '../../src/render/heights';
import { iso } from '../../src/render/iso';
import { sectorArt } from '../../src/render/sectorPos';
import { BAY_FRAME_MS, LAUNCH, RETURN, bayHandoff, bayId, parkedId } from '../../src/render/vehicleBayArt';
import { POD_HOVER_Z } from '../../src/sim/mining/geometry';
import { strip, type LabCell, type LabCtx, type LabPanel } from './panel';

/**
 * `?panel=bayHandoff`: the playtest batch of 2026-11-17, before and after, through the game's own code.
 * Rows 1-4: a mining pod launching and landing at its pod bay. `before` draws it as the pod view used to (the flying pod from the
 * first frame, hidden behind the bay while the parked sprite still shows; on landing nothing until the claws close); `after` follows
 * vehicleBayArt's `bayHandoff` (parked sprite through the first door frames, then the pod rises out of the pit; a landing settles into it).
 * Rows 5-6: a drone bay with two docked drones, without and with its `.front` overlay (droneBayArt). Row 7: a module's
 * pending deconstruct order, without and with the red footprint marks (siteView).
 */
const POD_BAY = 'module.pod_bay';
const POD = 'vehicle.mining_pod';
const DRONE_BAY = 'module.drone_bay';
const PIT_Z = -0.6;
const W = 260, H = 300, OX = 130, OY = 230;
/** Sim speed of a launched pod away from the bay (tiles/s) for the `before` rows. */
const FLY_SPEED = 1.5;

type Mode = 'before' | 'after';

function podCell(ctx: LabCtx, launch: boolean, mode: Mode, t: number, newRow: boolean): LabCell {
  return {
    label: `${launch ? 'launch' : 'landing'} ${mode}`, note: `${t.toFixed(2)} s`, w: W, h: H, at: t, newRow,
    mount(root: Container) {
      const { atlas } = ctx;
      const mk = (): Sprite => root.addChild(new Sprite());
      const pod = mk(), bay = mk(), parked = mk();
      root.setChildIndex(pod, 0);
      const put = (id: string, s: Sprite, x: number, y: number): void => {
        const st = atlas.stat(id);
        s.visible = !!st;
        if (!st) return;
        s.texture = st.tex;
        s.position.set(Math.round(x - st.ax), Math.round(y - st.ay));
      };
      return (time) => {
        const ms = time * 1000;
        const steps = launch ? LAUNCH : RETURN;
        const step = steps[Math.min(steps.length - 1, Math.floor(ms / BAY_FRAME_MS))] as (typeof steps)[number];
        put(bayId(POD_BAY, 0, step.bay), bay, OX, OY);
        put(parkedId(0, step.shuttle ?? '', POD), parked, OX, OY);
        parked.visible = parked.visible && step.shuttle !== null;
        // The pod's centre is the bay's middle tile, one tile up-left of the anchor (the front tile) on each axis.
        const mid = { x: OX + iso(-1, -1).x, y: OY + iso(-1, -1).y };
        const sim = launch ? ms / 1000 * FLY_SPEED : 0;
        let z = 0.6, drawn = true, lift: number | null = null, x = mid.x, y = mid.y;
        if (mode === 'after') {
          const h = bayHandoff(!launch, launch ? ms : Infinity, launch ? Infinity : ms);
          drawn = h.drawn;
          lift = h.lift;
          if (lift !== null) z = PIT_Z + (POD_HOVER_Z - PIT_Z) * lift;
          else z = POD_HOVER_Z;
        } else {
          drawn = launch; // nothing draws a stowed pod: the bay's parked sprite is the only one
          z = POD_HOVER_Z;
        }
        const away = launch && !(mode === 'after' && lift !== null && ms < 12 * BAY_FRAME_MS) ? sectorArt(sim, sim) : { x: 0, y: 0 };
        x += away.x - sectorArt(0, 0).x;
        y += away.y - sectorArt(0, 0).y;
        const parkedPose = mode === 'after' && lift !== null && lift < 1;
        put(parkedPose ? `${POD}.docked.d0` : `${POD}.fly.d${launch ? 2 : 6}`, pod, x, y - z * Z_PX);
        pod.visible = pod.visible && drawn;
        // Drawn under the bay: the pit's near lip and the doors cover a pod in it (the game sorts it low, behind the lip).
        root.setChildIndex(pod, parkedPose || mode === 'before' ? 0 : root.children.length - 1);
      };
    },
  };
}

function droneCell(ctx: LabCtx, front: boolean, newRow: boolean): LabCell {
  return {
    label: front ? 'drone bay after' : 'drone bay before', note: front ? 'bay, drones, then .front' : 'bay, then drones (no .front)', w: 220, h: 260, newRow,
    mount(root: Container) {
      const { atlas } = ctx;
      const put = (id: string, x: number, y: number): void => {
        const st = atlas.stat(id);
        if (!st) return;
        const s = new Sprite(st.tex);
        s.position.set(Math.round(x - st.ax), Math.round(y - st.ay));
        root.addChild(s);
      };
      const ox = 110, oy = 215;
      put(`${DRONE_BAY}.r0`, ox, oy);
      put('drone.repair.docked.d1', ox, oy - 38);
      put('drone.medic.docked.d1', ox, oy - 78);
      if (front) put(`${DRONE_BAY}.r0.front`, ox, oy);
      return () => undefined;
    },
  };
}

function deconCell(ctx: LabCtx, marked: boolean, newRow: boolean): LabCell {
  return {
    label: marked ? 'deconstruct after' : 'deconstruct before', note: marked ? 'red footprint marks' : 'nothing', w: 220, h: 260, newRow,
    mount(root: Container) {
      const { atlas } = ctx;
      const ox = 110, oy = 200;
      if (marked) {
        for (const [tx, ty] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) {
          const s = new Sprite(diamondTextures().outline);
          s.anchor.set(0.5);
          s.position.set(ox + iso(tx, ty).x, oy + iso(tx, ty).y);
          s.tint = 0xff3b3b;
          s.alpha = 0.8;
          root.addChild(s);
        }
      }
      const st = atlas.stat(`${DRONE_BAY}.r0`);
      if (st) {
        const s = new Sprite(st.tex);
        s.position.set(Math.round(ox - st.ax), Math.round(oy - st.ay));
        s.alpha = 0.95;
        root.addChild(s);
      }
      return () => undefined;
    },
  };
}

export const bayHandoffPanel: LabPanel = {
  id: 'bayHandoff',
  title: 'Playtest batch: pod bay handoff, drone bay front overlay, deconstruct marks',
  help: 'frames=8 (strip length of the pod rows)',
  zoom: 1,
  async cells(ctx) {
    const n = Number(ctx.params.get('frames') ?? 8) || 8;
    for (const id of [...ctx.atlas.ids(POD_BAY), ...ctx.atlas.ids(POD), ...ctx.atlas.ids(DRONE_BAY), ...ctx.atlas.ids('drone.repair'), ...ctx.atlas.ids('drone.medic')]) ctx.atlas.stat(id);
    await ctx.atlas.whenIdle();
    const cells: LabCell[] = [];
    for (const launch of [true, false])
      for (const mode of ['before', 'after'] as const)
        strip((launch ? LAUNCH : RETURN).length * BAY_FRAME_MS / 1000, n).forEach((t, i) => cells.push(podCell(ctx, launch, mode, t, i === 0)));
    cells.push(droneCell(ctx, false, true), droneCell(ctx, true, false), deconCell(ctx, false, false), deconCell(ctx, true, false));
    return cells;
  },
};
