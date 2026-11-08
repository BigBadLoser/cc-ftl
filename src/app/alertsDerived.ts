import { homeShip } from '../sim/index';
import { shipIdOf, shipGrid } from '../sim/regions';
import { AllegianceC, BreakdownC, CrewC, DeadC, DownedC, IonC, ModuleC, NeedsC, PickupC, PositionC, ShipC, roomTiles, type Sim } from '../sim';
import { roomHazards } from '../sim/systems/alerts';
import { BreakMemoryC } from '../sim/crew/breakTypes';
import { SuitC } from '../sim/eva/components';
import { airLeft } from '../sim/eva/airLedger';
import { suitAir, suitDef } from '../sim/eva/suit';
import { isHeldOffline } from '../sim/modules/hold';
import { AwayC, AwaySiteC, SiteRunC } from '../sim/away/components';
import { InspectionC, inspections } from '../sim/inspect/types';
import { EVA_AIR_LOW_FRAC, O2_ALERT_BELOW, O2_ALERT_CLEAR_ABOVE } from '../sim/tuning';
import type { UiAlert, UiAlertKind, UiSubject } from '../ui/api';
import { breakWhat } from './breakText';
import { crewSubject, enemyShip, roomOf, tileAt } from './subjects';

/** An alert whose condition holds in the sim right now, keyed as the event-born one is (so the two never double up). */
export interface Wanted { kind: UiAlertKind; key: string; text: string; subject: UiSubject | null; notice?: UiAlert['notice']; actions?: UiAlert['actions']; sticky?: true }

/** The kinds `deriveAlerts` covers: a dismissal of one of these stays quiet until its condition clears. */
export const DERIVED_KINDS: ReadonlySet<UiAlertKind> = new Set<UiAlertKind>([
  'fire.started', 'hull.breach', 'o2.low', 'power.shortage', 'crew.downed', 'suit.airLow', 'suit.airOut', 'crew.airUnreachable',
  'away.stranded', 'crew.break', 'crew.starving', 'combat.started', 'story.lead', 'inspect.waiting', 'inspect.blocked',
]);

/** Whether a live, switched-on consumer is unpowered: the power system's own allocation (per network; ion-disabled parts and parts held offline by work excluded). */
export function shortOnPower(sim: Sim, ship: number): boolean {
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || !m.enabled || m.hp <= 0 || m.powered || sim.world.has(id, IonC) || isHeldOffline(sim, m) || shipIdOf(sim, m) !== ship) continue;
    if ((sim.content.modules[m.def]?.power ?? 0) < 0) return true;
  }
  return false;
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
function powerBalance(sim: Sim, ship: number): { supply: number; demand: number } {
  let supply = 0;
  let demand = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || !m.enabled || m.hp <= 0 || sim.world.has(id, IonC) || isHeldOffline(sim, m) || shipIdOf(sim, m) !== ship) continue;
    const p = sim.content.modules[m.def]?.power ?? 0;
    if (p > 0) supply += p;
    else demand -= p;
  }
  return { supply, demand };
}

/**
 * Every urgent condition that holds in the sim now, by alert key. State, not events: a reload brings each back. `held` says which alert keys are
 * on screen, so a low-oxygen alert lasts until the room is above the clear line (the sim's own hysteresis) rather than flickering at the raise line.
 * Not covered, because the sim keeps no lasting state for them: `creatures.aboard` (a hatch is one event) and `boarders.stranded` (a failed recall).
 */
export function deriveAlerts(sim: Sim, held: (key: string) => boolean): Map<string, Wanted> {
  const out = new Map<string, Wanted>();
  const add = (w: Wanted) => { if (!out.has(w.key)) out.set(w.key, w); };
  const home = homeShip(sim);
  const name = (id: number) => sim.world.get(id, CrewC)?.name ?? 'Crew';
  const alive = (id: number) => !sim.world.has(id, DeadC);
  const player = (id: number) => sim.world.get(id, AllegianceC)?.faction === 'player';

  const grid = shipGrid(sim, home);
  if (grid?.has('room') && grid.has('fire') && grid.has('o2')) {
    const { breached, burning } = roomHazards(grid);
    for (const [room, i] of burning) {
      const x = i % grid.width;
      add({ kind: 'fire.started', key: `f${room}`, text: 'Fire', subject: tileAt(grid.x0 + x, grid.y0 + (i - x) / grid.width) });
    }
    for (const room of breached) add({ kind: 'hull.breach', key: `b${room}`, text: 'Hull breach', subject: roomOf(sim, home, room) });
    const o2 = grid.load('o2');
    for (const [room, tiles] of roomTiles(grid)) {
      let sum = 0;
      for (const i of tiles) sum += o2[i] as number;
      const avg = sum / tiles.length;
      if (avg < O2_ALERT_BELOW || (avg <= O2_ALERT_CLEAR_ABOVE && held(`o${room}`))) add({ kind: 'o2.low', key: `o${room}`, text: 'Low oxygen', subject: roomOf(sim, home, room) });
    }
  }
  if (shortOnPower(sim, home)) {
    const { supply, demand } = powerBalance(sim, home);
    add({ kind: 'power.shortage', key: 'p', text: `Low power: ${Math.round(supply)} of ${Math.round(demand)}`, subject: powerSubject(sim) });
  }
  for (const id of sim.world.query(DownedC)) {
    const d = sim.world.get(id, DownedC);
    if (!d || d.stabilized || !alive(id) || !sim.world.has(id, CrewC)) continue;
    if (!player(id) && shipIdOf(sim, sim.world.get(id, PositionC)) !== home) continue;
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
