import type { Command } from '../commands';
import type { Sim } from '../sim';
import { planCourier } from './courier';
import { failDeal, isLive, liveDealWith, openDeal } from './deals';
import { checkOffer } from './offers';
import { ensureTrader, hailVerdict } from './traders';
import { spawnStation } from '../stations/spawn';

type TradeCommandType = Extract<Command['type'], `trade.${string}` | 'debug.spawnStation' | 'debug.setCredits'>;
type Handler<T extends TradeCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const tradeHandlers: { [T in TradeCommandType]: Handler<T> } = {
  'trade.hail': (sim, cmd) => {
    const trader = ensureTrader(sim, cmd.ship);
    if (!trader) return reject(sim, cmd.type, 'noTrader');
    const v = hailVerdict(sim, cmd.ship);
    sim.trade.hails = sim.trade.hails.filter((h) => h.ship !== cmd.ship);
    sim.trade.hails.push({ ship: cmd.ship, answered: v.answers, reason: v.reason, tick: sim.tick });
    if (!v.answers) sim.trade.offers = sim.trade.offers.filter((o) => o.ship !== cmd.ship);
    sim.events.emit(v.answers ? { type: 'trade.hailAnswered', ship: cmd.ship, name: trader.name } : { type: 'trade.hailRefused', ship: cmd.ship, name: trader.name, reason: v.reason });
  },
  'trade.offer': (sim, cmd) => {
    const c = checkOffer(sim, cmd.ship, cmd.give, cmd.get, cmd.barter === true);
    if (c.error || !c.quote) return reject(sim, cmd.type, c.error ?? 'noPrice');
    if (liveDealWith(sim, cmd.ship)) return reject(sim, cmd.type, 'dealOpen');
    sim.trade.offers = sim.trade.offers.filter((o) => o.ship !== cmd.ship);
    const offer = { id: sim.trade.nextId++, ship: cmd.ship, give: c.give, get: c.get, barter: cmd.barter === true, balance: c.quote.balance, tick: sim.tick };
    sim.trade.offers.push(offer);
    sim.events.emit({ type: 'trade.offered', offer: offer.id, ship: cmd.ship, balance: offer.balance });
  },
  'trade.accept': (sim, cmd) => {
    const offer = sim.trade.offers.find((o) => o.id === cmd.offer);
    if (!offer) return reject(sim, cmd.type, 'noOffer');
    if (liveDealWith(sim, offer.ship)) return reject(sim, cmd.type, 'dealOpen');
    const c = checkOffer(sim, offer.ship, offer.give, offer.get, offer.barter);
    if (c.error || !c.quote) return reject(sim, cmd.type, c.error ?? 'noPrice');
    const plan = planCourier(sim, offer.ship, c.give, c.get);
    if ('error' in plan) return reject(sim, cmd.type, plan.error);
    offer.balance = c.quote.balance;
    const deal = openDeal(sim, offer, c, plan);
    sim.events.emit({ type: 'trade.dealMade', deal: deal.id, ship: deal.ship, courier: deal.courier, balance: deal.balance });
  },
  'trade.cancel': (sim, cmd) => {
    if (sim.trade.offers.some((o) => o.id === cmd.id)) {
      sim.trade.offers = sim.trade.offers.filter((o) => o.id !== cmd.id);
      return;
    }
    const deal = sim.trade.deals.find((d) => d.id === cmd.id);
    if (!deal || !isLive(deal)) return reject(sim, cmd.type, 'noDeal');
    // Once the shuttle has left with the goods there is nothing to call back.
    if (deal.phase !== 'dispatch' && deal.phase !== 'load') return reject(sim, cmd.type, 'inTransit');
    failDeal(sim, deal, 'cancelled');
  },
  'debug.spawnStation': (sim, cmd) => {
    if (cmd.profile !== undefined && !sim.content.trade?.traders[cmd.profile]) return reject(sim, cmd.type, 'badProfile');
    // The old trader-profile form is a trading outpost.
    const kind = cmd.kind ?? 'station.trading';
    const seed = cmd.seed === undefined ? sim.rng.int(0, 0x7fffffff) : cmd.seed;
    const at = cmd.x !== undefined && cmd.y !== undefined ? { x: cmd.x, y: cmd.y } : undefined;
    const r = spawnStation(sim, kind, cmd.size ?? 'outpost', seed, at, cmd.name);
    if (typeof r === 'string') return reject(sim, cmd.type, r);
  },
  'debug.setCredits': (sim, cmd) => {
    if (!Number.isFinite(cmd.value)) return reject(sim, cmd.type, 'badValue');
    sim.trade.credits = Math.max(0, Math.round(cmd.value));
  },
};
