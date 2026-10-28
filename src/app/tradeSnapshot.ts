import {
  CrewC, ForHireC, ShipC, TraderC, VehicleC, type Trader, hailVerdict, isSurplus, planCourier, playerItems, playerShip, profileFor, reputationWith, unitPrice, type Deal, type Sim,
} from '../sim';
import { fetching } from '../sim/galaxy/recruit';
import { contrabandRate, isContraband, setsOf, truceBanned, truceHolds } from '../sim';
import { isIncapacitated } from '../sim/crew/helpers';
import { hardware, stationInfo } from './stationInfo';
import type { UiMarketServices, UiRecruit, UiTrade, UiTradeDeal, UiTradePartner } from '../ui/api';

/** Short label of what a deal is doing now. */
const PHASE: Record<Deal['phase'], string> = {
  dispatch: 'Sending the shuttle', load: 'Loading the shuttle', out: 'Shuttle on its way over',
  dockStation: 'Docking at the station', stationWork: 'Station crew loading and unloading',
  exchange: 'Swapping cargo',
  back: 'Shuttle bringing it home', unload: 'Crew unloading the cargo', done: 'Settled', failed: 'Called off',
};

/** Phase labels of a hiring run. */
const HIRE_PHASE: Partial<Record<Deal['phase'], string>> = {
  dispatch: 'Launching the shuttle', out: 'Shuttle on its way to pick them up', dockStation: 'Shuttle docking at the station', stationWork: 'Recruit boarding the shuttle',
  back: 'Shuttle bringing them home', unload: 'Recruit stepping aboard',
};

const list = (sim: Sim, lines: readonly { item: string; count: number }[]): string =>
  lines.map((l) => `${l.count} ${sim.content.items[l.item]?.name ?? l.item}`).join(', ');

/** What stops a run in a direction, as a reject code, or '' if it can go. Probes with one unit of anything. */
function probe(sim: Sim, ship: number, dir: 'out' | 'in'): { courier: string; error: string; cap: number } {
  const unit = [{ item: Object.keys(sim.content.items)[0] ?? '', count: 1 }];
  const plan = planCourier(sim, ship, dir === 'out' ? unit : [], dir === 'in' ? unit : []);
  return 'error' in plan ? { courier: '', error: plan.error, cap: 0 } : { courier: plan.courier, error: '', cap: plan.cap };
}

