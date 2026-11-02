import { BodyC } from '../body';
import { shipById } from '../combat/ships';
import { flightTicks, walkSpeed } from '../ai/travel';
import { HealthC, NeedsC, PositionC, type Job } from '../crew/components';
import { TICK_HZ } from '../time';
import { VehicleC } from '../vehicles/components';
import { needsAir } from '../eva/suit';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { AWAY_GO, AWAY_HOME_HEALTH, AWAY_HOME_HUNGER, AWAY_HOME_REST } from '../tuning';
import { AwayC, AwaySiteC, SiteRunC } from './components';

/**
 * The crew side of away sites (docs/DESIGN.md "Away sites", #286 slice 2a): who may take a passage, and the return drive's input. No site
 * code moves crew about except the closing lift; the crew AI does (the return machine, ai/machines/return.ts).
 */

/** The site a crew member is working on: they are of its party and stand on its grid. 0 otherwise. */
export function siteUnderFoot(sim: Sim, id: number): number {
  const away = sim.world.get(id, AwayC);
  const pos = away && sim.world.get(id, PositionC);
  return pos && shipIdOf(sim, pos) === away.site ? away.site : 0;
}

/** True if the party of this site is being called home: the site closes, is gone, or a fight started. */
export function siteRecalled(sim: Sim, site: number): boolean {
  const s = sim.world.get(site, AwaySiteC);
  const run = s && sim.world.get(s.vehicle, SiteRunC);
  return !s || s.status === 'closing' || !run || run.phase === 'recall' || sim.sector.inCombat;
}

/**
 * The return drive's input (`awayReturn`): absent unless the crew member works on their site. 0 when they must come aboard now (the site
 * is closing, a fight, or hurt below AWAY_HOME_HEALTH), 500 when they are due home (rest under AWAY_HOME_REST or hunger under
 * AWAY_HOME_HUNGER: before the sleep and eat drives would want them), else 1000.
 */
export function awayReturn(sim: Sim, id: number): number | undefined {
  const site = siteUnderFoot(sim, id);
  if (!site) return undefined;
  if (siteRecalled(sim, site)) return 0;
  const h = sim.world.get(id, HealthC);
  if (h && h.max > 0 && h.hp < AWAY_HOME_HEALTH * h.max) return 0;
  const n = sim.world.get(id, NeedsC);
  if (n && (n.rest < AWAY_HOME_REST || (n.hunger ?? 100) < AWAY_HOME_HUNGER)) return 500;
  return 1000;
}

/**
 * The passage checks of `jobFits`: a player crew member not already of a party, who breathes (the seats are suited ones; robots come with
 * #284), rested and fed enough to stay a while.
 */
export function passageFits(sim: Sim, crew: number, job: Job): boolean {
  if (job.kind !== 'passage') return true;
  if (sim.world.has(crew, AwayC) || sim.world.get(crew, AllegianceC)?.faction !== 'player' || !needsAir(sim, crew)) return false;
  const n = sim.world.get(crew, NeedsC);
  return !!n && n.rest >= AWAY_GO && (n.hunger ?? 100) >= AWAY_GO;
}

/**
 * What a passage costs beyond the walk to the bay, in walking tiles of this crew member: the flight to the site. So a home job of the same
 * level and urgency nearby still wins (docs/DESIGN.md "Who goes").
 */
export function passageTiles(sim: Sim, crew: number, job: Job): number {
  if (job.kind !== 'passage') return 0;
  const v = sim.world.get(job.target ?? 0, VehicleC);
  const body = sim.world.get(job.target ?? 0, BodyC);
  const s = shipById(sim, job.site ?? 0);
  if (!v || !body || !s) return 0;
  const ticks = flightTicks(sim, v, Math.hypot(s.x + s.width / 2 - body.x, s.y + s.height / 2 - body.y));
  return Number.isFinite(ticks) ? Math.round((ticks / TICK_HZ) * walkSpeed(sim, crew)) : 0;
}
