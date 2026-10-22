import { ShipC } from '../combat/components';
import { PositionC } from '../crew/components';
import { AllegianceC, FighterC } from '../fight/components';
import { isCombatReady } from '../fight/relations';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { StationAlarmC, StationCrewC, WantedC, type StationAlarm } from '../stations/components';
import { Struct } from '../structure';
import { TICK_HZ } from '../time';
import { isLive } from '../trade/deals';

/** Seconds with no intruder, attack, fire or breach before an alarm calms down. */
const CALM_AFTER_SEC = 30;
/** Ticks between hazard scans (fire, breach) of a station's tiles. */
const HAZARD_EVERY = 20;
/** Floor oxygen below this (kPa) counts as a breach. */
const BREACH_O2 = 5;

/**
 * Station alarms. Each tick, per station: intruders are crew of another faction aboard who are not invited (the player's
 * crew are invited while a trade run is docked there), plus anyone it already wants; invited crew who attack station
 * crew, and every player crew member aboard when the station is hit (its integrity drops: shots, the dormancy wake), become
 * wanted (WantedC, which fight/relations treats as hostile, so guards hunt them with the ordinary fight code and civilians
 * flee). Fires and breaches raise the alarm with nobody wanted. A dormant den wakes on intrusion. After CALM_AFTER_SEC
 * quiet the alarm calms and the station forgets its grudges.
 */
export function stationAlarmSystem(sim: Sim): void {
  // (Ships first: querying the alarm store would create it, and an empty store changes save bytes of station-less games.)
  const stations = sim.world.query(ShipC).filter((id) => sim.world.has(id, StationAlarmC));
  if (stations.length === 0) return;
  const aboard = new Map<number, number[]>();
  for (const id of sim.world.query(AllegianceC, PositionC)) {
    const g = shipIdOf(sim, sim.world.get(id, PositionC));
    const list = aboard.get(g);
    if (list) list.push(id);
    else aboard.set(g, [id]);
  }
  for (const st of stations) {
    const ship = sim.world.get(st, ShipC);
    const alarm = sim.world.get(st, StationAlarmC) as StationAlarm;
    if (!ship || (ship.state !== 'active' && ship.state !== 'disabled')) continue;
    const people = (aboard.get(st) ?? []).filter((c) => isCombatReady(sim, c));
    const invited = isLiveDock(sim, st);
    const reasons: string[] = [];
    const outsiders = people.filter((c) => sim.world.get(c, AllegianceC)?.faction !== ship.faction && !sim.world.has(c, StationCrewC));
    for (const c of outsiders) {
      const isInvited = invited && sim.world.get(c, AllegianceC)?.faction === 'player';
      const f = sim.world.get(c, FighterC);
      const attacking = !!f && f.mode === 'engage' && sim.world.get(f.target, StationCrewC)?.station === st;
      if (sim.world.get(c, WantedC)?.station === st || !isInvited || attacking) {
        if (!sim.world.has(c, WantedC)) sim.world.add(c, WantedC, { station: st });
        reasons.push(attacking ? 'attacked' : 'intruders');
      }
    }
    if (ship.integrity < alarm.integrity - 1e-4) {
      reasons.push('attacked');
      for (const c of outsiders) if (sim.world.get(c, AllegianceC)?.faction === 'player' && !sim.world.has(c, WantedC)) sim.world.add(c, WantedC, { station: st });
    }
    alarm.integrity = ship.integrity;
    if ((sim.tick + st) % HAZARD_EVERY === 0) {
      const h = hazard(sim, st);
      if (h) reasons.push(h);
    }
    if (reasons.length > 0) {
      const reason = reasons.includes('attacked') ? 'attacked' : (reasons[0] as string);
      if (alarm.state === 'calm') sim.events.emit({ type: 'station.alarm', ship: st, reason });
      alarm.state = 'alarm';
      alarm.reason = reason;
      alarm.quiet = 0;
      continue;
    }
    if (alarm.state === 'alarm' && ++alarm.quiet >= CALM_AFTER_SEC * TICK_HZ) {
      alarm.state = 'calm';
      alarm.reason = '';
      alarm.quiet = 0;
      for (const id of [...sim.world.query(WantedC)]) if (sim.world.get(id, WantedC)?.station === st) sim.world.remove(id, WantedC);
      sim.events.emit({ type: 'station.calm', ship: st });
    }
  }
}

/** True while a player trade run is docked at (or docking with) this station. */
function isLiveDock(sim: Sim, station: number): boolean {
  return sim.trade.deals.some((d) => d.ship === station && isLive(d) && d.via === 'dock' && (d.phase === 'dockStation' || d.phase === 'stationWork'));
}

/** 'fire' or 'breach' if a floor tile of the station burns or has lost its air, else ''. */
function hazard(sim: Sim, station: number): string {
  const g = shipGrid(sim, station);
  if (!g) return '';
  let breach = false;
  for (let y = g.y0; y < g.y0 + g.height; y++) {
    for (let x = g.x0; x < g.x0 + g.width; x++) {
      if (g.get('struct', x, y) !== Struct.Floor) continue;
      if (g.get('fire', x, y) > 0) return 'fire';
      if (g.get('o2', x, y) < BREACH_O2) breach = true;
    }
  }
  return breach ? 'breach' : '';
}
