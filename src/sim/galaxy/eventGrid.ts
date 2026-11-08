import { holdDeparture, loseStrandedDrones } from '../drones/recall';
import { settleLosses } from './jobs';
import { CombatC, ShipC } from '../combat/components';
import { refreshCruise } from '../combat/cruise';
import { factionsHostile } from '../combat/factions';
import { liftShip } from '../sector/packet';
import { newSectorGrid } from '../stamp';
import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import { isLive } from '../trade/deals';
import { FTL_CHARGE_SEC, SECTOR_HEIGHT, SECTOR_WIDTH } from '../tuning';
import { playerShipInfo } from './arrivals';
import { ftlCharge, spendCharge } from './fuel';
import { materialiseFleet, reap, strandIfCrippled, tendFleet } from './fleetShips';
import { repKey } from './standing';
import { RESCUE_REPUTATION } from './tuning';
import type { Encounter, EventGrid, Fleet } from './types';
import { CrewC, DeadC, PositionC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import { VehicleC } from '../vehicles/components';
import { vehicleFaction } from '../vehicles/lifecycle';
import { observeLeave, observeScene } from '../scene/observer';
import { settleVisits } from '../scene/visit';
import { departScene, openScene, tendScene } from '../scene/open';
import type { SceneSpec } from '../scene/types';

/**
 * Event grids: a temporary deep-space pocket (node id `event:<id>`) where an encounter is settled, with the player's packet and what its scene
 * holds (scene/types.ts `SceneSpec`): a fleet's ships (an interdiction, a distress call) or a story encounter's (a trader skiff). It is not a real node: not in the galaxy index, no chunk contents, no contacts, no story draw, no arrivals, no turns,
 * and it is never archived. `GalaxyState.current` stays the real node the trip is halted at, `sim.sector.node` is the event id and the
 * trip waits (`Travel.phase === 'event'`). Leaving it discards the sector and puts the ship back in hyperspace.
 * Planner's calls: the fleet is taken out of `GalaxyState.fleets` while the grid exists (nothing steps or materialises it); survivors go back
 * as descriptors (damage does not carry over), a fleet with no ship left is gone. Leaving waits for the player's crew and shuttles to be back aboard.
 */
export const eventNodeId = (id: number): string => `event:${id}`;
export const isEventNode = (node: string): boolean => node.startsWith('event:');
export const inEvent = (sim: Sim): boolean => sim.galaxy.event !== null;

/** Hostile (to the player) ships still in play in the sector. */
export const hostilesPresent = (sim: Sim): number =>
  sim.world.query(ShipC).filter((id) => {
    const s = sim.world.get(id, ShipC);
    return !!s && s.state === 'active' && factionsHostile(s.faction, 'player');
  }).length;

/**
 * Open the event grid for a scene: the player's packet (waiting in hyperspace) is put up for deployment in an empty sector, the scene's ships are
 * made real there (a fleet's through `materialiseFleet`, hostile ones on their combat side, others neutral; a story scene's by `openScene`) and the
 * trip is held. A fleet encounter passes its `encounter` (whose id the grid takes). False when the fleet is gone or a grid is already open.
 */
export function enterEvent(sim: Sim, kind: EventGrid['kind'], scene: SceneSpec, encounter?: Encounter): boolean {
  const g = sim.galaxy;
  const t = g.travel;
  const f = scene.fleet ? g.fleets.find((x) => x.id === scene.fleet?.id) : undefined;
  if (!t || (scene.fleet && !f) || sim.sector.state !== 'hyperspace' || g.event) return false;
  if (f) g.fleets = g.fleets.filter((x) => x !== f);
  const id = encounter?.id ?? g.nextFleet++;
  g.event = { id, kind, scene, watch: { fired: [] }, fled: [], ...(encounter ? { encounter: { ...encounter } } : {}), ...(f ? { fleet: f } : {}) };
  // A story decision keeps the phase it held (a scene drawn at the hop's end resumes the trip after it); an open grid's trip goes on with the hop.
  t.held = t.phase === 'story' ? t.held ?? 'hop' : t.phase === 'event' ? 'hop' : t.phase;
  t.phase = 'event';
  const from = sim.sector.node;
  sim.sector.node = eventNodeId(id);
  sim.sector.grid = newSectorGrid();
  sim.sector.width = SECTOR_WIDTH;
  sim.sector.height = SECTOR_HEIGHT;
  sim.sector.state = 'deploying';
  if (f) {
    for (const c of f.ships) c.ship = undefined;
    materialiseFleet(sim, f, g.current);
  }
  openScene(sim, scene);
  g.rev++;
  sim.events.emit({ type: 'sector.jumped', ship: sim.sector.packet?.ship ?? 0, from, to: sim.sector.node, restored: false });
  sim.events.emit({ type: 'galaxy.eventEntered', id, kind });
  return true;
}

/**
 * True while a player crew member is off the ship that leaves (aboard another ship, a captured prize included, or out on EVA) or a player shuttle is out
 * (flying, or docked anywhere but that ship): leaving lifts only that ship and what stands or docks on it (`leaveEvent`), the rest is gone.
 */
export function crewAway(sim: Sim): boolean {
  const home = playerShipInfo(sim)?.id;
  const mine = (ship: number): boolean => ship === home;
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC);
    if (!v || vehicleFaction(sim, v) !== 'player') continue;
    // Stowed in a bay: a shuttle in another ship's bay (a prize's) stays with that ship, like the prize itself; only player crew sitting in it
    // (embarked crew have no position) would be left behind.
    if (v.state === 'stowed') {
      const aboard = [v.pilot, ...v.passengers].some((c) => c !== 0 && sim.world.get(c, AllegianceC)?.faction === 'player');
      if (!mine(v.homeShip) && aboard) return true;
      continue;
    }
    const dock = v.state === 'docked' ? sim.world.get(v.dock, ModuleC) : undefined;
    if (!dock || !mine(shipIdOf(sim, dock))) return true;
  }
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (sim.world.has(id, DeadC) || sim.world.get(id, AllegianceC)?.faction !== 'player') continue;
    if (!mine(shipIdOf(sim, sim.world.get(id, PositionC) as { x: number; y: number }))) return true;
  }
  return false;
}

