import type { Ferry } from '../ferry/components';
import type { Sim } from '../sim';
import { TransferC, type TransferBlock } from './components';

/** Ticks before a blocked order looks for a shuttle again, and failed trips in a row before it gives up until cancelled. */
export const RETRY_TICKS = 600;
export const MAX_FAILS = 3;

/** Why a run that delivered nothing failed, as the order shows it. */
function blockOf(reason: Ferry['reason']): TransferBlock {
  return reason === 'noAirlock' ? 'noAirlock' : 'failed';
}

/**
 * A run that served a transfer order has ended (it is back in its bay, or lost): book what it delivered against the order, then
 * queue the next trip, finish the order, or block it. Called by the ferry flow just before it drops `FerryC`; an order that was
 * cancelled meanwhile (so the entity is gone) is ignored.
 */
export function settleTransfer(sim: Sim, f: Ferry): void {
  const t = f.transfer ? sim.world.get(f.transfer, TransferC) : undefined;
  if (!f.transfer || !t) return;
  const order = f.transfer;
  let delivered = 0;
  if (f.left) {
    for (const l of f.loaded ?? []) {
      const n = Math.max(0, l.count - (f.left.find((q) => q.item === l.item)?.count ?? 0));
      const line = t.items.find((x) => x.item === l.item);
      if (!line || n === 0) continue;
      line.count -= n;
      delivered += n;
    }
    t.items = t.items.filter((l) => l.count > 0);
    t.moved += delivered;
  }
  t.vehicle = 0;
  t.pilot = 0;
  t.since = sim.tick;
  if (f.reason === 'cancelled' && delivered === 0) {
    sim.world.destroyEntity(order);
    sim.events.emit({ type: 'transfer.cancelled', order, reason: 'recalled' });
    return;
  }
  const final = t.items.length === 0;
  if (delivered > 0 || final) {
    sim.events.emit({ type: 'transfer.delivered', order, to: t.to, items: delivered, left: t.items.reduce((n, l) => n + l.count, 0), final });
  }
  if (final) {
    sim.world.destroyEntity(order);
    return;
  }
  if (delivered > 0) {
    t.trips++;
    t.fails = 0;
    t.status = 'queued';
    delete t.reason;
    t.retryAt = 0;
    return;
  }
  t.fails++;
  t.status = 'blocked';
  t.reason = t.fails >= MAX_FAILS ? 'failed' : blockOf(f.reason);
  t.retryAt = t.fails >= MAX_FAILS ? -1 : sim.tick + RETRY_TICKS;
  sim.events.emit({ type: 'transfer.blocked', order, reason: t.reason });
}
