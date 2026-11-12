import { isIdle } from '../sim/modules/draw';
import { homeShip, isOnOurSide, factionsHostile } from '../sim/index';
import { playerShipsPackedOk } from '../sim/story/world';
import { aiCores } from '../sim/robots/core';
import { HackedC } from '../sim/robots/components';
import { AlienC } from '../sim/aliens/components';
import { VehicleC } from '../sim/vehicles/components';
import { shipStoreCount } from '../sim/items/stock';
import { shipIdOf, shipGrid } from '../sim/regions';
import { AllegianceC, BreakdownC, CrewC, DeadC, DownedC, IonC, ModuleC, NeedsC, PickupC, PositionC, ShipC, roomTiles, type Sim } from '../sim';
import { roomHazards } from '../sim/systems/alerts';
import { BreakMemoryC } from '../sim/crew/breakTypes';
import { SuitC } from '../sim/eva/components';
import { airLeft } from '../sim/eva/airLedger';
import { suitAir, suitDef } from '../sim/eva/suit';
import { isHeldOffline } from '../sim/modules/hold';
import { fuelLow, hasFuel } from '../sim/modules/energy';
import { AwayC, AwaySiteC, SiteRunC } from '../sim/away/components';
import { InspectionC, inspections } from '../sim/inspect/types';
import { EVA_AIR_LOW_FRAC, O2_ALERT_BELOW, O2_ALERT_CLEAR_ABOVE } from '../sim/tuning';
import type { UiAlert, UiAlertKind, UiSubject } from '../ui/api';
import { breakWhat } from './breakText';
import { crewSubject, enemyShip, roomOf, shipSubject, tileAt } from './subjects';

/** An alert whose condition holds in the sim right now, keyed as the event-born one is (so the two never double up). */
export interface Wanted { kind: UiAlertKind; key: string; text: string; subject: UiSubject | null; notice?: UiAlert['notice']; actions?: UiAlert['actions']; sticky?: true }

/** The kinds `deriveAlerts` covers: a dismissal of one of these stays quiet until its condition clears. */
export const DERIVED_KINDS: ReadonlySet<UiAlertKind> = new Set<UiAlertKind>([
  'fire.started', 'hull.breach', 'o2.low', 'power.shortage', 'crew.downed', 'suit.airLow', 'suit.airOut', 'crew.airUnreachable',
  'away.stranded', 'crew.break', 'crew.starving', 'combat.started', 'story.lead', 'inspect.waiting', 'inspect.blocked',
  'ship.disabled', 'fuel.low', 'fuel.out', 'core.lost', 'creatures.aboard', 'boarders.stranded',
]);

/** Whether a live, switched-on consumer is unpowered: the power system's own allocation (per network; ion-disabled parts and parts held offline by work excluded). */
export function shortOnPower(sim: Sim, ship: number): boolean {
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || !m.enabled || m.hp <= 0 || m.powered || sim.world.has(id, IonC) || isHeldOffline(sim, m) || shipIdOf(sim, m) !== ship) continue;
    const def = sim.content.modules[m.def];
    if (def && def.power < 0 && !isIdle(sim, id, def)) return true; // an idle bed (nothing planted) is unpowered by design
  }
  return false;
}

/** The power alert's text: the power system's supply and demand, and the reason when a reactor is out of fuel (the cause crew can do something about). */
export function powerAlertText(sim: Sim, ship: number): string {
  const { supply, demand } = powerBalance(sim, ship);
  let dry = false;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && shipIdOf(sim, m) === ship ? sim.content.modules[m.def] : undefined;
    if (m && def?.fuel && m.enabled && m.hp > 0 && !hasFuel(m, def)) dry = true;
  }
  const base = `Low power: ${Math.round(supply)} of ${Math.round(demand)}`;
  return dry ? `${base}, a reactor is out of fuel` : base;
}

/** The jump target for a power alert: the first generator of the home ship. */
export function powerSubject(sim: Sim): UiSubject | null {
  const home = homeShip(sim);
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (m && (sim.content.modules[m.def]?.power ?? 0) > 0 && shipIdOf(sim, m) === home) return tileAt(m.x, m.y);
  }
  return null;
}