/**
 * Why the player cannot leave the event grid now, or null: a live deal, crew or a shuttle still away (DESIGN.md "Physical encounters": leaving is blocked
 * until they are back), or hostiles about with the drive not charged (leaving under fire is a flee).
 */
export function leaveBlocker(sim: Sim): string | null {
  if (!sim.galaxy.event) return 'noEvent';
  if (sim.sector.state === 'deploying') return null;
  if (sim.trade.deals.some(isLive)) return 'tradeInProgress';
  if (crewAway(sim)) return 'crewAway';
  const me = playerShipInfo(sim);
  if (!me) return 'notPlayerShip';
  if (hostilesPresent(sim) > 0 && (ftlCharge(sim, me.id) ?? 0) + 1e-9 < FTL_CHARGE_SEC) return 'notCharged';
  return null;
}

/**
 * What is left of the fleet: ships still in play, escaped (fled) or never spawned go back as descriptors; wrecked and taken ones are gone and their
 * home port owes a replacement each. A ship left crippled strands the fleet (a distress call), unless it was a rescue.
 */
function settleFleet(sim: Sim, ev: EventGrid, f: Fleet): Fleet {
  f.ships.push(...reap(sim, f).fled, ...ev.fled);
  strandIfCrippled(sim, f, sim.galaxy.turn);
  for (const c of f.ships) c.ship = undefined;
  f.met = sim.galaxy.turn;
  if (ev.kind === 'rescue' && f.ships.length) {
    delete f.damaged;
    f.dwell = 1;
    const key = repKey(sim, f.faction);
    sim.story.reputation[key] = reputationOf(sim.story, key) + RESCUE_REPUTATION;
    sim.events.emit({ type: 'galaxy.rescued', id: ev.id, faction: f.faction });
  }
  return f;
}

