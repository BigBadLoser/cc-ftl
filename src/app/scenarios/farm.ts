import { ModuleC, PositionC, ShipC, placementError, playerShip, type Command, type Sim } from '../../sim';
import { playerCrew } from '../../sim/story/world';
import type { Scenario } from './types';

/** `n` free spots for a hydroponics bed (2x1, the walkway tile below it kept free), nearest the galley first, none overlapping another. */
function bedSpots(sim: Sim, ship: number, n: number): { x: number; y: number }[] {
  const s = sim.world.get(ship, ShipC);
  const galley = sim.world.query(ModuleC).map((id) => sim.world.get(id, ModuleC)!).find((m) => m.def === 'module.galley');
  if (!s) return [];
  const [cx, cy] = galley ? [galley.x, galley.y] : [s.x + s.width / 2, s.y + s.height / 2];
  const cells: { x: number; y: number; d: number }[] = [];
  for (let y = s.y; y < s.y + s.height; y++) for (let x = s.x; x < s.x + s.width; x++) {
    if (placementError(sim, ship, 'module.hydroponics', x, y, 0) === null) cells.push({ x, y, d: Math.hypot(x - cx, y - cy) });
  }
  cells.sort((a, b) => a.d - b.d);
  const taken = new Set<string>();
  const out: { x: number; y: number }[] = [];
  for (const c of cells) {
    const tiles = [[c.x, c.y], [c.x + 1, c.y], [c.x, c.y + 1], [c.x - 1, c.y], [c.x + 2, c.y]];
    if (out.length >= n) break;
    if (tiles.some(([x, y]) => taken.has(`${x},${y}`))) continue;
    for (const [x, y] of tiles) taken.add(`${x},${y}`);
    out.push({ x: c.x, y: c.y });
  }
  return out;
}

/**
 * `?scenario=farm` (#59): three hydroponics beds near the galley (greens half grown, protein beans ready to harvest, herbs set but empty), some produce in
 * hand, a keep-4 meal order at the galley, and a cook (the first crew member, cooking level 3) who turns out fine meals. Crew work as usual from here.
 */
export const farm: Scenario = ({ sim, dispatch, setSpeed, selectCrew }) => {
  setSpeed(1);
  const ship = playerShip(sim);
  const cook = playerCrew(sim)[0];
  if (!ship) return;
  const spots = bedSpots(sim, ship, 3);
  const cmds: Command[] = spots.map((p) => ({ type: 'debug.spawnModule', ship, x: p.x, y: p.y, def: 'module.hydroponics', rot: 0 }));
  for (const c of cmds) dispatch(c);
  setTimeout(() => {
    const beds = sim.world.query(ModuleC).filter((id) => sim.world.get(id, ModuleC)?.def === 'module.hydroponics');
    const [greens, beans, herbs] = beds;
    if (greens !== undefined) { dispatch({ type: 'plot.setCrop', moduleId: greens, crop: 'crop.greens' }); dispatch({ type: 'debug.setPlot', moduleId: greens, crop: 'crop.greens', grown: 110 }); }
    if (beans !== undefined) { dispatch({ type: 'plot.setCrop', moduleId: beans, crop: 'crop.beans' }); dispatch({ type: 'debug.setPlot', moduleId: beans, crop: 'crop.beans', ready: true }); }
    if (herbs !== undefined) dispatch({ type: 'plot.setCrop', moduleId: herbs, crop: 'crop.herbs' });
    const at = cook && sim.world.get(cook, PositionC);
    if (at) for (const [item, count] of [['item.greens', 12], ['item.beans', 6]] as const) dispatch({ type: 'debug.spawnItems', ship, x: at.x, y: at.y, item, count });
    const galley = sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === 'module.galley');
    if (galley !== undefined) {
      dispatch({ type: 'production.add', moduleId: galley, recipe: 'recipe.meal_greens', mode: 'keep', target: 4 });
      dispatch({ type: 'production.add', moduleId: galley, recipe: 'recipe.meal_beans', mode: 'keep', target: 4 });
    }
    if (cook) {
      dispatch({ type: 'debug.setCrew', id: cook, xp: { cooking: 600 } });
      selectCrew(cook, false);
    }
  }, 600);
};
