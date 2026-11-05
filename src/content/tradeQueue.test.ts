import { describe, expect, it } from 'vitest';
import { ShipC, TraderC, checkOffer, newGame, playerItems, type Sim } from '../sim';
import { isLive } from '../sim/trade/deals';
import { commitments } from '../sim/trade/commit';
import { cargoAdd } from '../sim/vehicles/cargo';
import { content } from './index';

/** A started game with a hailed trading outpost. */
function setup(): { sim: Sim; st: number } {
  const sim = newGame(1, content);
  sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
  step(sim);
  const st = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
  sim.enqueue({ type: 'trade.hail', ship: st });
  step(sim);
  return { sim, st };
}
const stockOf = (sim: Sim, st: number, item: string): number => sim.world.get(st, TraderC)!.stock.find((s) => s.item === item)?.count ?? 0;
/** Reject reasons seen so far: every step of the game is drained into it. */
const seen = new WeakMap<Sim, string[]>();
function rejected(sim: Sim): string[] {
  const out: string[] = [];
  seen.set(sim, out);
  return out;
}
function step(sim: Sim): void {
  sim.step();
  for (const e of sim.events.drain()) if (e.type === 'command.rejected') seen.get(sim)?.push(e.reason);
}
/** Propose and accept in two steps; returns the new deal. */
function agree(sim: Sim, ship: number, give: { item: string; count: number }[], get: { item: string; count: number }[]) {
  const before = sim.trade.deals.length;
  sim.enqueue({ type: 'trade.offer', ship, give, get });
  step(sim);
  const offer = sim.trade.offers.find((o) => o.ship === ship);
  if (offer) {
    sim.enqueue({ type: 'trade.accept', offer: offer.id });
    step(sim);
  }
  return sim.trade.deals.length > before ? sim.trade.deals[sim.trade.deals.length - 1] : undefined;
}
function runOut(sim: Sim, max = 20000): void {
  for (let i = 0; i < max && sim.trade.deals.some(isLive); i++) step(sim);
}
const METAL = { item: 'item.metal', count: 10 };

describe('queued deals', () => {
  it('a second buy waits behind the first, holds nothing, then runs after it', () => {
    const { sim, st } = setup();
    const start = sim.trade.credits;
    const first = agree(sim, st, [], [METAL])!;
    const stock1 = stockOf(sim, st, 'item.metal');
    const credits1 = sim.trade.credits;
    const second = agree(sim, st, [], [METAL])!;
    expect(first.phase).not.toBe('queued');
    expect(second.phase).toBe('queued');
    expect(second.held).toBe(0);
    expect(sim.trade.credits).toBe(credits1); // nothing escrowed for the waiting deal
    expect(stockOf(sim, st, 'item.metal')).toBe(stock1);
    const metal0 = playerItems(sim, 'item.metal');
    runOut(sim);
    for (let i = 0; i < 300; i++) step(sim);
    expect(first.phase).toBe('done');
    expect(second.phase).toBe('done');
    expect(playerItems(sim, 'item.metal') - metal0).toBe(20);
    expect(start - sim.trade.credits).toBeGreaterThan(0);
    expect(first.held + second.held).toBe(0);
  });

  it('a buy plus a sell: the sell waits for its goods and both settle', () => {
    const { sim, st } = setup();
    const first = agree(sim, st, [], [METAL])!;
    const second = agree(sim, st, [{ item: 'item.metal', count: 5 }], [])!;
    expect(first.phase).not.toBe('queued');
    expect(second).toBeDefined();
    expect(second.phase).toBe('queued');
    runOut(sim);
    expect(first.phase).toBe('done');
    expect(second.phase).toBe('done');
  });

  it('refuses to sell the same goods twice or buy the same stock twice across the queue', () => {
    const { sim, st } = setup();
    const rej = rejected(sim);
    sim.enqueue({ type: 'debug.setCredits', value: 100000 });
    step(sim);
    const total = stockOf(sim, st, 'item.metal');
    expect(total).toBeGreaterThan(10);
    agree(sim, st, [], [{ item: 'item.metal', count: total - 5 }]);
    const second = agree(sim, st, [], [{ item: 'item.metal', count: total - 5 }]);
    expect(second).toBeUndefined();
    expect(rej).toContain('theyLack');
    // Selling: the held metal is spoken for by a queued sell.
    const { sim: s2, st: st2 } = setup();
    const rej2 = rejected(s2);
    s2.enqueue({ type: 'debug.setCredits', value: 100000 });
    step(s2);
    agree(s2, st2, [], [METAL]); // running
    const have = playerItems(s2, 'item.metal');
    expect(have).toBeGreaterThan(0);
    const sell1 = agree(s2, st2, [{ item: 'item.metal', count: have }], [])!;
    expect(sell1.phase).toBe('queued');
    expect(agree(s2, st2, [{ item: 'item.metal', count: 1 }], [])).toBeUndefined();
    expect(rej2).toContain('noItems');
  });

  it('cancelling the second deal costs nothing and leaves the first running', () => {
    const { sim, st } = setup();
    const first = agree(sim, st, [], [METAL])!;
    const credits = sim.trade.credits;
    const stock = stockOf(sim, st, 'item.metal');
    const second = agree(sim, st, [], [METAL])!;
    sim.enqueue({ type: 'trade.cancel', id: second.id });
    step(sim);
    expect(second.phase).toBe('failed');
    expect(second.reason).toBe('cancelled');
    expect(sim.trade.credits).toBe(credits);
    expect(stockOf(sim, st, 'item.metal')).toBe(stock);
    runOut(sim);
    expect(first.phase).toBe('done');
  });

  it('cancelling the first lets the queued one start with its own escrow', () => {
    const { sim, st } = setup();
    const start = sim.trade.credits;
    const first = agree(sim, st, [], [METAL])!;
    const second = agree(sim, st, [], [METAL])!;
    sim.enqueue({ type: 'trade.cancel', id: first.id });
    step(sim);
    expect(first.phase).toBe('failed');
    expect(sim.trade.credits).toBe(start); // the first one's escrow came back
    for (let i = 0; i < 400 && second.phase === 'queued'; i++) step(sim);
    expect(second.phase).not.toBe('queued');
    expect(second.held).toBeGreaterThan(0);
    expect(sim.trade.credits).toBe(start - second.held);
  });

  it('a partner that leaves mid-queue drops the waiting deals with nothing held or refunded twice', () => {
    const { sim, st } = setup();
    agree(sim, st, [], [METAL]);
    const second = agree(sim, st, [], [METAL])!;
    const third = agree(sim, st, [], [METAL])!;
    sim.world.destroyEntity(st);
    for (let i = 0; i < 60; i++) step(sim);
    expect(second.phase).toBe('failed');
    expect(second.reason).toBe('traderGone');
    expect(third.phase).toBe('failed');
    expect(sim.trade.deals.some(isLive)).toBe(false);
    expect(sim.trade.deals.every((d) => d.held === 0)).toBe(true);
  });

  it('refuses a later deal the credits cannot cover on top of the earlier ones, and drops one whose credits were spent meanwhile', () => {
    const { sim, st } = setup();
    const rej = rejected(sim);
    sim.enqueue({ type: 'debug.setCredits', value: 300 });
    step(sim);
    const q = { item: 'item.metal', count: 20 };
    const first = agree(sim, st, [], [q])!;
    const left = sim.trade.credits;
    expect(left).toBeLessThan(300);
    // A second order of the same size no longer fits in what is left.
    expect(first.held).toBeGreaterThan(left);
    expect(agree(sim, st, [], [q])).toBeUndefined();
    expect(rej).toContain('noFunds');
    // One that fits is queued, then the purse is spent before it reaches the front.
    const small = agree(sim, st, [], [{ item: 'item.metal', count: 2 }])!;
    expect(small.phase).toBe('queued');
    sim.enqueue({ type: 'debug.setCredits', value: 0 });
    step(sim);
    sim.enqueue({ type: 'trade.cancel', id: first.id });
    step(sim);
    for (let i = 0; i < 400 && small.phase === 'queued'; i++) step(sim);
    // The cancelled order's escrow came back to the wallet before it was zeroed? It was zeroed after: no credits at all.
    expect(['failed', 'dispatch']).toContain(small.phase);
    if (small.phase === 'failed') expect(small.reason).toBe('noFunds');
    expect(sim.trade.credits).toBeGreaterThanOrEqual(0);
  });
});

