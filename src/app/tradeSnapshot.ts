import {
  ShipC, TraderC, VehicleC, courierDef, hailVerdict, isSurplus, planCourier, playerItems, playerShip, profileFor, reputationWith, unitPrice, type Deal, type Sim,
} from '../sim';
import type { UiTrade, UiTradeDeal, UiTradePartner } from '../ui/api';

/** Short label of what a deal is doing now. */
const PHASE: Record<Deal['phase'], string> = {
  dispatch: 'Sending the shuttle', load: 'Loading the shuttle', out: 'Shuttle on its way over',
  dockStation: 'Docking at the station', stationWork: 'Station crew loading and unloading',
  exchange: 'Swapping cargo',
  back: 'Shuttle bringing it home', unload: 'Crew unloading the cargo', done: 'Settled', failed: 'Called off',
};

const list = (sim: Sim, lines: readonly { item: string; count: number }[]): string =>
  lines.map((l) => `${l.count} ${sim.content.items[l.item]?.name ?? l.item}`).join(', ');

/** What stops a run in a direction, as a reject code, or '' if it can go. Probes with one unit of anything. */
function probe(sim: Sim, ship: number, dir: 'out' | 'in'): { courier: string; error: string } {
  const unit = [{ item: Object.keys(sim.content.items)[0] ?? '', count: 1 }];
  const plan = planCourier(sim, ship, dir === 'out' ? unit : [], dir === 'in' ? unit : []);
  return 'error' in plan ? { courier: '', error: plan.error } : { courier: plan.courier, error: '' };
}

/** Plain-data trade state for the trade window and the credits readout. Reads the sim only (it never creates a trader). */
export function buildTrade(sim: Sim): UiTrade {
  const me = sim.world.get(playerShip(sim), ShipC);
  const partners: UiTradePartner[] = [];
  const candidates = [...sim.world.query(ShipC), ...sim.world.query(TraderC).filter((i) => !sim.world.has(i, ShipC))];
  for (const id of candidates) {
    const ship = sim.world.get(id, ShipC);
    if (ship && (ship.faction === 'player' || (ship.state !== 'active' && ship.state !== 'disabled'))) continue;
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
          lines.push({ item, name: sim.content.items[item]?.name ?? item, theirs, mine, sell, buy, ...(isSurplus(sim, trader.profile, item) ? { surplus: true } : {}) });
        }
      }
    }
    const offer = sim.trade.offers.find((o) => o.ship === id);
    partners.push({
      id, name: trader?.name ?? ship?.name ?? 'Station', kind: ship ? 'ship' : 'station',
      role: profile ? (sim.content.trade?.traders[profile]?.name ?? '') : '', trades: profile !== null,
      hail: !hail ? 'none' : hail.answered && answered ? 'answered' : 'refused', reason: hail && !answered ? (hail.reason || 'hostile') : '',
      wallet: trader?.credits ?? 0, rep: trader ? reputationWith(sim, id) : 0, lines,
      out: answered ? probe(sim, id, 'out') : { courier: '', error: '' }, in: answered ? probe(sim, id, 'in') : { courier: '', error: '' },
      holdCap: courierDef(sim)?.def.cargo ?? 0,
      offer: offer ? { id: offer.id, give: offer.give, get: offer.get, barter: offer.barter, balance: offer.balance } : null,
      distance: ship && me ? Math.round(Math.hypot(ship.x - me.x, ship.y - me.y)) : 0,
    });
  }
  partners.sort((a, b) => a.distance - b.distance || a.id - b.id);
  const deals: UiTradeDeal[] = sim.trade.deals.map((d) => ({
    id: d.id, ship: d.ship, partner: sim.world.get(d.ship, TraderC)?.name ?? 'Trader', phase: d.phase, status: d.phase === 'failed' ? `Called off: ${d.reason ?? ''}`
      : d.phase === 'exchange' && d.via === 'hover' ? 'Swapping cargo from a hover (no station airlock free)' : PHASE[d.phase],
    courier: d.courier, give: list(sim, d.give), get: list(sim, d.get), balance: d.barter ? 0 : d.balance, barter: d.barter, vehicle: d.vehicle,
    live: d.phase !== 'done' && d.phase !== 'failed', cancellable: d.phase === 'dispatch' || d.phase === 'load',
    flying: d.vehicle !== 0 && sim.world.get(d.vehicle, VehicleC)?.state === 'flying',
  }));
  return { credits: sim.trade.credits, partners, deals };
}
