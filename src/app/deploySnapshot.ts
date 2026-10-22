import { CrewC, ShipC, VehicleC, jumpWarnings, nodeOf, type Sim } from '../sim';
import { placementGapError, regions } from '../sim/regions';
import { PLAYER_START } from '../sim/tuning';
import type { UiDeploy, UiJumpWarnings } from '../ui/starmapApi';

/** Why the waiting ship cannot go with its top-left at (x, y): the bounds and the gap rule `sector.deploy` checks, or null when it can. */
export function deployError(sim: Sim, x: number, y: number): string | null {
  const p = sim.sector.packet;
  if (sim.sector.state !== 'deploying' || !p) return 'notDeploying';
  if (!Number.isInteger(x) || !Number.isInteger(y)) return 'badValue';
  if (x < 0 || y < 0 || x + p.w > sim.sector.width || y + p.h > sim.sector.height) return 'outOfBounds';
  return placementGapError(sim, { x, y, w: p.w, h: p.h });
}

/** The valid spot nearest to where a new game starts the ship, on a coarse scan, or null. */
function suggest(sim: Sim): { x: number; y: number } | null {
  const p = sim.sector.packet;
  if (!p) return null;
  let best: { x: number; y: number; d: number } | null = null;
  for (let y = 0; y + p.h <= sim.sector.height; y += 2) {
    for (let x = 0; x + p.w <= sim.sector.width; x += 2) {
      const d = Math.hypot(x - PLAYER_START.x, y - PLAYER_START.y);
      if ((!best || d < best.d) && !deployError(sim, x, y)) best = { x, y, d };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

/** The deploy picker's data: the sector, the waiting ship's size, a suggested spot and the ships already there. Null unless a ship is waiting. */
export function buildDeploy(sim: Sim): UiDeploy | null {
  const p = sim.sector.packet;
  if (sim.sector.state !== 'deploying' || !p) return null;
  return {
    node: sim.sector.node, nodeName: nodeOf(sim, sim.sector.node)?.name ?? sim.sector.node, width: sim.sector.width, height: sim.sector.height,
    ship: { w: p.w, h: p.h }, suggested: suggest(sim),
    others: regions(sim).map((r) => {
      const s = sim.world.get(r.ship, ShipC);
      return {
        x: r.bbox.x, y: r.bbox.y, w: r.bbox.w, h: r.bbox.h, frame: { x: r.frame.x, y: r.frame.y, w: r.frame.w, h: r.frame.h },
        name: s?.name ?? 'Ship', hostile: !!s && s.faction !== 'player' && s.faction !== 'neutral',
      };
    }),
  };
}

/** What a jump of the player's ship would leave behind (see `jumpWarnings`), as names for the confirm step. */
export function buildJumpWarnings(sim: Sim, ship: number): UiJumpWarnings {
  const w = jumpWarnings(sim, ship);
  const crewName = (id: number): string => sim.world.get(id, CrewC)?.name ?? 'Crew';
  const vehicleName = (id: number): string => {
    const v = sim.world.get(id, VehicleC);
    return (v && sim.content.vehicles?.[v.def]?.name) || v?.def || 'Shuttle';
  };
  return { crew: w.crew.map(crewName), vehicles: w.vehicles.map(vehicleName), hostileDocked: w.hostileDocked.map((id) => ({ id, name: vehicleName(id) })) };
}
