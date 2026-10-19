import { ShipC } from '../combat/components';
import { ModuleC } from '../modules/components';
import { airlockTiles } from '../portals/airlock';
import { AirlockC, PortalC, type Portal } from '../portals/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { EVA_COST_BASE, EVA_COST_PER_TILE } from '../tuning';
import { suitDef } from './suit';

/** An airlock that can open to space: its outer door tile on its grid and its collar's centre in sector tiles. */
export interface EvaDoor {
  airlock: number;
  gridId: number;
  tile: { x: number; y: number };
  sector: { x: number; y: number };
}

/** Every airlock with a collar, placed in the sector (ships without a ShipC have no sector position and are skipped). */
export function evaDoors(sim: Sim): EvaDoor[] {
  const ships = new Map<number, { x: number; y: number }>();
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC)!;
    ships.set(s.gridId, s);
  }
  const out: EvaDoor[] = [];
  for (const id of sim.world.query(AirlockC, ModuleC)) {
    const m = sim.world.get(id, ModuleC)!;
    const def = sim.content.modules[m.def];
    const ship = ships.get(m.gridId);
    if (!def?.airlock || !ship) continue;
    const t = airlockTiles(def, m);
    const c = t.collar ?? t.outer;
    out.push({ airlock: id, gridId: m.gridId, tile: t.outer, sector: { x: ship.x + c.x + 0.5, y: ship.y + c.y + 0.5 } });
  }
  return out;
}

/** The pairs of airlocks on different grids whose collars are within the suit's float range, with their distance. */
export function evaPairs(sim: Sim): { a: EvaDoor; b: EvaDoor; dist: number }[] {
  const doors = evaDoors(sim);
  const range = suitDef(sim).floatRange;
  const out: { a: EvaDoor; b: EvaDoor; dist: number }[] = [];
  for (let i = 0; i < doors.length; i++) {
    for (let j = i + 1; j < doors.length; j++) {
      const a = doors[i]!;
      const b = doors[j]!;
      if (a.gridId === b.gridId) continue;
      const dist = Math.hypot(a.sector.x - b.sector.x, a.sector.y - b.sector.y);
      if (dist <= range) out.push({ a, b, dist });
    }
  }
  return out;
}

/** Planner weight and traversal ticks of an open-space crossing of `dist` tiles. */
export function floatCost(sim: Sim, dist: number): { cost: number; ticks: number } {
  return { cost: Math.round(EVA_COST_BASE + EVA_COST_PER_TILE * dist), ticks: Math.max(1, Math.round((dist / suitDef(sim).floatSpeed) * TICK_HZ)) };
}

/** The 'eva' portals now in the world, keyed by their airlock module pair ("lowerId:higherId"). */
export function evaPortals(sim: Sim): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of sim.world.query(PortalC)) {
    const p = sim.world.get(id, PortalC) as Portal;
    if (p.kind !== 'eva' || p.a.airlock === undefined || p.b.airlock === undefined) continue;
    out.set(pairKey(p.a.airlock, p.b.airlock), id);
  }
  return out;
}

export const pairKey = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`);
