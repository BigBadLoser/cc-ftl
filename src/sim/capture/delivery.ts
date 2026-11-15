import { CrewC, JobC } from '../crew/components';
import { removeCrew } from '../crew/depart';
import { repKey } from '../galaxy/standing';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { StasisC } from '../stasis/components';
import { dropSlab } from '../stasis/freeze';
import { postSlabJob } from '../stasis/jobs';
import { stowWork } from '../stasis/ring';
import { scrapSealJob } from '../stasis/order';
import { slabPlace, wheelHatch } from '../stasis/query';
import { rackTile } from '../stasis/rack';
import { applyEffect } from '../story/effects';
import { playerShips } from '../story/world';
import { addCredits } from '../trade/credits';
import { isLive } from '../trade/deals';
import type { Deal } from '../trade/types';
import { PLAN_INTERVAL } from '../tuning';
import type { Vehicle } from '../vehicles/components';

/**
 * A prisoner's sealed slab handed over at a station (#116, DESIGN.md "Prisoners and prizes"): the goods side of a prisoner's handover run. The run
 * itself is the delivery handover (galaxy/handover.ts: the station's shuttle comes to the player's airlock, or the player's own shuttle takes the
 * slab over), with the slab in place of a crate:
 *  - loading: crew take the slab out of its wheel (or off the floor) and cart it into the shuttle's slab rack (a stasis job with `deliver`);
 *  - delivered: the slab reaches the station (the station's shuttle back at its station, or the player's shuttle beside it): the agreed credits are
 *    paid and the standing given, and the prisoner leaves with the slab (the station keeps it: the price covers it, as a crate goes with its goods);
 *  - called off (a fight, no dock, a cancel): the slab goes back on deck by the airlock for the crew to cart to a wheel; one aboard the player's
 *    shuttle out in space rides home with it and is set down by the bay (stasis/shuttle.ts). A slab lost with a shuttle is logged as such
 *    (`stasis.lost`), and a prisoner who thaws before the hand-over calls the run off.
 */

/** The live handover run of a prisoner, if any (one at a time). */
export const prisonerRun = (sim: Sim, prisoner: number): Deal | undefined =>
  sim.trade.deals.find((d) => d.handover?.prisoner?.crew === prisoner && isLive(d));

/** True while the run's prisoner is still sealed in the slab (not thawed, lost or gone). */
export const slabGoing = (sim: Sim, d: Deal): boolean => sim.world.has(d.handover?.prisoner?.crew ?? 0, StasisC);

/** True once the slab is in the run's shuttle. */
const inRack = (sim: Sim, prisoner: number, vehicle: number): boolean => {
  const s = sim.world.get(prisoner, StasisC);
  return s?.at === 'vehicle' && s.carrier === vehicle;
};

/** The stasis jobs on the prisoner's slab. */
const slabJobs = (sim: Sim, prisoner: number): number[] => sim.world.query(JobC).filter((id) => {
  const j = sim.world.get(id, JobC);
  return j?.kind === 'stasis' && j.target === prisoner;
});

/**
 * The slab is in the docked shuttle: true. Until then, every PLAN_INTERVAL, crew are sent for it while no other stasis job has it (one carting it to
 * a wheel finishes first): out of its wheel, or off the floor, then on the cart to the shuttle's rack.
 */
export function slabLoaded(sim: Sim, d: Deal, v: Vehicle): boolean {
  const prisoner = d.handover?.prisoner?.crew ?? 0;
  if (inRack(sim, prisoner, d.vehicle)) return true;
  if (sim.tick % PLAN_INTERVAL !== 0 || v.state !== 'docked' || slabJobs(sim, prisoner).length > 0) return false;
  const place = slabPlace(sim, prisoner);
  if (!place || !playerShips(sim).has(place.ship)) return false;
  if (place.kind === 'wheel') {
    const m = sim.world.get(place.wheel, ModuleC);
    if (m) postSlabJob(sim, wheelHatch(sim, m), prisoner, { phase: 'unstow', deliver: d.vehicle, wheel: place.wheel, turns: place.slot }, stowWork(place.slot, true));
  } else if (place.kind === 'floor') {
    const s = sim.world.get(prisoner, StasisC)!;
    postSlabJob(sim, s, prisoner, { phase: 'pickup', deliver: d.vehicle });
  }
  return false;
}

/**
 * The run is called off: its stasis jobs go (a slab on a cart is set down where its carrier stands, stasis/system.ts) and a slab already in the
 * shuttle comes out by the airlock while the shuttle is at a ship of the player's. Out in space it stays in the player's shuttle, which flies home
 * and sets it down by its bay.
 */
export function slabBack(sim: Sim, d: Deal): void {
  const prisoner = d.handover?.prisoner?.crew ?? 0;
  for (const id of slabJobs(sim, prisoner)) if (sim.world.get(id, JobC)?.stasis?.deliver) scrapSealJob(sim, id);
  if (!inRack(sim, prisoner, d.vehicle)) return;
  const t = rackTile(sim, d.vehicle);
  if (t && playerShips(sim).has(t.shipId)) dropSlab(sim, prisoner, t.shipId, t);
}

/**
 * The slab has reached the station: the agreed credits are paid, the standing moves (through the shared reputation effect, so the log names it) and
 * the prisoner leaves with the slab.
 */
export function slabDelivered(sim: Sim, d: Deal): void {
  const terms = d.handover?.prisoner;
  if (!terms) return;
  if (sim.world.has(terms.crew, CrewC)) {
    sim.world.remove(terms.crew, StasisC);
    removeCrew(sim, terms.crew);
  }
  addCredits(sim, terms.credits);
  applyEffect(sim, { type: 'reputation', faction: repKey(sim, terms.faction), delta: terms.standing }, { event: 'prisoner', actor: null });
  sim.events.emit({ type: 'prisoner.handedOver', crew: terms.crew, name: terms.name, station: d.ship, kind: terms.kind, credits: terms.credits, faction: terms.faction });
}
