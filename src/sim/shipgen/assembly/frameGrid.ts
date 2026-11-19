import { dockSpec, type ShipPlan } from '../plan';
import { BAND, MIN_DEPTH, type Frame } from './frame';
import { RegionGrid, SOLID, SPACE } from './regions';

/**
 * The frame's fixed regions on a region grid, shared by the outline's layouts: the bridge at the bow, the spine hall and
 * the dock's airlock bays (painted last by `closeFrame`, over any room), and `paint` for the side rooms between.
 */
export interface FrameGrid {
  g: RegionGrid; hall: number; docks: [number, number];
  /** Paints region `id` over columns [x0, x1) where the outline is inside and `yIn(y)` holds. */
  paint: (id: number, x0: number, x1: number, yIn: (y: number) => boolean) => void;
}

export function frameGrid(fr: Frame, plan: ShipPlan): FrameGrid {
  const { W, H, inside, top, xBr } = fr;
  const g = new RegionGrid(128), ox = -Math.floor(W / 2);
  const paint = (id: number, x0: number, x1: number, yIn: (y: number) => boolean): void => {
    for (let tx = x0; tx < x1; tx++) for (let ty = -H; ty <= H; ty++) if (inside(tx, ty) && yIn(ty)) g.set(ox + tx, ty, id);
  };
  const hall = g.hall('hall');
  // The airlock bays: the cross corridor's halls, with their fixture.
  const docks: [number, number] = [g.hall('dock', undefined, dockSpec()), g.hall('dock', undefined, dockSpec())];
  // From the first column three floor rows deep: a nose spike or tip narrower than the helm is plating.
  let xNose = 0;
  while (xNose < xBr - MIN_DEPTH && top(xNose) < 2) xNose++;
  paint(g.room(plan.command.role, { spec: plan.command }), xNose, xBr, () => true);
  return { g, hall, docks, paint };
}

/** Unpainted floor to plating, then the spine and the cross corridor out to the airlocks over everything. */
export function closeFrame(fr: Frame, { g, hall, docks, paint }: FrameGrid): void {
  const { W, H, inside, xBr, dockAt, CW } = fr, ox = -Math.floor(W / 2);
  for (let tx = 0; tx < W; tx++) for (let ty = -H; ty <= H; ty++) if (inside(tx, ty) && g.at(ox + tx, ty) === SPACE) g.set(ox + tx, ty, SOLID);
  for (let tx = xBr; tx < W; tx++) for (let ty = -1; ty <= 1; ty++) if (inside(tx, ty)) g.set(ox + tx, ty, hall);
  paint(docks[0], dockAt, dockAt + CW, (y) => y <= -BAND);
  paint(docks[1], dockAt, dockAt + CW, (y) => y >= BAND);
}
