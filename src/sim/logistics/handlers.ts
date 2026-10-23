import type { Command } from '../commands';
import { FerryC } from '../ferry/components';
import { isFerryRegion, isPickupRegion, regionItems } from '../ferry/pick';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { releasePilot } from './pilot';
import { TransferC } from './components';

type LogisticsCommandType = Extract<Command['type'], `transfer.${string}`>;
type Handler<T extends LogisticsCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

/** Queue an order (the command and the salvage watcher share it). Returns the order's entity, or a reject reason. */
export function queueTransfer(sim: Sim, from: number, to: number, lines: { item: string; count: number }[], auto?: 'salvage'): number | string {
  if (from === to) return 'sameRegion';
  if (!isPickupRegion(sim, from) || !isFerryRegion(sim, to)) return 'badRegion';
  const items: { item: string; count: number }[] = [];
  for (const l of lines) {
    if (!sim.content.items[l.item] || !Number.isInteger(l.count) || l.count <= 0) return 'badLine';
    const n = Math.min(l.count, regionItems(sim, from, l.item) - (items.find((x) => x.item === l.item)?.count ?? 0));
    if (n > 0) items.push({ item: l.item, count: n });
  }
  if (items.length === 0) return 'nothing';
  const total = items.reduce((n, l) => n + l.count, 0);
  const order = sim.world.createEntity();
  sim.world.add(order, TransferC, { from, to, items, total, moved: 0, status: 'queued', vehicle: 0, pilot: 0, trips: 0, fails: 0, retryAt: 0, since: sim.tick, ...(auto ? { auto } : {}) });
  sim.events.emit({ type: 'transfer.queued', order, from, to, items: total, auto: !!auto });
  return order;
}

/** End an order: a pilot still walking to the bay goes back to work, a trip not yet loaded is called home, one on its way finishes. */
export function cancelTransfer(sim: Sim, order: number, reason: 'player' | 'lost' | 'nothing'): void {
  const t = sim.world.get(order, TransferC);
  if (!t) return;
  if (t.status === 'boarding') releasePilot(sim, t.vehicle, t.pilot);
  const f = t.vehicle ? sim.world.get(t.vehicle, FerryC) : undefined;
  if (t.status === 'underway' && f && f.transfer === order) {
    delete f.transfer;
    if (f.phase === 'toFrom' || f.phase === 'gather') {
      f.phase = 'home';
      f.reason = 'cancelled';
      f.timer = 0;
      f.crew = [];
      const v = sim.world.get(t.vehicle, VehicleC);
      if (v) v.outbound = false;
    }
  }
  sim.world.destroyEntity(order);
  sim.events.emit({ type: 'transfer.cancelled', order, reason });
}

export const logisticsHandlers: { [T in LogisticsCommandType]: Handler<T> } = {
  'transfer.order': (sim, cmd) => {
    const r = queueTransfer(sim, cmd.from, cmd.to, cmd.items);
    if (typeof r === 'string') reject(sim, cmd.type, r);
  },
  'transfer.cancel': (sim, cmd) => {
    if (!sim.world.has(cmd.order, TransferC)) return reject(sim, cmd.type, 'noOrder');
    cancelTransfer(sim, cmd.order, 'player');
  },
};
