import type { Carrying, HaulData } from '../items/components';
import type { Sim } from '../sim';
import type { Deal } from './types';

/**
 * The docked-deal unit counters, written by the code that moves the goods (the haul's pickup and deposit, `stageGoods`), never inferred afterwards.
 * `Deal.dock.units[item]`: where the deal's units are now. `shelf`: in station storage. `hand`: in a station crew member's hands. `hold`: in the shuttle's hold.
 * A haul belongs to a deal when `HaulData.deal` names it (tagged where the haul is made); the direction follows from its source and destination.
 */
export interface Units {
  shelf: number;
  hold: number;
  /** Put down on the deck without reaching the destination (an interrupted haul, a hold or shelf with no room). Goods in hand are counted from the hands themselves (`handOf`). */
  floor: number;
}

/** The counters of one item of a deal's dock visit. */
export function unitsOf(d: Deal, item: string): Units {
  const dock = d.dock as NonNullable<Deal['dock']>;
  const all = (dock.units ??= {});
  return (all[item] ??= { shelf: 0, hold: 0, floor: 0 });
}

const dockedDeal = (sim: Sim, h: HaulData): Deal | undefined => (h.deal ? sim.trade.deals.find((d) => d.id === h.deal?.id && d.dock) : undefined);

/** A deal's haul took `n` units into a crew member's hands: out of storage (`get`) or out of the hold (`give`). */
export function haulPicked(sim: Sim, h: HaulData, n: number): void {
  const d = dockedDeal(sim, h);
  if (!d || !h.deal || n <= 0) return;
  const u = unitsOf(d, h.item);
  if (h.src.kind === 'vehicle') u.hold -= n; // the bucket it came out of
  else if (h.src.kind === 'storage' || h.src.kind === 'floor') {
    // Station units are fungible: a pickup that finds fewer of the deal's units in its place than it took drew the rest from the other place.
    const from = h.src.kind === 'storage' ? 'shelf' : 'floor';
    const other = from === 'shelf' ? 'floor' : 'shelf';
    u[from] -= n;
    if (u[from] < 0) {
      u[other] = Math.max(0, u[other] + u[from]);
      u[from] = 0;
    }
  }
}

/** A deal's haul put down `moved` units at its destination and `spilled` on the deck. */
export function haulDeposited(sim: Sim, h: HaulData, moved: number, spilled: number): void {
  const d = dockedDeal(sim, h);
  if (!d || !h.deal) return;
  const u = unitsOf(d, h.item);
  if (h.dst.kind === 'vehicle') u.hold += moved; // the bucket it went into
  else if (h.dst.kind === 'storage') u.shelf += moved;
  else u.floor += moved;
  u.floor += spilled;
}

/** A load of a deal was put down on the deck (`dropCarried`, the one owner of hand to floor): `placed` of its units found floor. */
export function loadDropped(sim: Sim, c: Carrying, placed: number): void {
  const d = c.deal ? sim.trade.deals.find((x) => x.id === c.deal?.id && x.dock) : undefined;
  if (d) unitsOf(d, c.item).floor += placed;
}
