import { describe, expect, it } from 'vitest';
import type { UiTradeLine, UiTradePartner } from './api';
import { clampQty, limits, stepOf, summarize, tripsFor } from './tradeDraft';

const line = (over: Partial<UiTradeLine>): UiTradeLine => ({ item: 'a', name: 'A', theirs: 40, mine: 10, sell: 10, buy: 6, ...over });
const partner = (lines: UiTradeLine[], over: Partial<UiTradePartner> = {}): UiTradePartner => ({ wallet: 1000, lines, ...over }) as UiTradePartner;

describe('trade draft', () => {
  it('steps by 1, 5 or 10', () => {
    expect(stepOf({})).toBe(1);
    expect(stepOf({ shiftKey: true })).toBe(5);
    expect(stepOf({ ctrlKey: true })).toBe(10);
  });
  it('clamps buys to stock and credits, sells to what is held', () => {
    const l = line({});
    const p = partner([l]);
    expect(limits(l, p, {}, 55)).toEqual({ up: 5, down: 10 });
    expect(limits(l, p, {}, 5000).up).toBe(40);
    expect(clampQty(99, { up: 5, down: 10 })).toBe(5);
    expect(clampQty(-99, { up: 5, down: 10 })).toBe(-10);
    expect(clampQty(Number.NaN, { up: 5, down: 10 })).toBe(0);
  });
  it('counts other lines sales toward what can be bought', () => {
    const a = line({ item: 'a' });
    const b = line({ item: 'b', mine: 20, buy: 30 });
    expect(limits(a, partner([a, b]), { b: -20 }, 0).up).toBe(40); // 600 credits from b buys up to the 40 in stock
    expect(limits(a, partner([a, b]), { b: -2 }, 0).up).toBe(6);
  });
  it('only a black market takes contraband', () => {
    const c = line({ contraband: true });
    expect(limits(c, partner([c]), {}, 100).down).toBe(0);
    expect(limits(c, partner([c], { market: {} as never }), {}, 100).down).toBe(10);
  });
  it('limits by queued promises and the partner purse', () => {
    const l = line({ theirsFree: 3, mineFree: 2 });
    expect(limits(l, partner([l], { walletFree: 6 }), {}, 1000)).toEqual({ up: 3, down: 1 });
  });
  it('sums a slip and its trips', () => {
    const a = line({ item: 'a', name: 'Rations' });
    const b = line({ item: 'b', name: 'Ore', buy: 3 });
    const s = summarize([a, b], { a: 20, b: -12 });
    expect(s.buy).toEqual([{ item: 'a', name: 'Rations', count: 20, value: 200 }]);
    expect(s.sell[0]?.value).toBe(36);
    expect(s.balance).toBe(164);
    expect(tripsFor(s, 8)).toBe(3);
    expect(tripsFor(s, 0)).toBe(1);
  });
});
