import { CombatC, ShipC, type Faction } from '../combat/components';
import { liftShip } from '../sector/packet';
import { isLive } from '../trade/deals';
import { FTL_CHARGE_SEC } from '../tuning';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { ensureTrader } from '../trade/traders';
import { spawnContact } from '../galaxy/arrivals';
import { spawnSceneDerelict } from './derelicts';
import { startVisitClock, tendVisit, visiting } from './visit';
import { BoarderC } from '../vehicles/components';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { SceneShip, SceneSpec, Stance } from './types';

/**
 * Making a scene real in its pocket: its ships through the node-contact path (`spawnContact`: the generator, the deploy bounds, the gap rule), on the
 * side their stance gives, with the crew, stock and wallet the spec rolled; its timers start. The scene sets conditions only: what happens next is
 * the sim's. A ship may start damaged (`applyDamage`), come in late (`arriveAt`, retried by `tendScene` from then) or go for another scene ship (`prey`).
 */

/** The combat side a stance puts a ship on: hostile ones on their owner's side, the rest neutral. */
function sideOf(sim: Sim, owner: string, stance: Stance): Faction {
  return stance === 'hostile' ? sim.content.galaxy?.factions[owner]?.combatFaction ?? 'hostile' : 'neutral';
}

/** Spawn one scene ship (false: no room yet, retried by `tendScene`). Its trade stock and wallet are the scene's when it rolled them. */
function spawnSceneShip(sim: Sim, s: SceneShip): boolean {
  const opts = { side: sideOf(sim, s.contact.faction, s.stance), ...(s.crew !== undefined ? { crew: s.crew } : {}) };
  if (!spawnContact(sim, sim.galaxy.current, s.contact, opts) || s.contact.ship === undefined) return false;
  if (s.cargo || s.credits !== undefined || s.attitude !== undefined) {
    const t = ensureTrader(sim, s.contact.ship);
    if (t && s.attitude !== undefined) t.relation = s.attitude;
    if (t && s.cargo) t.stock = s.cargo.map((q) => ({ ...q }));
    if (t && s.credits !== undefined) t.credits = s.credits;
  }
  // A trap's boarding party is the size the scene says (the generator's doctrine may differ), armed with whatever the doctrine issues; it only goes when let in.
  const party = s.ambush ? sim.world.get(s.contact.ship, BoarderC) : undefined;
  if (party && s.ambush) {
    party.party = s.ambush.party;
    if (!s.ambush.trap) delete party.weapon; // an honest party comes unarmed
  }
  if (s.damage) applyDamage(sim, s, s.contact.ship);
  return true;
}

/**
 * What a scene ship suffered before the player came (`SceneShip.damage`): of its modules of each line's category or def, in id order, the first `count`
 * (absent: all) are left at the rolled share of their hp. A power source keeps 1 hp at least (none left at 0 is the ship-state system's wreck). The modules
 * hit are kept (the observer's `repaired`, a timer's `stopOn`).
 */
function applyDamage(sim: Sim, s: SceneShip, ship: number): void {
  const mods = sim.world.query(ModuleC).filter((m) => shipIdOf(sim, sim.world.get(m, ModuleC) as { x: number; y: number }) === ship).sort((a, b) => a - b);
  const damaged: number[] = [];
  const failing: number[] = [];
  for (const d of s.damage ?? []) {
    const hit = mods.filter((m) => {
      const def = sim.content.modules[sim.world.get(m, ModuleC)?.def ?? ''];
      return !!def && !damaged.includes(m) && (d.def ? sim.world.get(m, ModuleC)?.def === d.def : def.category === d.category);
    }).slice(0, d.count ?? Infinity);
    for (const id of hit) {
      const m = sim.world.get(id, ModuleC) as { def: string; hp: number };
      const def = sim.content.modules[m.def] as { maxHp: number; power: number };
      m.hp = Math.max(def.power > 0 ? 1 : 0, Math.round((def.maxHp * d.pct) / 100));
      if (m.hp < def.maxHp) (m as { outsideFix?: true }).outsideFix = true; // beyond its own crew: why it called for help
      damaged.push(id);
      if (d.failing) failing.push(id);
    }
  }
  s.damaged = damaged;
  if (failing.length) s.failing = failing;
}

