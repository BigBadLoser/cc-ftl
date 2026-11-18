import { INSPECT_FIGHT_BAN_TURNS, INSPECT_FIGHT_HIT } from '../blackmarket/tuning';
import { AwayC } from '../away/components';
import { hostileAct } from '../combat/provoke';
import { revoke } from '../consent/guests';
import { DeadC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { destroyJob } from '../crew/jobEnd';
import type { Sim } from '../sim';
import { TraderC } from '../trade/types';
import { partyJobs } from './search';
import { standingHit } from '../galaxy/standing';
import { go } from './start';
import { InspectionC, type Inspection } from './types';
import { onInspectedShip } from './aboard';

/**
 * Fighting the inspectors (#138 step 3, docs/DESIGN.md "Contraband inspections in the world").
 * - Fighting (`fightInspection`): an attack order on an inspector, or the player provoking the ship that sent them. The faction thinks much less of the
 *   player (INSPECT_FIGHT_HIT); the inspectors go over to their faction's combat side where they stand and fight as boarders (they leave their jobs and the
 *   leave to be aboard goes); the ship that sent them is provoked (combat/provoke.ts: a patrol and its fleet engage, a station's own guns do), and a station
 *   refuses service for INSPECT_FIGHT_BAN_TURNS.
 * Refusing does not turn anyone hostile (settle.ts: the seized goods and a standing hit are the price).
 */

/** The inspection an inspector belongs to (its shuttle), if `crew` is one. */
export function inspectionOf(sim: Sim, crew: number): number | undefined {
  const v = sim.world.get(crew, AwayC)?.vehicle;
  return v !== undefined && sim.world.get(v, InspectionC)?.crew.includes(crew) ? v : undefined;
}

/** Is `crew` an inspector the player may attack (one still on duty, not already fighting)? */
export function attackableInspector(sim: Sim, crew: number): boolean {
  const v = inspectionOf(sim, crew);
  const phase = v === undefined ? undefined : sim.world.get(v, InspectionC)?.phase;
  return phase !== undefined && phase !== 'fight' && !sim.world.has(crew, DeadC);
}

const sideOf = (sim: Sim, faction: string): 'hostile' | 'rogue' => sim.content.galaxy?.factions[faction]?.combatFaction ?? 'hostile';

/** The inspection becomes a fight (see the file's note). No-op once it is one. */
export function fightInspection(sim: Sim, vehicle: number, insp: Inspection): void {
  if (insp.phase === 'fight') return;
  standingHit(sim, insp.faction, INSPECT_FIGHT_HIT);
  for (const id of partyJobs(sim, vehicle)) destroyJob(sim, id);
  insp.jobs = [];
  const side = sideOf(sim, insp.faction);
  // Those on the player's ship fight: they change sides and leave the away run (its recall, as combat makes the site unwanted, would otherwise lift them
  // off mid-fight). The rest (on the shuttle, or drifting back to it) stay on the run and go home with it.
  for (const id of insp.crew) {
    if (!onInspectedShip(sim, id, insp)) continue;
    const a = sim.world.get(id, AllegianceC);
    if (a) a.faction = side;
    sim.world.remove(id, AwayC);
  }
  revoke(sim, insp.ship, 'inspect', { site: insp.ship });
  insp.outcome = 'fought';
  go(insp, 'fight');
  const t = sim.world.get(insp.station, TraderC);
  if (t) t.barredUntil = Math.max(t.barredUntil ?? 0, sim.galaxy.turn + INSPECT_FIGHT_BAN_TURNS);
  hostileAct(sim, insp.station, 'inspection');
  sim.events.emit({ type: 'inspect.fought', inspection: vehicle, faction: insp.faction, ship: insp.station, ...(insp.patrol !== undefined ? { patrol: true as const } : {}) });
}

/** `crew.attack` on an inspector: the inspection becomes a fight first (so the target is hostile when the order is checked). */
export function attackInspector(sim: Sim, crew: number): void {
  const v = inspectionOf(sim, crew);
  const insp = v === undefined ? undefined : sim.world.get(v, InspectionC);
  if (v !== undefined && insp) fightInspection(sim, v, insp);
}