/** Supply and demand of the live parts on a ship, as the power system counts them (for the alert's text). */
export function powerBalance(sim: Sim, ship: number): { supply: number; demand: number } {
  let supply = 0;
  let demand = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || !m.enabled || m.hp <= 0 || sim.world.has(id, IonC) || isHeldOffline(sim, m) || shipIdOf(sim, m) !== ship) continue;
    const def = sim.content.modules[m.def];
    const p = def?.power ?? 0;
    if (def && isIdle(sim, id, def)) continue;
    if (p > 0) supply += !def || hasFuel(m, def) ? p : 0;
    else demand -= p;
  }
  return { supply, demand };
}

/** The alert key of a room hazard: the home ship keeps the short key (`f3`), another player ship's carries the ship, as room ids repeat across grids. */
export function hazardKey(sim: Sim, prefix: 'f' | 'b' | 'o', ship: number, room: number): string {
  return ship === homeShip(sim) ? `${prefix}${room}` : `${prefix}${ship}.${room}`;
}

/** Ships whose fire, breach and air alerts count: every ship the player owns (the home ship, prizes, captured hulls), not hostile ones. */
export const alertShips = (sim: Sim, ship: number): boolean => sim.world.get(ship, ShipC)?.faction === 'player';

/** The ship cannot act, and not because the whole crew is away on purpose (a party out on a site is no emergency). */
export function shipHelpless(sim: Sim, ship: number): boolean {
  if (sim.world.get(ship, ShipC)?.state !== 'disabled') return false;
  return !sim.world.query(AwayC, CrewC).some((c) => !sim.world.has(c, DeadC) && sim.world.get(c, AllegianceC)?.faction === 'player');
}

/** Reactor fuel on a ship: out (a reactor at 0, crew or not able to load more) or about to be (below the refill line with none in the stores). */
function addFuel(sim: Sim, ship: number, add: (w: Wanted) => void): void {
  let out: ModuleLike | null = null;
  let low: ModuleLike | null = null;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && m.enabled && m.hp > 0 && shipIdOf(sim, m) === ship ? sim.content.modules[m.def] : undefined;
    if (!m || !def?.fuel) continue;
    const stock = shipStoreCount(sim, ship, def.fuel.item);
    const item = sim.content.items[def.fuel.item]?.name ?? def.fuel.item;
    if (!hasFuel(m, def)) out ??= { m, item, stock };
    else if (fuelLow(m, def) && stock <= 0) low ??= { m, item, stock };
  }
  if (out) add({ kind: 'fuel.out', key: `fu${ship}`, text: `Reactor out of ${out.item.toLowerCase()}${out.stock > 0 ? ': crew must load more' : ': none in the stores'}`, subject: tileAt(out.m.x, out.m.y) });
  else if (low) add({ kind: 'fuel.low', key: `fu${ship}`, text: `Reactor ${low.item.toLowerCase()} running low: none in the stores`, subject: tileAt(low.m.x, low.m.y) });
}
interface ModuleLike { m: { x: number; y: number }; item: string; stock: number }

/** Live creatures (hatched aliens) on player ships, by ship. */
function aliensAboard(sim: Sim): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const id of sim.world.query(AlienC, CrewC, PositionC)) {
    if (sim.world.has(id, DeadC)) continue;
    const ship = shipIdOf(sim, sim.world.get(id, PositionC));
    if (!alertShips(sim, ship)) continue;
    out.set(ship, [...(out.get(ship) ?? []), id]);
  }
  return out;
}

/**
 * The player's crew standing on a hostile ship with no party to bring them home (not in an away party) and no shuttle of ours docked there:
 * boarders a recall could not take (the crew.recallFailed / recallStarted `left` cases), as state so a reload keeps it.
 */
function boardersLeft(sim: Sim): Map<number, number[]> {
  const out = new Map<number, number[]>();
  const docked = new Set<number>();
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC);
    if (v?.state === 'docked' && sim.world.get(v.homeShip, ShipC)?.faction === 'player') docked.add(shipIdOf(sim, sim.world.get(v.dock, ModuleC)));
  }
  for (const id of sim.world.query(CrewC, PositionC, AllegianceC)) {
    if (sim.world.has(id, DeadC) || sim.world.get(id, AllegianceC)?.faction !== 'player' || sim.world.has(id, AwayC)) continue;
    const ship = shipIdOf(sim, sim.world.get(id, PositionC));
    const host = sim.world.get(ship, ShipC);
    if (!host || host.state === 'wreck' || !factionsHostile('player', host.faction) || docked.has(ship)) continue;
    out.set(ship, [...(out.get(ship) ?? []), id]);
  }
  return out;
}