/** Point a scene ship's guns at its prey (by tag) once both are real: the combat AI goes for it first while it is in play. */
function aimAtPrey(sim: Sim, spec: SceneSpec, s: SceneShip): void {
  const prey = s.prey ? spec.ships.find((o) => o.tag === s.prey)?.contact.ship : undefined;
  const combat = s.contact.ship === undefined ? undefined : sim.world.get(s.contact.ship, CombatC);
  const state = prey === undefined ? undefined : sim.world.get(prey, ShipC)?.state;
  if (combat && prey !== undefined && combat.prey === undefined && (state === 'active' || state === 'disabled')) combat.prey = prey;
}

/** A ship that comes in late is not in the pocket until its tick. */
const due = (sim: Sim, s: SceneShip): boolean => s.arriveAt === undefined || sim.tick >= s.arriveAt;

/** Open a scene in the (fresh) event grid: spawn its derelicts and ships and start its timers. */
export function openScene(sim: Sim, spec: SceneSpec): void {
  for (const d of spec.derelicts) if (d.ship === undefined) spawnSceneDerelict(sim, d);
  for (const s of spec.ships) {
    if (s.stay !== undefined) s.leaveAt = sim.tick + Math.round(s.stay * TICK_HZ);
    if (s.arriveAfter !== undefined) s.arriveAt = sim.tick + Math.round(s.arriveAfter * TICK_HZ);
    startVisitClock(sim, s);
    if (s.contact.ship === undefined && due(sim, s)) spawnSceneShip(sim, s);
  }
  for (const s of spec.ships) aimAtPrey(sim, spec, s);
  for (const t of spec.timers) t.at = sim.tick + Math.round(t.afterSec * TICK_HZ);
}

/**
 * Once a second: lift the scene's ships that jumped away (the observer has already seen them go; they are not respawned) and retry the ships and
 * derelicts that found no room. True when something changed.
 */
export function tendScene(sim: Sim, spec: SceneSpec): boolean {
  let changed = tendVisit(sim, spec);
  for (const d of spec.derelicts) if (d.ship === undefined && spawnSceneDerelict(sim, d)) changed = true;
  for (const s of spec.ships) {
    const id = s.contact.ship;
    if (id !== undefined && sim.world.get(id, ShipC)?.state === 'fled') {
      liftShip(sim, id);
      sim.trade.hails = sim.trade.hails.filter((h) => h.ship !== id);
      sim.trade.offers = sim.trade.offers.filter((o) => o.ship !== id);
      s.contact.ship = undefined;
      s.gone = 'fled';
      changed = true;
    } else if (id === undefined && !s.gone && due(sim, s) && spawnSceneShip(sim, s)) changed = true;
  }
  for (const s of spec.ships) aimAtPrey(sim, spec, s);
  return changed;
}

/**
 * A neutral scene ship moves on when its business here is done (`leaveAt`): like a scene director, it gives the ship a standing drive-charge order (the
 * ordinary helm job seats one of its crew), and once the drive is charged the ship jumps out through the ordinary `combat.flee`, as a fleeing NPC does. A helpless one cannot go (DESIGN.md "Distress freighter"); one that was hailed holds station; so does one in the middle of a deal. Hostile ones are the combat AI's.
 */
export function departScene(sim: Sim, spec: SceneSpec): void {
  for (const s of spec.ships) {
    const id = s.contact.ship;
    const ship = id === undefined ? undefined : sim.world.get(id, ShipC);
    if (id === undefined || !ship) continue;
    if (!s.hailed && !s.dismissed && sim.trade.hails.some((h) => h.ship === id && h.answered)) s.hailed = true;
    if (s.stance === 'helpless' || (s.hailed && !s.dismissed) || visiting(s.ambush) || s.leaveAt === undefined || sim.tick < s.leaveAt || ship.faction !== 'neutral' || ship.state !== 'active') continue;
    if (sim.trade.deals.some((d) => d.ship === id && isLive(d))) continue;
    const combat = sim.world.get(id, CombatC);
    if (!combat) continue;
    // Its own crew charge the drive as any crew does (a standing charge order seats a pilot at the helm), then it jumps.
    if (combat.ftl + 1e-9 >= FTL_CHARGE_SEC) sim.enqueue({ type: 'combat.flee', ship: id });
    else combat.ftlOrder ??= { jump: null };
  }
}
