import type { EdgeKind } from './types';
import {
  GATE_FUEL, GATE_TIME, HYPERLANE_DAYS_PER_UNIT, HYPERLANE_UNITS_PER_FUEL, ROUTE_CHARGE, ROUTE_DAYS_PER_UNIT, ROUTE_UNITS_PER_FUEL,
} from './tuning';
import { FTL_CHARGE_SEC } from '../tuning';

/**
 * Fuel, FTL charge (seconds) and travel days of a jump of `length` map units. Hyperlanes are cheaper per distance; a gate
 * (a hyperlane across a region border) costs GATE_FUEL extra and GATE_TIME times the days, so leaving a region is a decision.
 */
export function jumpCosts(kind: EdgeKind, length: number, gate = false): { fuel: number; charge: number; time: number } {
  if (kind === 'hyperlane') {
    const fuel = Math.max(1, Math.ceil(length / HYPERLANE_UNITS_PER_FUEL)) + (gate ? GATE_FUEL : 0);
    return { fuel, charge: FTL_CHARGE_SEC, time: round1(length * HYPERLANE_DAYS_PER_UNIT * (gate ? GATE_TIME : 1)) };
  }
  return {
    fuel: Math.max(1, Math.ceil(length / ROUTE_UNITS_PER_FUEL)),
    charge: Math.min(ROUTE_CHARGE.max, Math.round(ROUTE_CHARGE.base + length * ROUTE_CHARGE.perUnit)),
    time: round1(length * ROUTE_DAYS_PER_UNIT),
  };
}

const round1 = (v: number): number => Math.max(0.1, Math.round(v * 10) / 10);