/**
 * Leave the event grid: the player's ship is lifted back into a packet (hostiles about need a charged drive, which is spent: that is a flee),
 * the sector is wiped (every entity gone, a fresh grid; nothing archived), the fleet's survivors return to the map and the trip carries
 * on from where it was held. `resume` continues an interdicted trip (see hyperspace.ts `resumeAfterHop`). False when it is refused.
 */
export function leaveEvent(sim: Sim, resume: (sim: Sim, held: 'interdicted' | 'hopEnd') => void, command = 'galaxy.leaveEvent'): boolean {
  const g = sim.galaxy;
  const ev = g.event;
  const t = g.travel;
  const reject = (reason: string): false => (sim.events.emit({ type: 'command.rejected', command, reason }), false);
  if (!ev || !t) return reject('noEvent');
  const blocked = leaveBlocker(sim);
  if (blocked) return reject(blocked);
  const mine = sim.sector.state === 'active' ? playerShipInfo(sim)?.id : undefined;
  // Drones out in space: the ship waits a moment for them (drones/recall.ts).
  if (mine && holdDeparture(sim, mine, { kind: 'leave', command })) return true;
  if (mine) loseStrandedDrones(sim, mine);
  let packet = sim.sector.packet;
  // Kills in the grid count before its ships are gone, and the observer has its last look.
  settleLosses(sim);
  settleVisits(sim, ev.scene); // a visit in progress is settled, never a reason to stay
  observeLeave(sim, ev);
  if (sim.sector.state === 'active') {
    const me = playerShipInfo(sim) as NonNullable<ReturnType<typeof playerShipInfo>>;
    if (hostilesPresent(sim) > 0) spendCharge(sim, FTL_CHARGE_SEC, me.id);
    const combat = sim.world.get(me.id, CombatC);
    if (combat) refreshCruise(sim, me.id, combat); // fresh evade figures for the trip on (#367)
    packet = liftShip(sim, me.id, { withDocked: false });
  }
  const hostile = hostilesPresent(sim) > 0;
  const fleet = ev.fleet ? settleFleet(sim, ev, ev.fleet) : null;
  // The outcome line moves on from "fighting" / "answering": cleared, escaped or helped.
  if (fleet && g.lastResult?.id === ev.id) g.lastResult.outcome = ev.kind === 'rescue' ? 'helped' : hostile ? 'escaped' : fleet.ships.length ? 'left' : 'cleared';
  if (sim.sector.inCombat) sim.events.emit({ type: 'combat.ended' });
  for (const id of sim.world.ids()) sim.world.destroyEntity(id);
  sim.sector.grid = newSectorGrid();
  sim.sector.inCombat = false;
  sim.trade.hails = [];
  sim.trade.offers = [];
  sim.sector.node = g.current;
  sim.sector.state = 'hyperspace';
  if (packet) sim.sector.packet = packet;
  g.event = null;
  if (fleet?.ships.length) g.fleets = [...g.fleets, fleet].sort((a, b) => a.id - b.id);
  const held = t.held ?? 'hop';
  delete t.held;
  t.phase = held === 'hopEnd' ? 'hop' : held;
  g.rev++;
  sim.events.emit({ type: 'galaxy.eventLeft', id: ev.id, node: g.current });
  if (held === 'interdicted' || held === 'hopEnd') resume(sim, held);
  return true;
}

/** Once a second in the event grid: the observer looks first (while fled and wrecked ships still have their entities), then the fleet's ships that are gone are forgotten and the ships that had no room retried. */
export function tendEvent(sim: Sim): void {
  const ev = sim.galaxy.event;
  if (!ev) return;
  observeScene(sim, ev);
  if (ev.fleet && tendFleet(sim, ev.fleet, sim.galaxy.current, ev.fled)) sim.galaxy.rev++;
  if (tendScene(sim, ev.scene)) sim.galaxy.rev++;
  departScene(sim, ev.scene);
}
