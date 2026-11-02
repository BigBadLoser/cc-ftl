import { BodyC } from '../body';
import { JobC, PositionC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { EvaFloatC } from '../eva/components';
import { suitAir, suitDef } from '../eva/suit';
import { ItemStackC } from '../items/components';
import { makeHaul } from '../items/plan';
import { destroyJob } from '../items/stacks';
import { refKey, reservations } from '../items/stock';
import { shipIdAt } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { DEFAULT_CARRY_CAPACITY, PLAN_INTERVAL } from '../tuning';
import { cargoCount, cargoSpace } from '../vehicles/cargo';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { cargoTile } from '../vehicles/geometry';
import type { SalvageTrip } from './components';
import { aboard, carryAboard, headBack, needsShuttleBack, reachesAirlock, REPEAT, tieSuits } from './teamCrew';

const sec = (n: number): number => n * TICK_HZ;
/** Seconds the pilot gets to float back aboard, the hold to be unloaded at home, and each leg of the flight. */
const CALL_SEC = 60;
const UNLOAD_SEC = 60;
const LEG_SEC = 240;
/** Team members below this share of a tank who cannot walk to an airlock on the wreck ride along on a cargo run instead of waiting. */
const RIDE_FRAC = 0.7;

/** Loose loot lying on the wreck (delivery crates of station jobs excepted), lowest id first. */
export function looseOn(sim: Sim, ship: number): number[] {
  return [...sim.world.query(ItemStackC)].filter((id) => {
    const st = sim.world.get(id, ItemStackC)!;
    return !st.job && shipIdAt(sim, st.x, st.y) === ship;
  }).sort((a, b) => a - b);
}

/** Haul jobs carrying loot to the shuttle's hold. */
export function haulsTo(sim: Sim, vehicle: number): number[] {
  return sim.world.query(JobC).filter((j) => {
    const d = sim.world.get(j, JobC)?.haul?.dst;
    return d?.kind === 'vehicle' && d.id === vehicle;
  });
}

/**
 * Plan the team's carrying: each loose stack on the wreck becomes an ordinary haul job to the hovering shuttle's hold, delivered at its
 * staging tile (`cargoTile`), as far as the hold has room after the hauls already under way. Returns the units still lying about that
 * found no room (a cargo run is due when this stays above 0 with no haul under way).
 */
export function planCarry(sim: Sim, vehicle: number, ship: number): number {
  const v = sim.world.get(vehicle, VehicleC) as Vehicle;
  const res = reservations(sim);
  let promised = 0;
  for (const [k, n] of res.incoming) if (k.startsWith(`vehicle:${vehicle}:`)) promised += n;
  let room = cargoSpace(sim, v) - promised;
  let left = 0;
  const plan = sim.tick % PLAN_INTERVAL === 0 && !!cargoTile(sim, vehicle);
  for (const sid of looseOn(sim, ship)) {
    const s = sim.world.get(sid, ItemStackC)!;
    const avail = s.count - (res.out.get(refKey('floor', sid, s.item)) ?? 0);
    if (avail <= 0) continue;
    const fit = Math.max(0, Math.min(avail, room));
    left += avail - fit;
    room -= fit;
    if (fit > 0 && plan) makeHaul(sim, res, 'hauling', ship, { ref: { kind: 'floor', id: sid }, x: s.x, y: s.y, avail }, { kind: 'vehicle', id: vehicle }, s.item, Math.min(fit, DEFAULT_CARRY_CAPACITY));
  }
  return left;
}

/** The team member to fly a cargo run: one already aboard, else the able one nearest the shuttle (lowest id on a tie). 0 for none. */
function pickPilot(sim: Sim, vehicle: number, t: SalvageTrip): number {
  const inside = t.crew.find((c) => aboard(sim, c, vehicle));
  if (inside) return inside;
  const body = sim.world.get(vehicle, BodyC);
  let best = 0;
  let bestD = Infinity;
  for (const c of [...t.crew].sort((a, b) => a - b)) {
    const p = sim.world.get(c, PositionC);
    if (!p || !body || isIncapacitated(sim, c) || sim.world.has(c, EvaFloatC)) continue;
    const d = Math.hypot(p.x + 0.5 - body.x, p.y + 0.5 - body.y);
    if (d < bestD) [best, bestD] = [c, d];
  }
  return best;
}

/** True when the hold is full and loot is still lying about: a team member flies it home to unload while the rest work on. */
export function runDue(sim: Sim, vehicle: number, ship: number, unplaced: number): boolean {
  return unplaced > 0 && haulsTo(sim, vehicle).length === 0 && cargoCount(sim.world.get(vehicle, VehicleC) as Vehicle) > 0 && looseOn(sim, ship).length > 0;
}

/** True if the team member's air would not last until a cargo run is back and they cannot walk to an airlock on the wreck: they ride along. */
const mustRide = (sim: Sim, crew: number, ship: number): boolean => suitAir(sim, crew) < suitDef(sim).airSec * RIDE_FRAC && !reachesAirlock(sim, crew, ship);

/** Start a cargo run: pick the pilot, and the members whose air would not last until it is back and who cannot walk to an airlock on the wreck. */
export function startRun(sim: Sim, vehicle: number, t: SalvageTrip): void {
  const pilot = pickPilot(sim, vehicle, t);
  if (!pilot) return;
  const riders = t.crew.filter((c) => c !== pilot && (aboard(sim, c, vehicle) || mustRide(sim, c, t.ship)));
  t.run = { pilot, riders, stage: 'call', timer: 0 };
  sim.events.emit({ type: 'salvage.cargoRun', ship: t.ship, vehicle, pilot, riders: [...riders] });
}

/** The crew a cargo run is calling back aboard (the pilot and the riders still on the team). */
export const runCrew = (t: SalvageTrip): number[] => (t.run ? [t.run.pilot, ...t.run.riders].filter((c) => t.crew.includes(c)) : []);

/**
 * One tick of a cargo run. 'call': the pilot and the riders float back aboard; once in (and nobody floating), the members staying out keep
 * their suits (they refill at an airlock on the wreck while the shuttle is away), the hauls to the hold are dropped (carriers set their loads
 * down) and the shuttle flies home. It never leaves a member behind who must ride: anyone who has run low meanwhile with no airlock to walk
 * to is called too, and riders who cannot get back in time (boxed in, downed) are picked up as at the end of a recall. 'unload': the
 * ship's crew empty the hold, then it flies back (the suits outside are tied to it again). `ending` is true when the shift is over and
 * nobody is out on the wreck: the run then ends at home with the shift. It turns back early, skipping the unload, when someone left on
 * the wreck is out of action or low on air. A hold that could not be unloaded at all (no room aboard)
 * ends the shift ('noRoom'): at home if everyone is aboard, else after flying back to recall the rest. Returns 'gone' if the run was
 * given up, 'home' when the shift should end at the bay, else 'on'.
 */
export function stepRun(sim: Sim, id: number, v: Vehicle, t: SalvageTrip, ending: () => boolean): 'on' | 'gone' | 'home' {
  const r = t.run!;
  r.timer++;
  const due = r.timer % REPEAT === 1;
  if ((r.stage === 'home' || r.stage === 'unload') && due && t.crew.some((c) => !aboard(sim, c, id) && needsShuttleBack(sim, c))) {
    // Someone left on the wreck is out of action or not managing to refill: cut the run short and fly back (the hold stays loaded).
    sim.enqueue({ type: 'vehicle.hover', vehicle: id, ship: t.ship });
    r.stage = 'back';
    r.timer = 0;
    return 'on';
  }
  switch (r.stage) {
    case 'call': {
      const back = runCrew(t);
      if (!t.crew.includes(r.pilot) || (r.timer > sec(CALL_SEC) && !aboard(sim, r.pilot, id))) {
        delete t.run;
        return 'gone';
      }
      for (const c of back) if (!aboard(sim, c, id)) headBack(sim, c, t.ship, id, due);
      const late = r.timer > sec(CALL_SEC);
      const waiting = back.some((c) => !aboard(sim, c, id)) && !late;
      const floating = sim.world.query(EvaFloatC).some((c) => sim.world.get(c, EvaFloatC)?.vehicle === id);
      if (!aboard(sim, r.pilot, id) || waiting || floating) return 'on';
      const more = t.crew.filter((c) => !aboard(sim, c, id) && !back.includes(c) && mustRide(sim, c, t.ship));
      r.riders.push(...more);
      if (more.length > 0 && !late) return 'on';
      for (const c of runCrew(t)) if (!aboard(sim, c, id)) carryAboard(sim, c, id);
      tieSuits(sim, t.crew.filter((c) => !aboard(sim, c, id)), id, false); // the shuttle may leave: the suits outside stay with their wearers
      for (const j of haulsTo(sim, id)) destroyJob(sim, j);
      sim.enqueue({ type: 'vehicle.return', vehicle: id });
      r.stage = 'home';
      r.timer = 0;
      return 'on';
    }
    case 'home':
      if (v.state === 'stowed') {
        r.stage = 'unload';
        r.timer = 0;
        r.held = cargoCount(v);
      } else if (r.timer > sec(LEG_SEC) || !v.home) return 'home';
      else if (due && v.dest?.type !== 'bay') sim.enqueue({ type: 'vehicle.return', vehicle: id });
      return 'on';
    case 'unload':
      if (cargoCount(v) > 0 && r.timer <= sec(UNLOAD_SEC)) return 'on';
      // Nothing came out: the ship has no room for it, so the shift ends. Anyone still out on the wreck is fetched first (the shuttle flies
      // back and the shift recalls them); with everyone aboard it ends here.
      if (cargoCount(v) >= (r.held ?? 0)) t.reason ??= 'noRoom';
      if (ending()) return 'home';
      sim.enqueue({ type: 'vehicle.hover', vehicle: id, ship: t.ship });
      r.stage = 'back';
      r.timer = 0;
      return 'on';
    case 'back':
      if (v.state === 'flying' && !v.dest && v.hover === t.ship) {
        tieSuits(sim, t.crew, id, true);
        delete t.run;
        return 'gone';
      }
      if (r.timer > sec(LEG_SEC)) return 'home'; // the trip keeps trying while anyone is still out on the wreck
      if (due && (v.dest?.type !== 'hover' || v.dest.ship !== t.ship)) sim.enqueue({ type: 'vehicle.hover', vehicle: id, ship: t.ship });
      return 'on';
  }
}
