import type { Rng } from '../rng';
import type { ModuleDef, ShipTemplate } from '../registry';
import { cableRows } from '../cable';
import type { Layout } from './layout';
import type { ShipPlan } from './plan';
import type { FactionDef, ShipRoleDef } from './types';

/** A fitted layout and what goes with its modules, and turning it into a ship template (split from generate.ts). */

export interface Fitted {
  /** Why the fit-out failed (the partial layout is kept for the viewer). */
  error?: string;
  lay: Layout;
  stock: Map<number, { item: string; count: number }[]>;
  /** Bays with a vehicle in them: the module index and the vehicle (the bay's own `builtWith`, else a shuttle). */
  vehicles: Map<number, string>;
  /** Drone defs docked in the bay at this module index. */
  drones: Map<number, string[]>;
  /** Modules standing on open ground outside the hull (module indices), and the cable that wires them to it (`FinishOpts.ground`). */
  ground?: { placed: Set<number>; cable: Set<number>; unwired: number };
}

export function toTemplate(f: FactionDef, role: ShipRoleDef, factionId: string, seed: number, plan: Pick<ShipPlan, 'crew'>, rows: string[], d: Fitted): ShipTemplate {
  const tag = (seed >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(-4);
  const modules: NonNullable<ShipTemplate['modules']> = d.lay.modules.map((m, i) => {
    const stock = d.stock.get(i);
    return {
      def: m.def, x: m.x, y: m.y, rot: m.rot,
      ...(stock && stock.length > 0 ? { stock } : {}),
      ...(d.vehicles.has(i) ? { vehicle: d.vehicles.get(i) } : {}),
      ...(d.drones.has(i) ? { drones: d.drones.get(i) } : {}),
      ...(d.ground?.placed.has(i) ? { ground: true as const } : {}),
    };
  });
  return {
    name: `${f.name} ${role.id} ${factionId.replace(/^faction\./, '').slice(0, 2).toUpperCase()}-${tag}`,
    faction: 'hostile',
    doctrine: f.doctrine.targeting,
    crew: plan.crew,
    rows,
    modules,
    ...(d.ground && d.ground.cable.size > 0 ? { cable: cableRows(d.lay.w, d.lay.h, d.ground.cable) } : {}),
    ...(f.doctrine.boarding ? { boarding: { ...f.doctrine.boarding } } : {}),
  };
}


/** A container's cargo: the faction's stock list, scaled up by the container's capacity (storage caps what fits). */
export function stockOf(rng: Rng, f: FactionDef, def: ModuleDef | undefined): { stock?: { item: string; count: number }[] } {
  const k = Math.ceil((def?.storage?.capacity ?? 0) / 3);
  const stock = f.stock.map((s) => ({ item: s.item, count: rng.int(s.min, s.max) * k })).filter((s) => s.count > 0);
  return stock.length > 0 ? { stock } : {};
}
