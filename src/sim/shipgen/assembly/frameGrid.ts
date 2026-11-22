import { dockSpec, type ShipPlan } from '../plan';
import { outboardRuns } from './bays';
import { BAND, MIN_DEPTH, type Frame } from './frame';
import { RegionGrid, SOLID, SPACE } from './regions';

/**
 * The frame's fixed regions on a region grid, shared by the outline's layouts: the bridge at the bow, the spine hall and
 * the dock's airlock bays (painted last by `closeFrame`, over any room), and `paint` for the side rooms between.
 */
export interface FrameGrid {
  g: RegionGrid; hall: number; docks: [number, number]; bridge: number;
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
  // (A lane hull's are in the lane's walls, `closeFrame`: its cross corridor is a corridor.)
  const docks: [number, number] = fr.lane ? [hall, hall] : [g.hall('dock', undefined, dockSpec()), g.hall('dock', undefined, dockSpec())];
  // From the first column three floor rows deep: a nose spike or tip narrower than the helm is plating.
  let xNose = 0;
  while (xNose < xBr - MIN_DEPTH && top(xNose) < 2) xNose++;
  // Through the plating column before the band, so its aft wall is one wall with the spine's end on it.
  const bridge = g.room(plan.command.role, { spec: plan.command });
  paint(bridge, xNose, xBr + 1, () => true);
  return { g, hall, docks, paint, bridge };
}

/** Unpainted floor to plating, then the spine and the cross corridor out to the airlocks over everything. */
export function closeFrame(fr: Frame, { g, hall, docks, paint, bridge }: FrameGrid): void {
  const { W, H, inside, xBr, dockAt, CW, xS, lane } = fr, ox = -Math.floor(W / 2);
  for (let tx = 0; tx < W; tx++) for (let ty = -H; ty <= H; ty++) if (inside(tx, ty) && g.at(ox + tx, ty) === SPACE) g.set(ox + tx, ty, SOLID);
  // The spine to the stern, or on a lane hull to the cross corridor, a corridor down each side hull from there to its engine room.
  for (let tx = xBr + 1; tx < (lane ? dockAt + CW : W); tx++) for (let ty = -1; ty <= 1; ty++) if (inside(tx, ty)) g.set(ox + tx, ty, hall);
  if (lane) paint(hall, dockAt + CW, xS + 1, (y) => Math.abs(Math.abs(y) - lane.yc) <= 1);
  // (Its alcoves: side hull too shallow or short for a room, open to the corridor out to the hull, up to the
  // rooms beside (their one wall between); each a hall of its own, a vending machine in it and, with the floor, a bench.)
  if (lane) {
    const runs = outboardRuns(fr), cols: number[] = [];
    for (let tx = dockAt + CW + 1; tx <= xS; tx++) if (!runs.some(([a, b]) => tx >= a && tx <= b)) cols.push(tx);
    const rowsAt = (tx: number): number => Math.max(0, fr.outer(tx) - 1 - (lane.yc + 2) + 1);
    for (let i = 0; i < cols.length; ) {
      let j = i + 1;
      while (j < cols.length && cols[j] === (cols[j - 1] as number) + 1) j++;
      const x0 = cols[i] as number, x1 = (cols[j - 1] as number) + 1;
      let area = 0;
      for (let tx = x0; tx < x1; tx++) area += rowsAt(tx);
      const mods = area >= 8 ? ['module.vending', 'module.bench'] : area >= 3 ? ['module.vending'] : [];
      for (const sign of [-1, 1]) {
        const id = mods.length ? g.hall('hall', undefined, { role: 'hall', use: 'alcove', mods, w: x1 - x0, h: 2 }) : hall;
        for (let tx = x0; tx < x1; tx++) paint(id, tx, tx + 1, (y) => sign * y >= lane.yc + 2 && sign * y <= fr.outer(tx) - 1);
      }
      i = j;
    }
  }
  paint(docks[0], dockAt, dockAt + CW, (y) => y <= -BAND);
  paint(docks[1], dockAt, dockAt + CW, (y) => y >= BAND);
  // A lane hull's airlocks: from each side corridor in to the lane's wall.
  if (lane) for (const d of lane.docks) for (const sign of [-1, 1]) {
    paint(g.hall('dock', undefined, dockSpec()), d, d + CW, (y) => sign * y >= lane.edge(d) && sign * y <= lane.yc - 2);
  }
  fillJuts(fr, g, bridge);
}

/**
 * No one-tile juts in the bridge: a floor tile of it that ends a stretch one tile wide, across or down (a step of the
 * bow's hull against the aft wall), becomes plating, again until none is left, so the side walls run straight to the
 * back wall. (Only the ends: a one-wide link between two parts of the room stays. Plating beside floor is just wall, so
 * nothing is cut off.)
 */
function fillJuts(fr: Frame, g: RegionGrid, bridge: number): void {
  const { W, H, xBr } = fr, ox = -Math.floor(W / 2), size = g.size, half = g.half;
  for (let pass = 0; pass < 8; pass++) {
    const cell = g.compile();
    const floor = (tx: number, ty: number): boolean => cell[(ty + half) * size + ox + tx + half] === '_' && g.at(ox + tx, ty) === bridge;
    let any = false;
    for (let tx = 0; tx <= xBr + 1; tx++) for (let ty = -H; ty <= H; ty++) {
      if (!floor(tx, ty)) continue;
      const l = floor(tx - 1, ty), r = floor(tx + 1, ty), u = floor(tx, ty - 1), d = floor(tx, ty + 1);
      const jut = +l + +r + +u + +d <= 1 || (!l && !r && (!u || !d)) || (!u && !d && (!l || !r));
      if (jut) { g.set(ox + tx, ty, SOLID); any = true; }
    }
    if (!any) return;
  }
}