/** The people for hire aboard a station: the role's skills strongest first, and whether the shuttle is already fetching them. */
function recruitsAt(sim: Sim, station: number): UiRecruit[] {
  const out: UiRecruit[] = [];
  for (const id of sim.world.query(ForHireC)) {
    const fh = sim.world.get(id, ForHireC);
    const crew = sim.world.get(id, CrewC);
    // Dead, downed or otherwise out of action: not hireable now (a dead one drops out for good at the next sync).
    if (!fh || !crew || fh.station !== station || isIncapacitated(sim, id)) continue;
    const role = sim.content.roles[crew.role];
    out.push({
      key: fh.key, name: crew.name, role: role?.name ?? crew.role, species: sim.content.species[crew.species]?.name ?? crew.species, cost: fh.cost,
      skills: Object.entries(role?.skills ?? {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v + (fh.shady ?? 0)}`), coming: !!fetching(sim, id),
      ...(fh.shady ? { shady: fh.shady } : {}),
    });
  }
  return out.sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** The black-market services of a trader, or undefined when it has none. */
function marketOf(sim: Sim, trader: Trader | undefined): UiMarketServices | undefined {
  const sets = trader ? setsOf(sim, trader) : [];
  if (!trader || !sets.length) return undefined;
  return {
    names: sets.map((d) => d.name), contrabandRate: contrabandRate(sim, trader) ?? 0, fence: trader.fence ?? null,
    truce: sets.some((d) => d.truce) && (truceHolds(sim) || truceBanned(sim)), banned: truceBanned(sim), shadyCrew: sets.some((d) => !!d.shadyCrew),
  };
}

/** What would stop a hiring run from this station now: the shuttle's reject code ('noShuttle', 'courierBusy', 'noAirlock'), or ''. */
function hireProbe(sim: Sim, ship: number): string {
  const plan = planCourier(sim, ship, [], [], true);
  return 'error' in plan ? (plan.error === 'noCourier' ? 'noShuttle' : plan.error) : '';
}

/** Plain-data trade state for the trade window and the credits readout. Reads the sim only (it never creates a trader). */
export function buildTrade(sim: Sim): UiTrade {
  const me = sim.world.get(playerShip(sim), ShipC);
  const partners: UiTradePartner[] = [];
  let hw: ReturnType<typeof hardware> | undefined;
  const candidates = [...sim.world.query(ShipC), ...sim.world.query(TraderC).filter((i) => !sim.world.has(i, ShipC))];
  for (const id of candidates) {
    const ship = sim.world.get(id, ShipC);
    if (ship && (ship.faction === 'player' || ship.outpost?.hidden || (ship.state !== 'active' && ship.state !== 'disabled'))) continue;
    const trader = sim.world.get(id, TraderC);
    const profile = trader?.profile ?? (ship ? profileFor(sim, ship) : null);
    const hail = sim.trade.hails.find((h) => h.ship === id);
    const answered = !!hail?.answered && !!trader && hailVerdict(sim, id).answers;
    const lines: UiTradePartner['lines'] = [];
    if (answered && trader) {
      for (const item of Object.keys(sim.content.items)) {
        const theirs = trader.stock.find((s) => s.item === item)?.count ?? 0;
        const mine = playerItems(sim, item);
        const sell = unitPrice(sim, id, item, 'sell');
        const buy = unitPrice(sim, id, item, 'buy');
        if (sell !== null && buy !== null && (theirs > 0 || mine > 0)) {
          lines.push({ item, name: sim.content.items[item]?.name ?? item, theirs, mine, sell, buy, ...(isSurplus(sim, trader.profile, item) ? { surplus: true } : {}), ...(isContraband(sim, item) ? { contraband: true } : {}) });
        }
      }
    }
    const offer = sim.trade.offers.find((o) => o.ship === id);
    partners.push({
      id, name: trader?.name ?? ship?.name ?? 'Station', kind: ship ? 'ship' : 'station', station: !!trader?.station,
      role: profile ? (sim.content.trade?.traders[profile]?.name ?? '') : '', trades: profile !== null,
      hail: !hail ? 'none' : hail.answered && answered ? 'answered' : 'refused', reason: hail && !answered ? (hail.reason || 'hostile') : '',
      wallet: trader?.credits ?? 0, rep: trader ? reputationWith(sim, id) : 0, lines,
      out: answered ? probe(sim, id, 'out') : { courier: '', error: '', cap: 0 }, in: answered ? probe(sim, id, 'in') : { courier: '', error: '', cap: 0 },
      offer: offer ? { id: offer.id, give: offer.give, get: offer.get, barter: offer.barter, balance: offer.balance } : null,
      recruits: trader?.station ? recruitsAt(sim, id) : [],
      hireError: trader?.station ? hireProbe(sim, id) : '',
      ...(marketOf(sim, trader) ? { market: marketOf(sim, trader) } : {}),
      ...(trader?.station ? { info: stationInfo(sim, id, trader.port, (hw ??= hardware(sim))) } : {}),
      distance: ship && me ? Math.round(Math.hypot(ship.x - me.x, ship.y - me.y)) : 0,
    });
  }
  partners.sort((a, b) => a.distance - b.distance || a.id - b.id);
  const deals: UiTradeDeal[] = sim.trade.deals.filter((d) => !d.handover).map((d) => ({
    id: d.id, ship: d.ship, partner: sim.world.get(d.ship, TraderC)?.name ?? 'Trader', phase: d.phase, status: d.phase === 'failed' ? `Called off${d.trip ? ` in trip ${d.trip.n} of ${d.trip.of}` : ''}: ${d.reason ?? ''}`
      : d.crew ? HIRE_PHASE[d.phase] ?? PHASE[d.phase] : d.phase === 'exchange' && d.via === 'hover' ? 'Swapping cargo from a hover (no station airlock free)' : PHASE[d.phase],
    trip: d.trip ? { n: d.trip.n, of: d.trip.of, stopped: d.trip.stopped ?? '' } : null,
    courier: d.courier, give: list(sim, d.give), get: list(sim, d.get), balance: d.barter ? 0 : d.balance, barter: d.barter, vehicle: d.vehicle,
    live: d.phase !== 'done' && d.phase !== 'failed', cancellable: d.phase === 'dispatch' || d.phase === 'load' || (!!d.crew && (d.phase === 'out' || d.phase === 'dockStation' || d.phase === 'stationWork')),
    flying: d.vehicle !== 0 && sim.world.get(d.vehicle, VehicleC)?.state === 'flying',
  }));
  return { credits: sim.trade.credits, partners, deals };
}
