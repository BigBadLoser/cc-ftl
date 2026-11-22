import { ShipC } from '../combat/components';
import { factionsHostile } from '../combat/factions';
import type { Sim } from '../sim';
import type { FleetRole } from './defs';
import { materialiseFleet } from './fleetShips';
import { nodesWithin } from './graph';
import { strHash, unit } from './hash';
import { huntPressure, huntRole } from './heat';
import { fleetName } from './names';
import { report } from './news';
import { portsAt } from './portIndex';
import { makeHunters } from './roster';
import { nodeOf } from './state';
import {
  HUNT_BUDGET_BASE, HUNT_BUDGET_MAX, HUNT_BUDGET_PER_PRESSURE, HUNT_COOLDOWN, HUNT_MAX_CHANCE, HUNT_PER_PRESSURE, HUNT_RANGE,
  HUNT_SHIPS_MAX, HUNT_SHIPS_PER, HUNT_TURNS, MAX_HUNTERS,
} from './tuningHeat';
import { PLAYER } from '../side';

/**
 * Hunters (see tuningHeat.ts): factions that want the player send fleets after them. Each turn every faction that is hostile to the player and has an
 * armed role is weighed in id order: its pressure (the grudge the player earned with it, and for the law the player's notoriety past WANTED_AT) gives a
 * chance; a faction that hits sends one hunter fleet from its nearest port within HUNT_RANGE jumps, sized by the pressure. The fleet chases the player
 * for HUNT_TURNS turns (agenda.ts `huntStep`) and interdicts them like a pirate (encounters.ts), then stands down and disbands at home (fleets.ts).
 * Every roll is a hash of (seed, faction, turn), so a run and a replay agree.
 */

const SALT = 0x4e7;
/** The faction's nearest port to the player that can field `role`, within HUNT_RANGE jumps. */
function nearestPort(sim: Sim, faction: string, role: FleetRole) {
  for (const node of nodesWithin(sim, sim.galaxy.current, HUNT_RANGE).keys()) {
    const port = portsAt(sim, node).find((p) => p.owner === faction && (p.role === null || p.role === role));
    if (port) return port;
  }
  return null;
}

/** The turn's dispatches. Called once per turn, after the fleets moved. */
export function dispatchHunters(sim: Sim, turn: number): void {
  const g = sim.galaxy;
  const content = sim.content.galaxy;
  if (!content || g.event) return;
  let active = g.fleets.filter((f) => f.hunt).length;
  for (const faction of Object.keys(content.factions).sort()) {
    if (active >= MAX_HUNTERS) return;
    const pressure = huntPressure(sim, faction);
    if (pressure <= 0) continue;
    if (turn - (g.heat.hunted[faction] ?? -Infinity) < HUNT_COOLDOWN || g.fleets.some((f) => f.hunt && f.faction === faction)) continue;
    if (unit(sim.seed, strHash(faction), turn, SALT) >= Math.min(HUNT_MAX_CHANCE, HUNT_PER_PRESSURE * pressure)) continue;
    const role = huntRole(sim, faction) as FleetRole;
    const port = nearestPort(sim, faction, role);
    if (!port) continue;
    const budget = Math.round(Math.min(HUNT_BUDGET_MAX, HUNT_BUDGET_BASE + HUNT_BUDGET_PER_PRESSURE * pressure));
    const ships = Math.min(HUNT_SHIPS_MAX, 1 + Math.floor(pressure / HUNT_SHIPS_PER));
    const depth = nodeOf(sim, g.current)?.danger ?? 0;
    const f = makeHunters(sim, port, faction, role, depth, [strHash(faction), turn, SALT], budget, ships, turn);
    if (!f) continue;
    f.hunt = { until: turn + HUNT_TURNS };
    g.fleets.push(f);
    g.heat.hunted[faction] = turn;
    active++;
    if (sim.sector.state === 'active' && f.node === g.current) materialiseFleet(sim, f);
    report(sim, { kind: 'hunt', node: port.node, who: fleetName(f), faction }, turn);
    sim.events.emit({ type: 'galaxy.hunt', fleet: f.id, faction, node: port.node, ships: f.ships.length });
  }
}

/**
 * The hunters in the player's node now: fleets still hunting them (not stood down) with ships in play that are hostile to the player, each with those
 * ships (lowest id first). They hunt because of the player's own standing or notoriety, so their turning up is an urgent alert (app alertsDerived.ts, #542).
 */
export function huntersHere(sim: Sim): { fleet: number; faction: string; ships: number[] }[] {
  const g = sim.galaxy;
  const out: { fleet: number; faction: string; ships: number[] }[] = [];
  for (const f of g.fleets) {
    if (!f.hunt || f.standDown || f.node !== g.current) continue;
    const ships = f.ships.map((c) => c.ship).filter((id): id is number => {
      const s = id === undefined ? undefined : sim.world.get(id, ShipC);
      return !!s && (s.state === 'active' || s.state === 'disabled') && factionsHostile(s.faction, PLAYER);
    }).sort((a, b) => a - b);
    if (ships.length) out.push({ fleet: f.id, faction: f.faction, ships });
  }
  return out;
}