/**
 * Every urgent condition that holds in the sim now, by alert key. State, not events: a reload brings each back. `held` says which alert keys are
 * on screen, so a low-oxygen alert lasts until the room is above the clear line (the sim's own hysteresis) rather than flickering at the raise line.
 */
export function deriveAlerts(sim: Sim, held: (key: string) => boolean): Map<string, Wanted> {
  const out = new Map<string, Wanted>();
  const add = (w: Wanted) => { if (!out.has(w.key)) out.set(w.key, w); };
  const home = homeShip(sim);
  const name = (id: number) => sim.world.get(id, CrewC)?.name ?? 'Crew';
  const alive = (id: number) => !sim.world.has(id, DeadC);
  const player = (id: number) => sim.world.get(id, AllegianceC)?.faction === 'player';

  for (const ship of playerShipsPackedOk(sim)) {
    const grid = shipGrid(sim, ship);
    if (!grid?.has('room') || !grid.has('fire') || !grid.has('o2')) continue;
    const { breached, burning } = roomHazards(grid);
    for (const [room, i] of burning) {
      const x = i % grid.width;
      add({ kind: 'fire.started', key: hazardKey(sim, 'f', ship, room), text: 'Fire', subject: tileAt(grid.x0 + x, grid.y0 + (i - x) / grid.width) });
    }
    for (const room of breached) add({ kind: 'hull.breach', key: hazardKey(sim, 'b', ship, room), text: 'Hull breach', subject: roomOf(sim, ship, room) });
    const o2 = grid.load('o2');
    for (const [room, tiles] of roomTiles(grid)) {
      let sum = 0;
      for (const i of tiles) sum += o2[i] as number;
      const avg = sum / tiles.length;
      const key = hazardKey(sim, 'o', ship, room);
      if (avg < O2_ALERT_BELOW || (avg <= O2_ALERT_CLEAR_ABOVE && held(key))) add({ kind: 'o2.low', key, text: 'Low oxygen', subject: roomOf(sim, ship, room) });
    }
  }
  if (shortOnPower(sim, home)) {
    add({ kind: 'power.shortage', key: 'p', text: powerAlertText(sim, home), subject: powerSubject(sim) });
  }
  for (const id of sim.world.query(DownedC)) {
    const d = sim.world.get(id, DownedC);
    if (!d || d.stabilized || !alive(id) || !sim.world.has(id, CrewC)) continue;
    if (!isOnOurSide(sim, id)) continue; // a downed enemy boarder or prisoner is no alert
    add({ kind: 'crew.downed', key: `d${id}`, text: `Down: ${name(id)}`, subject: crewSubject(sim, id) });
  }
  const full = suitDef(sim).airSec;
  for (const id of sim.world.query(SuitC, CrewC)) {
    if (!alive(id) || !player(id)) continue;
    const air = suitAir(sim, id);
    if (air > full * EVA_AIR_LOW_FRAC) continue;
    const out0 = air <= 0;
    add({ kind: out0 ? 'suit.airOut' : 'suit.airLow', key: `sa${id}`, text: `${out0 ? 'Suit air out' : 'Suit air low'}: ${name(id)}`, subject: crewSubject(sim, id) });
  }
  for (const id of sim.world.query(PickupC, CrewC)) {
    if (!alive(id) || !player(id)) continue;
    const sec = Math.floor(airLeft(sim, id));
    add({ kind: 'crew.airUnreachable', key: `au${id}`, text: `No air in reach: ${name(id)} (${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} left)`, subject: crewSubject(sim, id) });
  }
  for (const site of sim.world.query(AwaySiteC)) {
    const s = sim.world.get(site, AwaySiteC);
    if (s?.block !== 'stranded') continue;
    const noHome = sim.world.get(s.vehicle, SiteRunC)?.phase === 'home'; // a shuttle on its way home with no way in; else its shuttle is lost
    const first = sim.world.query(AwayC).find((c) => alive(c) && sim.world.get(c, AwayC)?.site === site);
    add({ kind: 'away.stranded', key: `as${site}`, text: `${noHome ? 'Shuttle cannot get home' : 'Crew stranded'}: ${sim.world.get(site, ShipC)?.name ?? 'away site'}`, subject: first ? crewSubject(sim, first) : null });
  }
  for (const id of sim.world.query(BreakdownC, CrewC)) {
    const b = sim.world.get(id, BreakdownC);
    // The sim marks the break that earned an alert on the crew member's break memory (`alertAt` is the tick it began).
    if (!b || !alive(id) || !player(id) || sim.world.get(id, BreakMemoryC)?.alertAt !== b.since) continue;
    add({ kind: 'crew.break', key: `br${id}`, text: `${name(id)} ${breakWhat(b.kind, b.context)}`, subject: crewSubject(sim, id) });
  }
  for (const id of sim.world.query(NeedsC, CrewC)) {
    if (!alive(id) || !player(id) || (sim.world.get(id, NeedsC)?.hunger ?? 1) > 0) continue;
    add({ kind: 'crew.starving', key: `st${id}`, text: `Starving: ${name(id)}`, subject: crewSubject(sim, id) });
  }
  if (shipHelpless(sim, home)) add({ kind: 'ship.disabled', key: `sd${home}`, text: 'Ship disabled: no able crew or power', subject: shipSubject(sim, home) });
  addFuel(sim, home, add);
  for (const core of aiCores(sim, home)) {
    const hack = sim.world.get(core, HackedC);
    const m = sim.world.get(core, ModuleC);
    if (hack && hack.by !== 'player' && m) add({ kind: 'core.lost', key: `core${home}`, text: 'AI core hacked: robots shut down', subject: tileAt(m.x, m.y) });
  }
  for (const [ship, aliens] of aliensAboard(sim)) {
    add({ kind: 'creatures.aboard', key: `ca${ship}`, text: `Creatures aboard: ${sim.world.get(ship, ShipC)?.name ?? 'wreck'}`, subject: crewSubject(sim, aliens[0] as number) });
  }
  for (const [ship, left] of boardersLeft(sim)) {
    add({ kind: 'boarders.stranded', key: `rl${ship}`, text: `Left behind: ${left.map(name).join(', ')}`, subject: crewSubject(sim, left[0] as number) });
  }
  if (sim.sector.inCombat) {
    const s = enemyShip(sim, home);
    const n = s?.kind === 'ship' ? sim.world.get(s.id, ShipC)?.name : undefined;
    add({ kind: 'combat.started', key: 'cs', text: `Under attack${n ? `: ${n}` : ''}`, subject: s });
  }
  for (const n of sim.story.notices) {
    const def = sim.content.events?.[n.event];
    if (def?.lead && n.id > 0) add({ kind: 'story.lead', key: `ev${n.event}`, text: def.text, subject: null, notice: { id: n.id, lead: true, title: def.title } });
  }
  for (const id of inspections(sim)) {
    const insp = sim.world.get(id, InspectionC)!;
    const lead = insp.crew.find(alive);
    if (insp.phase === 'settle' && lead !== undefined) {
      const actions: UiAlert['actions'] = [
        { label: `Fine ${insp.fine ?? 0} ₵`, tone: 'good', command: { type: 'inspect.settle', inspection: id, choice: 'fine' } },
        ...(insp.bribeFailed ? [] : [{ label: `Bribe ${insp.bribe ?? 0} ₵`, tone: 'good' as const, command: { type: 'inspect.settle' as const, inspection: id, choice: 'bribe' as const } }]),
        { label: 'Refuse', tone: 'bad', command: { type: 'inspect.settle', inspection: id, choice: 'refuse' } },
      ];
      add({ kind: 'inspect.waiting', key: `iw${id}${insp.bribeFailed ? "b" : ""}`, text: 'Inspector waiting: fine or bribe', subject: crewSubject(sim, lead), actions, sticky: true });
    } else if (insp.blocked && insp.phase !== 'leave') {
      add({ kind: 'inspect.blocked', key: `ib${id}`, text: `Inspectors can't board: ${insp.name}`, subject: lead !== undefined ? crewSubject(sim, lead) : null });
    }
  }
  return out;
}
