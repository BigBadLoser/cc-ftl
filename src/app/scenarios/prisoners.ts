import { AllegianceC, CrewC, ModuleC, PositionC, ShipC, placementError, playerShip, type Command, type Sim } from '../../sim';
import { accessTile, footprintTiles } from '../../sim/modules/footprint';
import { footprintBlockedByCrew } from '../../sim/modules/spawn';
import { slabPlace } from '../../sim/stasis/query';
import { playerCrew } from '../../sim/story/world';
import type { Scenario } from './types';

const WHEEL = 'module.stasis_wheel';

/** A free spot for the stasis wheel nearest the ship's middle, its footprint off every other module's access tile. */
function wheelSpot(sim: Sim, ship: number): { x: number; y: number } | null {
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
  const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
  let best: { x: number; y: number; d: number } | null = null;
  for (let y = s.y; y < s.y + s.height; y++) for (let x = s.x; x < s.x + s.width; x++) {
    if (placementError(sim, ship, WHEEL, x, y, 0) !== null || footprintBlockedByCrew(sim, ship, WHEEL, x, y, 0)) continue;
    if (footprintTiles(def, x, y, 0).some((t) => access.has(`${t.x},${t.y}`))) continue;
    const d = Math.hypot(x - cx, y - cy);
    if (!best || d < best.d) best = { x, y, d };
  }
  return best;
}

/** The commands of the start: the wheel, two hostile crew (by the second and third crew members) and two spare empty slabs on the floor. */
export function prisonerCommands(sim: Sim): Command[] {
  const ship = playerShip(sim);
  if (!ship) return [];
  const out: Command[] = [];
  const spot = wheelSpot(sim, ship);
  if (spot) out.push({ type: 'debug.spawnModule', ship, x: spot.x, y: spot.y, def: WHEEL, rot: 0 });
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
  setTimeout(() => {
    const caught = newHostiles(sim, before);
    for (const id of caught) dispatch({ type: 'debug.imprison', crew: id });
    if (!params.has('unpowered')) return;
    const wheel = sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === WHEEL);
    const cut = (): void => {
      if (wheel === undefined) return;
      if (caught.some((id) => slabPlace(sim, id)?.kind !== 'wheel')) return void setTimeout(cut, 1000);
      dispatch({ type: 'module.setEnabled', id: wheel, enabled: false });
    };
    setTimeout(cut, 1000);
  }, 300);
};
