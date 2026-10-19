import type { EdgeKind } from './types';
import {
  HYPERLANE_DAYS_PER_UNIT, HYPERLANE_UNITS_PER_FUEL, ROUTE_CHARGE, ROUTE_DAYS_PER_UNIT, ROUTE_UNITS_PER_FUEL,
} from './tuning';
import { FTL_CHARGE_SEC } from '../tuning';

/** Fuel, FTL charge (seconds) and travel days of a jump of `length` map units. Hyperlanes are cheaper per distance. */
export function jumpCosts(kind: EdgeKind, length: number): { fuel: number; charge: number; time: number } {
  if (kind === 'hyperlane') {
    return { fuel: Math.max(1, Math.ceil(length / HYPERLANE_UNITS_PER_FUEL)), charge: FTL_CHARGE_SEC, time: round1(length * HYPERLANE_DAYS_PER_UNIT) };
  }
  return {
    fuel: Math.max(1, Math.ceil(length / ROUTE_UNITS_PER_FUEL)),
    charge: Math.min(ROUTE_CHARGE.max, Math.round(ROUTE_CHARGE.base + length * ROUTE_CHARGE.perUnit)),
    time: round1(length * ROUTE_DAYS_PER_UNIT),
  };
}

const round1 = (v: number): number => Math.max(0.1, Math.round(v * 10) / 10);
