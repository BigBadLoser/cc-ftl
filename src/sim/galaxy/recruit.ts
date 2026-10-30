import { setsOf, stationIdentity } from '../blackmarket/services';
import { abortTask } from '../ai/task';
import type { Sim } from '../sim';
import { SkillXpC, XP_PER_LEVEL } from '../story/components';
import { spawnNamedCrew } from '../combat/ships';
import { isIncapacitated } from '../crew/helpers';
import { CrewC, DeadC } from '../crew/components';
import { ShipC } from '../combat/components';
import { VehicleC } from '../vehicles/components';
import { ForHireC, StationCrewC } from '../stations/components';
import { planCourier } from '../trade/courier';
import { isLive, liveDealWith } from '../trade/deals';
import { TraderC, type Deal } from '../trade/types';
import { hash32, strHash, unit } from './hash';
import { portsAt } from './portIndex';
import type { Port } from './ports';
import { isHostileFaction, tierOf } from './standing';
import { nodeOf } from './state';
import { RECRUIT_BASE, RECRUIT_JITTER, RECRUIT_LOG_MAX, RECRUIT_PER_WORTH, RECRUIT_ROLES, RECRUIT_SLOTS, RECRUIT_TURNS } from './tuningRecruit';

/**
 * Crew for hire. A port whose structure lists the `recruit` service (trade stations) posts candidates, derived from hashes of (seed, port, window, slot) the way
 * job offers are (jobOffers.ts): nothing is stored until one is hired, then the key goes in `GalaxyState.recruitLog` so it does not come back in its window.
 * The candidates are real people: while the player is at the node, `syncRecruits` keeps one crew entity (`ForHireC`, station faction and roll) aboard
 * the port's station per candidate, and removes unhired ones whose window has passed. `crew.hire` opens a hiring run (a trade Deal with `crew`, see
 * trade/recruitLand.ts): the credits go into escrow, the player's shuttle docks at the station, the recruit walks aboard and is landed at home, where
 * they become player crew, the key goes into `recruitLog` and the escrow is paid. A failed run refunds. There is no crew cap beyond floor space.
 */
export interface Recruit {
  key: string;
  name: string;
  role: string;
  species: string;
  cost: number;
  /** A shady crew candidate (a black market's): the extra levels it has in every skill of its role. */
  shady?: number;
}

const SALT = 0x4e17;

/** Whether the port's structure lists the recruit service. */
function recruits(sim: Sim, port: Port): boolean {
  const s = nodeOf(sim, port.node)?.structures[Number(port.id.slice(port.id.indexOf('#') + 1))];
  return !!s && !!sim.content.galaxy?.structures[s.def]?.services?.includes('recruit');
}

/** The candidates of one port now: none from a faction hostile to the player. */
export function portRecruits(sim: Sim, port: Port): Recruit[] {
  if (!recruits(sim, port) || tierOf(sim, port.owner) === 'hostile') return [];
  const g = sim.galaxy;
  const window = Math.floor(g.turn / RECRUIT_TURNS);
  const names = sim.content.crewNames;
  const out: Recruit[] = [];
  for (let slot = 0; slot < RECRUIT_SLOTS; slot++) {
    const key = `${port.id}|${window}|${slot}`;
    if (g.recruitLog.includes(key)) continue;
    const h = (salt: number): number => unit(sim.seed, strHash(port.id), window, slot, SALT, salt);
    const pick = RECRUIT_ROLES.filter((r) => sim.content.roles[r.role])[Math.floor(h(1) * RECRUIT_ROLES.length)];
    const role = pick ? sim.content.roles[pick.role] : undefined;
    const species = sim.content.species[role?.species ?? 'species.human'];
    if (!pick || !species || !names.length) continue;
    out.push({
      key, role: pick.role, species: role?.species ?? 'species.human',
      name: species.designation ? `${species.designation}-${String(hash32(sim.seed, strHash(key), 1) % 1000).padStart(3, '0')}` : names[Math.floor(h(2) * names.length)] as string,
      cost: RECRUIT_BASE + RECRUIT_PER_WORTH * pick.worth + Math.floor(h(3) * (RECRUIT_JITTER + 1)),
    });
  }
  return out;
}

