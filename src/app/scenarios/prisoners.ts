import { AllegianceC, CrewC, ModuleC, PositionC, ShipC, placementError, playerShip, type Command, type Sim } from '../../sim';
import { accessTile, footprintTiles } from '../../sim/modules/footprint';
import { footprintBlockedByCrew } from '../../sim/modules/spawn';
import { isTileWalkable } from '../../sim/modules/walk';
import { shipGrid } from '../../sim/regions';
import { slabPlace } from '../../sim/stasis/query';
import { playerCrew } from '../../sim/story/world';
import type { Scenario } from './types';

const WHEEL = 'module.stasis_wheel';

/** True if, with the footprint at (x, y) turned `rot` blocked, a walk from its hatch still reaches every tile in `must` (the wheel does not wall anyone off). */
function keepsReach(sim: Sim, ship: number, x: number, y: number, rot: number, must: { x: number; y: number }[]): boolean {
  const def = sim.content.modules[WHEEL];
  const grid = shipGrid(sim, ship);
  const hatch = def && accessTile(def, x, y, rot);
  if (!def || !grid || !hatch) return false;
  const blocked = new Set(footprintTiles(def, x, y, rot).map((t) => `${t.x},${t.y}`));
  const seen = new Set<string>([`${hatch.x},${hatch.y}`]);
  const queue = [hatch];
  while (queue.length > 0) {
    const t = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: t.x + dx, y: t.y + dy }, k = `${n.x},${n.y}`;
      if (seen.has(k) || blocked.has(k) || !grid.inBounds(n.x, n.y) || !isTileWalkable(sim, grid, n.x, n.y)) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return must.every((t) => seen.has(`${t.x},${t.y}`));
}

/**
 * A free spot (and turn) for the stasis wheel nearest the ship's middle: off the crew, its hatch still reaching every crew member (a wheel in front of
 * a room's only door would wall the prisoners off from it), and off every other module's access tile where the ship has room for that.
 */
function wheelSpot(sim: Sim, ship: number): { x: number; y: number; rot: number } | null {
  const s = sim.world.get(ship, ShipC);
  const def = sim.content.modules[WHEEL];
  if (!s || !def) return null;
  const access = new Set<string>();
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC)!;
    const d = sim.content.modules[m.def];
    const a = d && accessTile(d, m.x, m.y, m.rot);
    if (a) access.add(`${a.x},${a.y}`);
  }
  const crew = playerCrew(sim).map((id) => sim.world.get(id, PositionC)).filter((p) => !!p).map((p) => ({ x: p!.x, y: p!.y }));
  const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
  const spots: { x: number; y: number; rot: number; d: number; covers: boolean }[] = [];
  for (let y = s.y; y < s.y + s.height; y++) for (let x = s.x; x < s.x + s.width; x++) for (let rot = 0; rot < 4; rot++) {
    if (placementError(sim, ship, WHEEL, x, y, rot) !== null || footprintBlockedByCrew(sim, ship, WHEEL, x, y, rot)) continue;
    const covers = footprintTiles(def, x, y, rot).some((t) => access.has(`${t.x},${t.y}`));
    spots.push({ x, y, rot, d: Math.hypot(x - cx, y - cy), covers });
  }
  // A packed starter (the Wayfarer) has no 3x3 spot clear of every access tile that leaves its rooms joined: covering a module's access tile is the lesser evil.
  spots.sort((a, b) => Number(a.covers) - Number(b.covers) || a.d - b.d || a.rot - b.rot);
  return spots.find((p) => keepsReach(sim, ship, p.x, p.y, p.rot, crew)) ?? null;
}

/** The commands of the start: the wheel, two hostile crew (by the second and third crew members) and two spare empty slabs on the floor. */
export function prisonerCommands(sim: Sim): Command[] {
  const ship = playerShip(sim);
  if (!ship) return [];
  const out: Command[] = [];
  const spot = wheelSpot(sim, ship);
  if (spot) out.push({ type: 'debug.spawnModule', ship, x: spot.x, y: spot.y, def: WHEEL, rot: spot.rot });
  const crew = playerCrew(sim);
  for (const c of [crew[1] ?? crew[0], crew[2] ?? crew[0]]) {
    const at = sim.world.get(c ?? 0, PositionC);
    if (at) out.push({ type: 'debug.spawnCrew', ship, x: at.x, y: at.y, role: 'role.security', faction: 'hostile' });
  }
  const first = sim.world.get(crew[0] ?? 0, PositionC);
  if (first) out.push({ type: 'debug.spawnItems', ship, x: first.x, y: first.y, item: 'item.stasis_slab', count: 2 });
  return out;
}

/** Hostile crew who were not there before: the ones to imprison. */
export const newHostiles = (sim: Sim, before: ReadonlySet<number>): number[] =>
  sim.world.query(CrewC).filter((id) => !before.has(id) && sim.world.get(id, AllegianceC)?.faction === 'hostile');

/**
 * `?scenario=prisoners` (#116): a stasis wheel (ten empty slabs) near the middle of the ship and two hostile prisoners standing by the crew, plus two
 * spare empty slabs on the floor. The crew seal each prisoner where they stand and cart the slab to the wheel on their own. `&unpowered`: once both
 * are in, the wheel is switched off, so the stasis alert runs and, a game hour later, the prisoners thaw (switch it back on in time to stop it).
 */
export const prisoners: Scenario = ({ sim, params, dispatch, setSpeed }) => {
  setSpeed(1);
  const before = new Set(sim.world.query(CrewC));
  for (const cmd of prisonerCommands(sim)) dispatch(cmd);
  // The spawns land on the next sim step, which on a slow page can be well after any fixed delay: wait until they are there.
  const imprison = (): void => {
    const caught = newHostiles(sim, before);
    if (caught.length === 0) return void setTimeout(imprison, 200);
    for (const id of caught) dispatch({ type: 'debug.imprison', crew: id });
    if (!params.has('unpowered')) return;
    const wheel = sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === WHEEL);
    const cut = (): void => {
      if (wheel === undefined) return;
      if (caught.some((id) => slabPlace(sim, id)?.kind !== 'wheel')) return void setTimeout(cut, 1000);
      dispatch({ type: 'module.setEnabled', id: wheel, enabled: false });
    };
    setTimeout(cut, 1000);
  };
  setTimeout(imprison, 200);
};
