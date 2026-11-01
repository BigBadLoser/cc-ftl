import { AirlockC, CombatC, portBlueprints, ModuleC, WeaponC, airlockWorking, nodeOf, portOf, shipIdOf, tierOf, type Port, type Sim } from '../sim';
import { StationAlarmC } from '../sim/stations/components';
import { portOffers } from '../sim/galaxy/jobOffers';
import { portRecruits } from '../sim/galaxy/recruit';
import type { UiBlueprint, UiStationInfo } from '../ui/api';
import { marketAt, pricesAt } from './marketSnapshot';
import { portHints } from './stockHints';
import { yardOf } from './yardSnapshot';

/** Plain names of the structure services worth telling a player about. */
const SERVICE: Record<string, string> = { trade: 'Trade', fuel: 'Fuel', repair: 'Repair', blueprints: 'Blueprints' };

/** Working guns and airlocks per ship, in one pass over the modules (the trade snapshot asks for every station at once). */
export function hardware(sim: Sim): Map<number, { guns: number; docks: number }> {
  const out = new Map<number, { guns: number; docks: number }>();
  for (const id of sim.world.query(ModuleC)) {
    const isGun = sim.world.has(id, WeaponC);
    const isDock = sim.world.has(id, AirlockC);
    if (!isGun && !isDock) continue;
    const m = sim.world.get(id, ModuleC);
    const ship = m && shipIdOf(sim, m);
    if (!m || !ship) continue;
    const h = out.get(ship) ?? { guns: 0, docks: 0 };
    if (isGun && m.hp > 0) h.guns++;
    if (isDock && airlockWorking(sim, id)) h.docks++;
    out.set(ship, h);
  }
  return out;
}

/** The services the port's structure lists, as display names. */
function servicesOf(sim: Sim, port: Port): string[] {
  const s = nodeOf(sim, port.node)?.structures[Number(port.id.slice(port.id.indexOf('#') + 1))];
  return (sim.content.galaxy?.structures[s?.def ?? '']?.services ?? []).flatMap((x) => SERVICE[x] ?? []);
}

/** What a blueprint's stats read as, against Mk I of the same line. */
function blurb(sim: Sim, def: string): string {
  const d = sim.content.modules[def];
  if (!d) return '';
  const parts: string[] = [];
  if (d.power > 0) parts.push(`+${d.power} power`);
  if (d.shieldGen) parts.push(`${Math.floor(Math.abs(d.power) * d.shieldGen.layersPerPower)} shield layers, 1 per ${d.shieldGen.rechargeSec} s`);
  if (d.engine) {
    parts.push(`${Math.round(Math.abs(d.power) * d.engine.evasionPerPower * 100)}% evasion`);
    if (d.engine.fuelFactor && d.engine.fuelFactor < 1) parts.push(`${Math.round((1 - d.engine.fuelFactor) * 100)}% less fuel per jump`);
  }
  return parts.join(', ');
}

function blueprintsOf(sim: Sim, port: Port): UiBlueprint[] {
  return portBlueprints(sim, port).map((o) => {
    const d = sim.content.modules[o.def];
    return { ...o, w: d?.footprint[0] ?? 1, h: d?.footprint[1] ?? 1, blurb: blurb(sim, o.def) };
  });
}

/** What the inspector shows for a station: owner and standing, services, market, docks and defences. Works without a port (debug spawns). */
export function stationInfo(sim: Sim, station: number, portId: string | undefined, hw: ReturnType<typeof hardware>): UiStationInfo {
  const port = portId ? portOf(sim, portId) : undefined;
  const h = hw.get(station);
  const alarm = sim.world.get(station, StationAlarmC);
  return {
    owner: port ? { name: sim.content.galaxy?.factions[port.owner]?.name ?? port.owner, tier: tierOf(sim, port.owner) } : null,
    services: port ? servicesOf(sim, port) : [],
    jobs: port ? portOffers(sim, port).length : 0,
    hire: port ? portRecruits(sim, port).length : 0,
    blueprints: port ? blueprintsOf(sim, port) : [], blueprintPort: port?.id ?? '',
    market: port?.trade ? marketAt(sim, port) : null,
    prices: port?.trade ? pricesAt(sim, port) : [],
    hints: port ? portHints(sim, port) : [],
    docks: h?.docks ?? 0, guns: h?.guns ?? 0, shields: sim.world.get(station, CombatC)?.shield.max ?? 0,
    alarm: alarm?.state === 'alarm' ? alarm.reason || 'alarm' : null,
    yard: yardOf(sim, station),
  };
}