/**
 * The shady candidates of a station with black-market services: each set with shady crew posts `slots` of them per window, from its `roles`, with
 * `bonus` extra levels in every skill of the role, for `costMult` x the usual price + `extra`. A pure function like the port's candidates. Crew take no wages.
 */
export function shadyRecruits(sim: Sim, station: number, port: Port | undefined): Recruit[] {
  const t = sim.world.get(station, TraderC);
  if (!t?.services?.length || (t.owner && isHostileFaction(sim, t.owner))) return [];
  const g = sim.galaxy;
  const window = Math.floor(g.turn / RECRUIT_TURNS);
  const id = port?.id ?? `s${stationIdentity(sim.world.get(station, ShipC)?.gen?.seed, station)}`;
  const names = sim.content.crewNames;
  const out: Recruit[] = [];
  for (const [i, def] of setsOf(sim, t).entries()) {
    const shady = def.shadyCrew;
    if (!shady) continue;
    for (let slot = 0; slot < shady.slots; slot++) {
      const key = `shady|${id}|${i}|${window}|${slot}`;
      if (g.recruitLog.includes(key)) continue;
      const h = (salt: number): number => unit(sim.seed, strHash(id), window, slot, SALT ^ 0x5ad, salt);
      const roleId = shady.roles.filter((r) => sim.content.roles[r])[Math.floor(h(1) * shady.roles.length)];
      const role = roleId ? sim.content.roles[roleId] : undefined;
      const species = sim.content.species[role?.species ?? 'species.human'];
      if (!roleId || !species || !names.length) continue;
      const worth = RECRUIT_ROLES.find((r) => r.role === roleId)?.worth ?? 3;
      const usual = RECRUIT_BASE + RECRUIT_PER_WORTH * worth + Math.floor(h(3) * (RECRUIT_JITTER + 1));
      out.push({
        key, role: roleId, species: role?.species ?? 'species.human', shady: shady.bonus,
        name: species.designation ? `${species.designation}-${String(hash32(sim.seed, strHash(key), 1) % 1000).padStart(3, '0')}` : names[Math.floor(h(2) * names.length)] as string,
        cost: Math.round(usual * shady.costMult + shady.extra),
      });
    }
  }
  return out;
}

/** The candidates of every port at the player's node (derived; the people aboard the stations are `ForHireC` entities). */
export const recruitsHere = (sim: Sim): Recruit[] => portsAt(sim, sim.galaxy.current).flatMap((p) => portRecruits(sim, p));

const reject = (sim: Sim, reason: string): void => void sim.events.emit({ type: 'command.rejected', command: 'crew.hire', reason });

/** The for-hire person with this key aboard a station of this node, or 0. */
export function candidateEntity(sim: Sim, key: string): number {
  return sim.world.query(ForHireC).find((id) => sim.world.get(id, ForHireC)?.key === key) ?? 0;
}

/** The live hiring run that is fetching this person, if any. */
export const fetching = (sim: Sim, crew: number): Deal | undefined => sim.trade.deals.find((d) => isLive(d) && !!d.crew?.includes(crew));

/** Keep the people aboard the node's stations in step with the ports' candidates: spawn the missing, remove the unhired whose window passed. */
/** Note a candidate key as taken (hired, or dead): it is not offered again in its window. The log is capped. */
export function logRecruit(sim: Sim, key: string): void {
  const log = sim.galaxy.recruitLog;
  log.push(key);
  if (log.length > RECRUIT_LOG_MAX) log.splice(0, log.length - RECRUIT_LOG_MAX);
}

