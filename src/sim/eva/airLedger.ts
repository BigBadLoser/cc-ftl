import type { Sim } from '../sim';
import { AIR_RESERVE_SEC } from '../tuning';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { vehicleFaction } from '../vehicles/lifecycle';
import { AirlockC } from '../modules/airlock';
import { airlockAir, airValue, dockedAt, hasTank, vehicleAir } from './air';
import { AirHoldsC, SuitC, type AirHold } from './components';
import { suitAir, suitDef } from './suit';

/**
 * The air ledger (docs/ARCHITECTURE.md "Air module", #286). With `eva/sources.ts` (which sources a crew member can reach, and how long the
 * walk takes) it is the only place that answers the air questions, so admission, the air drive, the refill, the player's refill order and
 * the departure check cannot disagree:
 * - how much air a crew member has (`airLeft`) and whether a walk fits it with the reserve (`fitsReserve`);
 * - what a source can give (`sourceSupply`: an airlock's store, then a player shuttle docked there; a hovering shuttle's store), less what is
 *   set aside there for others, and whether it counts as a source at all (`canGive`);
 * - the refill itself (`drawAir`), which takes from that same supply;
 * - air set aside for later refills (`AirHoldsC`): each hold is owned by an entity (a site's shuttle while it is away) and names the crew
 *   member it is for. A refill by that crew member spends it; nobody else can draw it. Holds end with their owner (`releaseAirHolds`).
 */

/** A source of air: an airlock module, or a shuttle (hovering beside the grid). */
export interface SourceRef {
  kind: 'airlock' | 'vehicle';
  id: number;
}

/** Seconds of air in the crew member's tank, counting a Void-born wearer's longer tank. `fresh`: as if a fresh suit went on (a full tank). */
export function airLeft(sim: Sim, crew: number, fresh = false): number {
  return (fresh ? suitDef(sim).airSec : suitAir(sim, crew)) * airValue(sim, crew);
}

/** A full tank in the wearer's seconds. */
export function tankSec(sim: Sim, crew: number): number {
  return suitDef(sim).airSec * airValue(sim, crew);
}

/** True if `sec` seconds on the tank still leave AIR_RESERVE_SEC of `air`: the one reserve rule (admission, sources, the departure check). */
export function fitsReserve(sec: number, air: number): boolean {
  return sec + AIR_RESERVE_SEC <= air;
}

/** What the tank at `crew`'s back is short of, in suit seconds (0 for no suit). */
export function tankShortfall(sim: Sim, crew: number): number {
  return sim.world.has(crew, SuitC) ? Math.max(0, suitDef(sim).airSec - suitAir(sim, crew)) : 0;
}

/**
 * The player shuttle docked at this airlock that tops tanks up through it once the airlock's store runs dry, or undefined. `without` leaves
 * one shuttle out (the departure check: the shuttle about to leave gives nothing while it is away).
 */
export function dockedSupplier(sim: Sim, airlock: number, without = 0): Vehicle | undefined {
  const dock = dockedAt(sim, airlock);
  const v = dock && dock !== without ? sim.world.get(dock, VehicleC) : undefined;
  return v && vehicleFaction(sim, v) === 'player' ? v : undefined;
}

/** A hovering source shuttle: a player's, not the one left out. */
function sourceVehicle(sim: Sim, id: number, without: number): Vehicle | undefined {
  const v = id !== without ? sim.world.get(id, VehicleC) : undefined;
  return v && vehicleFaction(sim, v) === 'player' ? v : undefined;
}

/** All the air at the source, holds included. */
function rawSupply(sim: Sim, s: SourceRef, without: number): number {
  if (s.kind === 'airlock') {
    const v = dockedSupplier(sim, s.id, without);
    return airlockAir(sim, s.id) + (v ? vehicleAir(sim, v) : 0);
  }
  const v = sourceVehicle(sim, s.id, without);
  return v ? vehicleAir(sim, v) : 0;
}

/**
 * True if the source counts as one at all, for anyone: an airlock with air in its store, or with a player shuttle docked there holding a
 * full tank; a player shuttle holding a full tank (a shuttle with less is no longer a source). The walker-free half of `givesTo`, which
 * is what every per-walker question asks; this alone only picks the candidates a search starts from.
 */
export function canGive(sim: Sim, s: SourceRef, without = 0): boolean {
  if (s.kind === 'airlock') {
    const v = dockedSupplier(sim, s.id, without);
    return airlockAir(sim, s.id) > 0 || (!!v && hasTank(sim, vehicleAir(sim, v)));
  }
  const v = sourceVehicle(sim, s.id, without);
  return !!v && hasTank(sim, vehicleAir(sim, v));
}

/**
 * THE answer to "can this crew member get air at this source": it counts as a source (`canGive`) and, after what is held there for
 * others, has some left for them (`sourceSupply`). Reach (`airSources`, admission's `SourceReach`) asks it per walker; `drawAir` then
 * takes from that same supply. `without`: one shuttle left out (the departure check).
 */
