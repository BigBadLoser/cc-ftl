import type { Layout } from './layout';

/** An airlock-only dock: at most this many floor tiles (the airlock's 3x3 inboard part plus one row of 3). */
const BARE_DOCK_FLOOR = 12;
/** Modules that do not count as a dock's contents: the airlock itself and its lamp. */
const FIXTURES: readonly string[] = ['module.airlock', 'module.light'];

const SPACE = (c: string): boolean => c === '.' || c === ' ';

export interface OpenDocks {
  /** Airlock-only docks opened into a corridor. */
  merged: number;
  /** Airlock-only docks left walled, as no corridor borders them. */
  walled: number;
  /** Tiles that joined a corridor (still dock space for the layout metrics: they are not walkway the plan asked for). */
  tiles: number[];
}

/**
 * Airlock-only dock rooms open straight into the corridor they border (user decision): the partition between them and
 * the corridor goes, door included, and the dock's floor joins the corridor. Only a corridor (a hall room): a dock that
 * borders other rooms only stays walled. Docks with anything else in them (lockers, racks) keep their wall and door.
 * A partition tile goes only when it stands between dock floor and corridor floor in line and touches no space, so the
 * hull and the outline stay as they are (and airtight). Edits `lay.cells` and `lay.roomOf` in place.
 */
export function openBareDocks(lay: Layout): OpenDocks {
  const out: OpenDocks = { merged: 0, walled: 0, tiles: [] };
  const { w } = lay;
  for (let room = 0; room < lay.roles.length; room++) {
    if (lay.roles[room] !== 'dock') continue;
    const floor = lay.roomTiles(room);
    if (floor.length === 0 || floor.length > BARE_DOCK_FLOOR) continue;
    const inRoom = new Set(floor);
    const contents = lay.modules.some((m, i) => !FIXTURES.includes(m.def) && floor.some((t) => lay.occ[t] === i));
    if (contents || !lay.modules.some((m, i) => m.def === 'module.airlock' && floor.some((t) => lay.occ[t] === i))) continue;
    // Partition tiles: a wall or door with dock floor on one side and corridor floor straight across.
    const open: { i: number; to: number }[] = [];
    for (const t of floor) {
      const x = t % w;
      const y = Math.floor(t / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const c = lay.at(x + dx, y + dy);
        if (c !== '#' && c !== 'D') continue;
        if (!lay.inBounds(x + 2 * dx, y + 2 * dy) || lay.at(x + 2 * dx, y + 2 * dy) !== '_') continue;
        const across = (y + 2 * dy) * w + x + 2 * dx;
        const to = lay.roomOf[across] as number;
        if (to < 0 || to === room || inRoom.has(across) || lay.roles[to] !== 'hall') continue;
        let airtight = true;
        for (let ey = -1; ey <= 1; ey++) for (let ex = -1; ex <= 1; ex++) if (SPACE(lay.at(x + dx + ex, y + dy + ey))) airtight = false;
        if (airtight) open.push({ i: (y + dy) * w + x + dx, to });
      }
    }
    if (open.length === 0) {
      out.walled++;
      continue;
    }
    // One corridor: the one most of the partition faces.
    const votes = new Map<number, number>();
    for (const o of open) votes.set(o.to, (votes.get(o.to) ?? 0) + 1);
    const hall = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
    for (const o of open) {
      if (o.to !== hall) continue;
      lay.cells[o.i] = '_';
      lay.roomOf[o.i] = hall;
      out.tiles.push(o.i);
    }
    for (const t of floor) lay.roomOf[t] = hall;
    out.tiles.push(...floor);
    out.merged++;
  }
  return out;
}