export function syncRecruits(sim: Sim): void {
  const g = sim.galaxy;
  if (!sim.content.galaxy || sim.sector.state !== 'active' || g.event || sim.sector.node !== g.current) return;
  const ports = portsAt(sim, g.current);
  if (!ports.length && !sim.world.query(TraderC).some((id) => sim.world.get(id, TraderC)?.services?.length)) return;
  const stations = new Map<number, Port | undefined>();
  for (const id of sim.world.query(TraderC)) {
    const t = sim.world.get(id, TraderC);
    const port = ports.find((p) => p.id === t?.port);
    // A station with a port posts the port's candidates; one with black-market services also posts its shady crew, port or not.
    if ((port || t?.services?.length) && sim.world.get(id, ShipC)?.immobile) stations.set(id, port);
  }
  // A candidate who died is no longer for hire (the body stays), and the slot stays empty for the rest of its window.
  for (const id of sim.world.query(ForHireC)) {
    const fh = sim.world.get(id, ForHireC);
    if (!fh || !sim.world.has(id, DeadC) || fetching(sim, id)) continue;
    sim.world.remove(id, ForHireC);
    logRecruit(sim, fh.key);
  }
  const here = new Map<number, Recruit[]>();
  for (const [id, port] of stations) here.set(id, [...(port ? portRecruits(sim, port) : []), ...shadyRecruits(sim, id, port)]);
  for (const id of sim.world.query(ForHireC)) {
    const fh = sim.world.get(id, ForHireC);
    if (!fh || fetching(sim, id)) continue;
    if (here.get(fh.station)?.some((r) => r.key === fh.key)) continue;
    abortTask(sim, id, 'removed');
    sim.world.destroyEntity(id);
  }
  for (const [station, list] of here) {
    for (const r of list) {
      if (candidateEntity(sim, r.key)) continue;
      const crew = spawnNamedCrew(sim, station, r.role, sim.content.species[r.species]?.designation ? undefined : r.name);
      if (!crew) continue;
      sim.world.add(crew, StationCrewC, { station });
      sim.world.add(crew, ForHireC, { key: r.key, cost: r.cost, station, ...(r.shady ? { shady: r.shady } : {}) });
      if (r.shady) {
        // Better skills: extra levels in every skill the role has, through the xp the stat resolver reads.
        const xp: Record<string, number> = {};
        for (const skill of Object.keys(sim.content.roles[r.role]?.skills ?? {})) xp[skill] = r.shady * XP_PER_LEVEL;
        sim.world.add(crew, SkillXpC, { xp });
      }
    }
  }
}

/**
 * `crew.hire`: open a hiring run for a candidate aboard a station of the player's node. The cost is held in escrow; the player's shuttle fetches
 * them. Rejected: `notHere`, `noCandidate`, `dealOpen` (the station has a run open), `cantAfford`, and the shuttle's own reasons
 * (`noShuttle`, `courierBusy`, `noAirlock`).
 */
export function hireCrew(sim: Sim, key: string): void {
  const g = sim.galaxy;
  if (sim.sector.state !== 'active' || g.event) return reject(sim, 'notHere');
  const id = candidateEntity(sim, key);
  const fh = id ? sim.world.get(id, ForHireC) : undefined;
  if (!fh || !sim.world.has(id, CrewC) || isIncapacitated(sim, id)) return reject(sim, 'noCandidate');
  if (liveDealWith(sim, fh.station)) return reject(sim, 'dealOpen');
  if (sim.trade.credits < fh.cost) return reject(sim, 'cantAfford');
  const plan = planCourier(sim, fh.station, [], [], true);
  if ('error' in plan) return reject(sim, plan.error === 'noCourier' ? 'noShuttle' : plan.error);
  sim.trade.credits -= fh.cost;
  const deal: Deal = {
    id: sim.trade.nextId++, ship: fh.station, give: [], get: [], barter: false, balance: fh.cost, held: fh.cost, courier: 'you', phase: 'dispatch',
    vehicle: plan.vehicle, airlock: plan.airlock, timer: 0, tick: sim.tick, crew: [id],
  };
  const v = sim.world.get(plan.vehicle, VehicleC);
  if (v) v.autopilot = true;
  sim.trade.deals.push(deal);
  sim.events.emit({ type: 'trade.dealMade', deal: deal.id, ship: deal.ship, courier: 'you', balance: deal.balance });
}
