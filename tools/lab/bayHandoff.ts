import { Container, Graphics, Sprite } from 'pixi.js';
import { diamondTextures } from '../../src/render/diamonds';
import { Z_PX } from '../../src/render/heights';
import { iso } from '../../src/render/iso';
import { sectorArt } from '../../src/render/sectorPos';
import { BAY_FRAME_MS, FLOOR_EXIT, LAUNCH, RETURN, bayHandoff, bayId, parkedId } from '../../src/render/vehicleBayArt';
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

interface Craft {
  label: string;
  bay: string;
  /** Bay footprint (tiles), and the art ids of the craft. */
  size: [number, number];
  craft: string;
  pit: number;
  cruise: number;
  /** Where the craft stops being a flat-shaded pose: sprite ids (parked pose, flight pose per direction). */
  parkedPose: string;
  fly: string;
}
const CRAFTS: Craft[] = [
  { label: 'pod', bay: POD_BAY, size: [3, 3], craft: POD, pit: -0.6, cruise: POD_HOVER_Z, parkedPose: `${POD}.docked.d0`, fly: `${POD}.fly.d2` },
  { label: 'shuttle', bay: 'module.vehicle_bay', size: [4, 5], craft: 'vehicle.shuttle', pit: -0.95, cruise: 0.4, parkedPose: 'vehicle.shuttle.docked.d0', fly: 'vehicle.shuttle.fly.d2' },
];

/** A craft leaving or entering its bay through the floor doors (vehicleBayArt's pose: sink, hidden under the hull, emerge; landing is the rise). The deck / hull clip is a mask at the craft's ground line. */
function craftCell(ctx: LabCtx, c: Craft, launch: boolean, t: number, newRow: boolean): LabCell {
  return {
    label: `${c.label} ${launch ? 'launch' : 'landing'}`, note: `${t.toFixed(2)} s`, w: 300, h: 340, at: t, newRow,
    mount(root: Container) {
      const { atlas } = ctx;
      const bay = new Sprite(), parked = new Sprite(), body = new Sprite();
      const mask = new Graphics();
      const hullEdge = new Graphics();
      root.addChild(body, bay, parked, mask, hullEdge);
      body.mask = mask;
      const put = (id: string, s: Sprite, x: number, y: number): void => {
        const st = atlas.stat(id);
        s.visible = !!st;
        if (!st) return;
        s.texture = st.tex;
        s.position.set(Math.round(x - st.ax), Math.round(y - st.ay));
      };
      const OX = 150, OY = 270;
      return (time) => {
        const ms = time * 1000;
        const steps = launch ? LAUNCH : RETURN;
        const step = steps[Math.min(steps.length - 1, Math.floor(ms / BAY_FRAME_MS))] as (typeof steps)[number];
        put(bayId(c.bay, 0, step.bay), bay, OX, OY);
        put(parkedId(0, step.shuttle ?? '', c.craft), parked, OX, OY);
        parked.visible = parked.visible && step.shuttle !== null;
        const h = bayHandoff(!launch, launch ? ms : Infinity, launch ? Infinity : ms);
        // The craft's centre: the bay's middle, up-left of the anchor tile; a launch then drifts out toward the hull edge as it emerges.
        const cx = -(c.size[0] - 1) / 2, cy = -(c.size[1] - 1) / 2;
        const drift = launch && ms >= FLOOR_EXIT.emerge * BAY_FRAME_MS ? Math.min(1.6, ((ms - FLOOR_EXIT.emerge * BAY_FRAME_MS) / 1000) * 1.4) : 0;
        const g = sectorArt(cx + drift, cy + drift);
        const o = sectorArt(0, 0);
        const gx = OX + g.x - o.x, gy = OY + g.y - o.y;
        const lift = h.lift ?? (launch ? 1 : 0);
        const z = c.pit + (c.cruise - c.pit) * lift;
        put(lift < 1 ? c.parkedPose : c.fly, body, gx, gy - z * Z_PX);
        body.visible = body.visible && h.drawn;
        // Clip: everything below the craft's ground line is hidden (the deck over a craft in the pit, the hull's edge over one coming up).
        mask.clear();
        mask.rect(0, 0, 300, gy + (h.clip ? 0 : 400)).fill(0xffffff);
        hullEdge.clear();
        if (h.drawn && h.clip) hullEdge.moveTo(gx - 60, gy).lineTo(gx + 60, gy).stroke({ color: h.clip === 'hull' ? 0xff8040 : 0x40c0ff, width: 1, alpha: 0.7 });
        // In the pit the bay's near lip is over the craft; out beside the hull it is over everything.
        root.setChildIndex(body, h.clip === 'hull' || !h.clip ? root.children.length - 1 : 0);
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
    for (const id of [...ctx.atlas.ids(POD_BAY), ...ctx.atlas.ids(POD), ...ctx.atlas.ids('module.vehicle_bay'), ...ctx.atlas.ids('vehicle.shuttle'), ...ctx.atlas.ids(DRONE_BAY), ...ctx.atlas.ids('drone.repair'), ...ctx.atlas.ids('drone.medic')]) ctx.atlas.stat(id);
    await ctx.atlas.whenIdle();
    const cells: LabCell[] = [];
    for (const c of CRAFTS)
      for (const launch of [true, false])
        strip((launch ? LAUNCH : RETURN).length * BAY_FRAME_MS / 1000, n).forEach((t, i) => cells.push(craftCell(ctx, c, launch, t, i === 0)));
    cells.push(droneCell(ctx, false, true), droneCell(ctx, true, false), deconCell(ctx, false, false), deconCell(ctx, true, false));
    return cells;
  },
};
