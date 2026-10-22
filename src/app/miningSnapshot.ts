import { AsteroidC, CrewC, MiningPodC, ShipC, VehicleC, cargoCount, homeShip, type OreDef, type Sim } from '../sim';
import type { UiAsteroid, UiMining, UiPod } from '../ui/api';

/** Ore units left per kind over an asteroid's rock (one sweep of its rock bodies' boxes). */
function oreTotals(sim: Sim, id: number): UiAsteroid['ore'] {
  const a = sim.world.get(id, AsteroidC);
  const ores = Object.values(sim.content.ores ?? {}) as OreDef[];
  const units = new Map<number, number>();
  if (!a) return [];
  const g = sim.sector.grid;
  for (const p of a.parts) {
    for (let y = p.y; y < p.y + p.h; y++) {
      for (let x = p.x; x < p.x + p.w; x++) {
        const code = g.get('ore', x, y);
        if (code && g.get('ship', x, y) === id) units.set(code, (units.get(code) ?? 0) + g.get('oreAmt', x, y));
      }
    }
  }
  return ores.filter((o) => units.has(o.code)).sort((a, b) => a.code - b.code).map((o) => ({
    name: o.name, item: o.item, units: units.get(o.code) as number, color: `#${o.color.toString(16).padStart(6, '0')}`,
  }));
}

/** Plain-data mining state: the node's asteroids (with ore totals) and the player's mining pods. Reads the sim only. */
export function buildMining(sim: Sim): UiMining {
  const me = homeShip(sim);
  const pods: UiPod[] = [];
  for (const id of [...sim.world.query(VehicleC)].sort((a, b) => a - b)) {
    const v = sim.world.get(id, VehicleC);
    const def = v && sim.content.vehicles?.[v.def];
    if (!v || !def?.mining || sim.world.get(v.homeShip, ShipC)?.faction !== 'player') continue;
    const m = sim.world.get(id, MiningPodC);
    pods.push({
      id, name: `${def.name} ${pods.length + 1}`, state: v.state, phase: m ? (m.waiting ? 'waiting' : m.phase) : null,
      asteroid: m?.asteroid ?? 0, pilot: v.pilot ? (sim.world.get(v.pilot, CrewC)?.name ?? null) : null,
      hold: cargoCount(v), cap: def.cargo ?? 0, trips: m?.trips ?? 0, home: v.homeShip === me,
    });
  }
  const asteroids: UiAsteroid[] = [];
  for (const id of [...sim.world.query(AsteroidC)].sort((a, b) => a - b)) {
    const a = sim.world.get(id, AsteroidC);
    if (!a) continue;
    asteroids.push({
      id, kind: a.kind, coverage: a.coverage, name: a.kind === 'big' ? 'Asteroid' : 'Asteroid field', x: a.x, y: a.y, w: a.width, h: a.height,
      ore: oreTotals(sim, id), pods: pods.filter((p) => p.asteroid === id).length,
    });
  }
  return { asteroids, pods };
}
