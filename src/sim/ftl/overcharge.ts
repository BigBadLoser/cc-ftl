import { ModuleC } from '../modules/components';
import { footprintTiles } from '../modules/footprint';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { IGNITE_INTENSITY } from '../tuning';
import { hullLoad, type HullLoad } from './capacity';

/**
 * Overcharging the hyperdrive: a ship over its engines' hull capacity may still jump (`overcharge` on the jump), at a risk that grows with
 * the overload. The overload is the hull tiles over capacity as a fraction of capacity; the risk tops out at `OVERCHARGE_FULL` (half again
 * over). At or under capacity it is zero and nothing is rolled. Each working engine rolls once for its fate (a hit, or destroyed outright)
 * and once for a fire in its engine room, all on the sim rng, in engine id order.
 */
export const OVERCHARGE_FULL = 0.5;
/** Chance an engine is hit at full risk is capped at 1; these scale the risk (0..1) into the three chances. */
const HIT_PER_RISK = 2.5;
const DESTROY_PER_RISK = 0.5;
const FIRE_PER_RISK = 1.2;
/** A hit takes this share of the engine's maximum hp (a base plus a rolled part); it never kills on its own. */
const HIT_BASE = 0.25;
const HIT_ROLL = 0.35;

/** The chances of an overcharged jump for a hull load. All zero when the ship fits. */
export interface OverchargeRisk {
  /** Hull tiles over capacity, as a fraction of capacity. */
  overload: number;
  /** 0..1: overload against `OVERCHARGE_FULL`. */
  risk: number;
  /** Per working engine: hit (damaged) or worse, destroyed outright, and a fire in its room. */
  hit: number;
  destroy: number;
  fire: number;
}

export function riskOf(load: HullLoad): OverchargeRisk {
  const overload = load.over <= 0 ? 0 : load.capacity > 0 ? load.over / load.capacity : 1;
  const risk = Math.min(1, overload / OVERCHARGE_FULL);
  const hit = Math.min(1, HIT_PER_RISK * risk);
  return { overload, risk, hit, destroy: Math.min(hit, DESTROY_PER_RISK * risk), fire: Math.min(1, FIRE_PER_RISK * risk) };
}

/** What an overcharged jump did to the ship. */
export interface OverchargeResult {
  damaged: number;
  destroyed: number;
  fires: number;
}

/** The working engines of a ship, ascending id. */
function engines(sim: Sim, ship: number): number[] {
  return sim.world.query(ModuleC)
    .filter((id) => {
      const m = sim.world.get(id, ModuleC);
      return !!m && m.hp > 0 && !!sim.content.modules[m.def]?.engine && shipIdOf(sim, m) === ship;
    })
    .sort((a, b) => a - b);
}

/** Floor and door tiles in and one step around an engine's footprint (its room), top to bottom, left to right. */
function roomTiles(sim: Sim, ship: number, engine: number): { x: number; y: number }[] {
  const m = sim.world.get(engine, ModuleC);
  const def = m && sim.content.modules[m.def];
  const grid = shipGrid(sim, ship);
  if (!m || !def || !grid?.has('fire')) return [];
  const seen = new Set<string>();
  const out: { x: number; y: number }[] = [];
  for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = t.x + dx;
        const y = t.y + dy;
        const key = `${x},${y}`;
        if (seen.has(key) || !grid.inBounds(x, y)) continue;
        seen.add(key);
        const kind = grid.get('struct', x, y);
        if ((kind === Struct.Floor || kind === Struct.Door) && grid.get('fire', x, y) < IGNITE_INTENSITY) out.push({ x, y });
      }
    }
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Roll and apply the overcharge to a ship about to jump. Draws nothing from the rng when the ship fits. */
export function applyOvercharge(sim: Sim, ship: number): OverchargeResult {
  const out: OverchargeResult = { damaged: 0, destroyed: 0, fires: 0 };
  const risk = riskOf(hullLoad(sim, ship));
  if (risk.risk <= 0) return out;
  const grid = shipGrid(sim, ship);
  for (const id of engines(sim, ship)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def) continue;
    const fate = sim.rng.next();
    const amount = sim.rng.next();
    if (fate < risk.destroy) {
      m.hp = 0;
      m.wrecked = true;
      out.destroyed++;
      sim.events.emit({ type: 'module.destroyed', moduleId: id, def: m.def, ship });
    } else if (fate < risk.hit) {
      m.hp = Math.max(1, m.hp - def.maxHp * (HIT_BASE + HIT_ROLL * amount));
      out.damaged++;
    }
    if (sim.rng.next() < risk.fire) {
      const room = roomTiles(sim, ship, id);
      const n = Math.min(room.length, 1 + Math.floor(risk.risk * 2));
      for (let i = 0; i < n; i++) {
        const t = room.splice(sim.rng.int(0, room.length - 1), 1)[0];
        if (t && grid) {
          grid.set('fire', t.x, t.y, IGNITE_INTENSITY);
          out.fires++;
        }
      }
    }
  }
  sim.events.emit({ type: 'ftl.overcharged', ship, ...out });
  return out;
}
