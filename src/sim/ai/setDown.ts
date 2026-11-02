import { CarriedC, CrewC, JobC, PositionC, type Position } from '../crew/components';
import { exposure, tileHazards } from '../crew/hazard';
import { origin } from '../crew/helpers';
import type { Tile } from '../crew/pathfind';
import { isSuited } from '../eva/suit';
import { isTileWalkable } from '../modules/walk';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';

/** Tiles (steps from the rescuer) searched for a safe tile to set a patient down on. */
export const SETDOWN_STEPS = 4;

/**
 * A rescuer gives up a carried patient (`abortTask` with a reason that disposes of the carry: a hazard, a fight, critical air): the patient is
 * set down on the nearest tile within SETDOWN_STEPS where they are safe (the hazard test the escape uses, for the patient's own exposure),
 * else where the rescuer stands. They lie downed again, keep their bed (`Downed.bed`, still reserved to them), and the rescue job `jobId`
 * (when it is the one carrying them) points at them again, for the next rescuer to pick up.
 */
export function setDownPatient(sim: Sim, rescuer: number, jobId: number): void {
  const pos = sim.world.get(rescuer, PositionC);
  if (!pos) return;
  for (const patient of sim.world.query(CarriedC)) {
    if (sim.world.get(patient, CarriedC)?.carrier !== rescuer) continue;
    const at = sim.world.get(patient, PositionC);
    const from = origin(pos);
    const spot = safeSpotNear(sim, rescuer, patient, pos, from) ?? from;
    sim.world.remove(patient, CarriedC);
    const c = sim.world.get(patient, CrewC);
    if (c) c.activity = 'downed';
    if (at) {
      at.x = at.toX = spot.x;
      at.y = at.toY = spot.y;
      at.progress = 0;
    }
    const job = sim.world.get(jobId, JobC);
    if (job?.kind === 'rescue' && job.target === patient) {
      job.x = spot.x;
      job.y = spot.y;
    }
  }
}

/** The nearest tile (breadth first from `from`, over tiles the rescuer can walk, at most SETDOWN_STEPS away) that is safe for the patient. */
function safeSpotNear(sim: Sim, rescuer: number, patient: number, pos: Position, from: Tile): Tile | null {
  const grid = shipGrid(sim, shipIdOf(sim, pos));
  if (!grid) return null;
  const walk = isSuited(sim, rescuer);
  const { suited, airless } = exposure(sim, patient);
  const safe = (x: number, y: number): boolean => tileHazards(grid, x, y, suited, airless) === 0;
  if (safe(from.x, from.y)) return from;
  const seen = new Set<number>([from.y * grid.width + from.x]);
  let ring: Tile[] = [from];
  for (let d = 1; d <= SETDOWN_STEPS && ring.length > 0; d++) {
    const next: Tile[] = [];
    for (const t of ring) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = t.x + dx, y = t.y + dy, k = y * grid.width + x;
        if (!grid.inBounds(x, y) || seen.has(k) || !isTileWalkable(sim, grid, x, y, walk)) continue;
        seen.add(k);
        if (safe(x, y)) return { x, y };
        next.push({ x, y });
      }
    }
    ring = next;
  }
  return null;
}
