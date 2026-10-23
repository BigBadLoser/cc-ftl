import { stampAsteroid } from '../asteroids/place';
import { AirlockC, airlockTiles } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { hullSum } from '../combat/hull';
import { ShipC, type Faction } from '../combat/components';
import { spawnCrew } from '../combat/ships';
import { outfitStation } from '../stations/spawn';
import { ShipGrid } from '../shipGrid';
import { Struct } from '../structure';
import { gridFromTemplate, placeTemplateModules } from '../ship';
import type { Sim } from '../sim';
import type { OutpostPlan } from './gen';

/** Side of an outpost by style: surface outposts are civilian (neutral), dug ones hostile. */
export function outpostFaction(o: OutpostPlan): Faction {
  return o.style === 'surface' ? 'neutral' : 'hostile';
}

/**
 * Stamp an outpost with its asteroid's top-left at sector (x, y): the asteroid (`stampAsteroid`, gap-checked), then the base:
 * every non-'.' template tile with all its fields (structure, air, temperature) from the template grid (a dug base's metal walls become finished rock walls, `Struct.RockWall`), its modules, and a
 * `ShipC` region over the base rectangle that owns those tiles. The rock and ground inside the rectangle stay the asteroid's,
 * so the base's field systems see rock mass as walls. Then the station is outfitted like any station (`outfitStation`: trader and
 * station life) and crewed, security included (`spawnCrew` from the template's roles). Returns { asteroid, ship }.
 */
export function stampOutpost(sim: Sim, o: OutpostPlan, x: number, y: number): { asteroid: number; ship: number } {
  const asteroid = stampAsteroid(sim, o.asteroid, x, y);
  const dense = gridFromTemplate(o.template);
  const g = sim.sector.grid;
  const bx = x + o.at.x, by = y + o.at.y;
  const built: [number, number][] = [];
  for (let ly = 0; ly < dense.height; ly++) {
    for (let lx = 0; lx < dense.width; lx++) {
      if ((o.template.rows[ly]?.[lx] ?? '.') === '.') continue;
      built.push([bx + lx, by + ly]);
      const kind = dense.get('struct', lx, ly);
      g.set('struct', bx + lx, by + ly, o.style === 'dug' && kind === Struct.Wall ? Struct.RockWall : kind); // a dug base is walled in dressed rock
      for (const f of dense.fieldNames()) if (f !== 'struct' && f !== 'ship' && dense.get(f, lx, ly) !== g.get(f, bx + lx, by + ly)) g.set(f, bx + lx, by + ly, dense.get(f, lx, ly));
      if (g.get('ore', bx + lx, by + ly)) { g.set('ore', bx + lx, by + ly, 0); g.set('oreAmt', bx + lx, by + ly, 0); }
    }
  }
  placeTemplateModules(sim, o.template, bx, by);
  const ship = sim.world.createEntity();
  sim.world.add(ship, ShipC, {
    name: o.template.name, faction: outpostFaction(o), state: 'active', x: bx, y: by, width: dense.width, height: dense.height,
    hullMax: hullSum(new ShipGrid(0, g, bx, by, dense.width, dense.height)), integrity: 1, immobile: true, dormant: 1, outpost: { style: o.style, kind: o.kind, hidden: o.style === 'dug' },
  });
  for (const [tx, ty] of built) g.set('ship', tx, ty, ship);
  // The dock airlock: the one whose outer door sits on the plan's dock tile (the only airlock a shuttle may dock at).
  for (const id of sim.world.query(AirlockC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    const outer = m && def?.airlock ? airlockTiles(def, m).outer : null;
    const owner = sim.sector.grid.get('ship', m?.x ?? -1, m?.y ?? -1);
    if (outer && owner === ship && outer.x === bx + o.dock.outer.x && outer.y === by + o.dock.outer.y) (sim.world.get(ship, ShipC) as { outpost: { dock?: number } }).outpost.dock = id;
  }
  spawnCrew(sim, ship, o.template.crew ?? [], 100);
  outfitStation(sim, ship, o.stationKind, 'outpost', o.seed, { ...o.station, template: o.template }, bx, by);
  return { asteroid, ship };
}