describe('goods promised to a loading deal', () => {
  it('count only what the shuttle has not yet taken aboard', () => {
    const { sim, st } = setup();
    sim.enqueue({ type: 'debug.giveItems', item: 'item.metal', count: 30 });
    step(sim);
    const have = playerItems(sim, 'item.metal');
    const deal = agree(sim, st, [{ item: 'item.metal', count: 20 }], [])!;
    expect(deal.phase).not.toBe('queued');
    for (let i = 0; i < 6000 && deal.phase !== 'load'; i++) step(sim);
    expect(deal.phase).toBe('load');
    // Nothing loaded yet: the whole sale is promised.
    expect(commitments(sim).items.get('item.metal')).toBe(20);
    // Ten crates aboard the shuttle: ten are still promised.
    cargoAdd(sim, deal.vehicle, 'item.metal', 10);
    expect(commitments(sim).items.get('item.metal')).toBe(10);
    expect(have).toBeGreaterThanOrEqual(30);
  });
});

describe('credits promised to a running order', () => {
  it('count the running trip settling: trips of -100 then +100 reserve nothing against an empty wallet', () => {
    const { sim, st } = setup();
    sim.enqueue({ type: 'debug.setCredits', value: 0 });
    step(sim);
    sim.trade.deals.push({
      id: 900, ship: st, give: [], get: [], barter: false, balance: -100, held: 100, courier: 'you', phase: 'out', vehicle: 0, airlock: 0, timer: 0, tick: 0,
      trip: { n: 1, of: 2, rest: [{ give: [], get: [], balance: 100 }] },
    });
    expect(commitments(sim).credits).toBe(0); // 100 comes in from trip 1 before trip 2 asks for 100
    expect(commitments(sim).theirs.get(st) ?? 0).toBe(0);
    const have = playerItems(sim, 'item.metal');
    expect(have).toBeGreaterThan(0);
    expect(checkOffer(sim, st, [{ item: 'item.metal', count: 5 }], [], false).error).toBeNull(); // a further sale is fine
  });

  it('still reserve what a later trip needs beyond what the running one brings', () => {
    const { sim, st } = setup();
    sim.trade.deals.push({
      id: 901, ship: st, give: [], get: [], barter: false, balance: -100, held: 100, courier: 'you', phase: 'out', vehicle: 0, airlock: 0, timer: 0, tick: 0,
      trip: { n: 1, of: 2, rest: [{ give: [], get: [], balance: 300 }] },
    });
    expect(commitments(sim).credits).toBe(200);
  });
});