export function givesTo(sim: Sim, s: SourceRef, crew: number, without = 0): boolean {
  return canGive(sim, s, without) && sourceSupply(sim, s, { without, for: crew }) > 0;
}

const same = (h: AirHold, s: SourceRef): boolean => h.kind === s.kind && h.id === s.id;

/** Every hold on the books, with its owner, ascending owner id. */
export function airHolds(sim: Sim): { owner: number; hold: AirHold }[] {
  const out: { owner: number; hold: AirHold }[] = [];
  for (const owner of [...sim.world.query(AirHoldsC)].sort((a, b) => a - b)) for (const hold of sim.world.get(owner, AirHoldsC)!.holds) out.push({ owner, hold });
  return out;
}

/** Air set aside at the source for crew other than `crew`, by owners other than `owner` (0: none left out). */
function heldForOthers(sim: Sim, s: SourceRef, crew: number, owner: number): number {
  let n = 0;
  for (const h of airHolds(sim)) if (h.owner !== owner && h.hold.crew !== crew && same(h.hold, s)) n += h.hold.sec;
  return n;
}

/**
 * Seconds of air the source can give: `rawSupply` less what is held there for others. `for`: the crew member asking (their own holds are
 * theirs to draw). `without`: one shuttle left out, its own holds as well (the departure check of that shuttle, which sets them anew).
 */
export function sourceSupply(sim: Sim, s: SourceRef, opts: { without?: number; for?: number } = {}): number {
  const without = opts.without ?? 0;
  return Math.max(0, rawSupply(sim, s, without) - heldForOthers(sim, s, opts.for ?? 0, without));
}

/**
 * Seconds of an airlock's own store free of every hold there: what a docked shuttle may top its store up from (`systems/airStores.ts`),
 * so a shuttle that then leaves never carries off air set aside for a crew member.
 */
export function freeAirlockStore(sim: Sim, airlock: number): number {
  return Math.max(0, airlockAir(sim, airlock) - heldForOthers(sim, { kind: 'airlock', id: airlock }, 0, 0));
}

/**
 * The refill: fill the crew member's tank at the source from what it can give them (`sourceSupply`): an airlock's store first, then a player
 * shuttle docked there; or a hovering shuttle's store (the tank swap at the hatch). Their own holds there are spent by what they take.
 * Returns the seconds put in. A suit that was made with no tank figure counts as full already.
 */
export function drawAir(sim: Sim, crew: number, s: SourceRef): number {
  const suit = sim.world.get(crew, SuitC);
  if (!suit || (s.kind === 'airlock' && !sim.world.has(s.id, AirlockC))) return 0;
  const want = Math.min(tankShortfall(sim, crew), sourceSupply(sim, s, { for: crew }));
  let given = 0;
  const take = (have: number, put: (left: number) => void): void => {
    const n = Math.min(want - given, have);
    if (n <= 0) return;
    put(have - n);
    given += n;
  };
  if (s.kind === 'airlock') {
    const a = sim.world.get(s.id, AirlockC)!;
    take(airlockAir(sim, s.id), (left) => (a.air = left));
  }
  const v = s.kind === 'airlock' ? dockedSupplier(sim, s.id) : sourceVehicle(sim, s.id, 0);
  if (v) take(vehicleAir(sim, v), (left) => (v.air = left));
  suit.air = suitAir(sim, crew) + given;
  spendHolds(sim, crew, s, given);
  return given;
}

/** What `crew` took at the source comes off their holds there. */
function spendHolds(sim: Sim, crew: number, s: SourceRef, sec: number): void {
  for (const { owner, hold } of airHolds(sim)) {
    if (sec <= 0) break;
    if (hold.crew !== crew || !same(hold, s)) continue;
    const n = Math.min(sec, hold.sec);
    hold.sec -= n;
    sec -= n;
    if (hold.sec <= 0) dropHold(sim, owner, hold);
  }
}

function dropHold(sim: Sim, owner: number, hold: AirHold): void {
  const h = sim.world.get(owner, AirHoldsC);
  if (!h) return;
  h.holds = h.holds.filter((x) => x !== hold);
  if (h.holds.length === 0) sim.world.remove(owner, AirHoldsC);
}

/** Put the owner's holds in place of any it had (none: released). */
export function setAirHolds(sim: Sim, owner: number, holds: AirHold[]): void {
  const kept = holds.filter((h) => h.sec > 0);
  if (kept.length === 0) sim.world.remove(owner, AirHoldsC);
  else sim.world.add(owner, AirHoldsC, { holds: kept });
}

/** Release holds: all of an owner's, or (with `keep`) those it rejects. The one way holds end, other than being spent. */
export function releaseAirHolds(sim: Sim, owner: number, keep: (h: AirHold) => boolean = () => false): void {
  const h = sim.world.get(owner, AirHoldsC);
  if (h) setAirHolds(sim, owner, h.holds.filter(keep));
}
