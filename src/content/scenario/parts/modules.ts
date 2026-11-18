import { ModuleC, ShipC, placementError, playerShip, type Command, type Sim } from '../../../sim';
import { accessTile } from '../../../sim/modules/footprint';
import { definePart } from '../types';

export interface ModuleAdd {
  /** The module to place (a 2x1 module with a walkway below it, like the hydroponics bed). */
  def: string;
  /** Nearest the first module of this def (else the ship's middle), never overlapping another one added or any module's access tile. */
  near?: string;
  /** A crop in the bed (`plot.setCrop`), how far grown (`debug.setPlot`), or ready to harvest. */
  plot?: { crop: string; grown?: number; ready?: boolean };
}
export interface ModulesSpec {
  add?: readonly ModuleAdd[];
  /** Production orders at the first module of a def (`production.add`). */
  orders?: readonly { at: string; recipe: string; mode: 'count' | 'keep'; target: number }[];
}
declare module '../types' { interface ScenarioSpec { modules?: ModulesSpec } }

/** `n` free spots for a 2x1 bed with a walkway tile below it, nearest `near` (a module def) first, none overlapping another. */
export function bedSpots(sim: Sim, ship: number, def: string, n: number, near?: string): { x: number; y: number }[] {
  const s = sim.world.get(ship, ShipC);
  const anchor = near ? sim.world.query(ModuleC).map((id) => sim.world.get(id, ModuleC)!).find((m) => m.def === near) : undefined;
  if (!s) return [];
  const [cx, cy] = anchor ? [anchor.x, anchor.y] : [s.x + s.width / 2, s.y + s.height / 2];
  const cells: { x: number; y: number; d: number }[] = [];
  for (let y = s.y; y < s.y + s.height; y++) for (let x = s.x; x < s.x + s.width; x++) {
    if (placementError(sim, ship, def, x, y, 0) === null) cells.push({ x, y, d: Math.hypot(x - cx, y - cy) });
  }
  cells.sort((a, b) => a.d - b.d);
  const taken = new Set<string>();
  // Keep every module's access tile and its neighbours clear (a bed there would wall the galley or a door off).
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC)!;
    const d = sim.content.modules[m.def];
    const at = d && accessTile(d, m.x, m.y, m.rot);
    if (at) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) taken.add(`${at.x + dx},${at.y + dy}`);
  }
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

/** Modules added to the player's ship, their plots set, and production orders (`debug.spawnModule`, `plot.setCrop`, `debug.setPlot`, `production.add`). */
export default definePart<'modules'>({
  key: 'modules',
  after: ['ship', 'node', 'items', 'prep'],
  apply(ctx, spec) {
    const { sim } = ctx;
    const ship = playerShip(sim);
    if (ship === undefined) return;
    const had = new Set(sim.world.query(ModuleC));
    // Spots are found for each def and anchor together (so they never overlap), then every module is spawned at once.
    const placed: { add: ModuleAdd; x: number; y: number }[] = [];
    const groups = new Map<string, ModuleAdd[]>();
    for (const add of spec.add ?? []) groups.set(`${add.def}|${add.near ?? ''}`, [...(groups.get(`${add.def}|${add.near ?? ''}`) ?? []), add]);
    for (const adds of groups.values()) {
      const spots = bedSpots(sim, ship, adds[0]!.def, adds.length, adds[0]!.near);
      spots.forEach((spot, i) => placed.push({ add: adds[i]!, ...spot }));
    }
    ctx.enqueue(...placed.map((p): Command => ({ type: 'debug.spawnModule', ship, x: p.x, y: p.y, def: p.add.def, rot: 0 })));
    ctx.step();
    const fresh = sim.world.query(ModuleC).filter((id) => !had.has(id));
    const cmds: Command[] = [];
    placed.forEach((p, i) => {
      const moduleId = fresh[i];
      if (moduleId === undefined || !p.add.plot) return;
      cmds.push({ type: 'plot.setCrop', moduleId, crop: p.add.plot.crop });
      if (p.add.plot.grown !== undefined || p.add.plot.ready) {
        cmds.push({ type: 'debug.setPlot', moduleId, crop: p.add.plot.crop, ...(p.add.plot.grown !== undefined ? { grown: p.add.plot.grown } : {}), ...(p.add.plot.ready ? { ready: true } : {}) });
      }
    });
    for (const o of spec.orders ?? []) {
      const at = sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === o.at);
      if (at !== undefined) cmds.push({ type: 'production.add', moduleId: at, recipe: o.recipe, mode: o.mode, target: o.target });
    }
    ctx.enqueue(...cmds);
    if (cmds.length) ctx.step();
  },
});
