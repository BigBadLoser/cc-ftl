import { CombatC, ProjectileC } from '../combat/components';
import { applyEffects } from '../combat/effects';
import { gauss } from '../combat/geometry';
import { shipById } from '../combat/ships';
import { ModuleC } from '../modules/components';
import { footprintTiles } from '../modules/footprint';
import type { Effect } from '../registry';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { VehicleC } from '../vehicles/components';
import { damageVehicle, vehicleDefOf } from '../vehicles/lifecycle';
import { shipIdOf, shipGrid } from '../regions';

/**
 * Resolves projectiles that arrived. Order: target gone -> miss; evasion roll (ship evasion) -> miss; shield
 * rule (blocked when layers > pierce, unless the weapon bypasses shields) -> shield hit; otherwise pick the
 * impact tile (a random tile of the aimed module plus gaussian spread) and apply the weapon's effects. Shots
 * that land in Space miss.
 */
export function impactSystem(sim: Sim): void {
  for (const id of [...sim.world.query(ProjectileC)]) {
    const p = sim.world.get(id, ProjectileC);
    if (!p || p.t < 1) continue;
    sim.world.destroyEntity(id);
    const def = sim.content.weapons?.[p.weapon];
    if (p.target.vehicle) {
      hitVehicle(sim, id, p.weapon, p.target.vehicle, def?.effects ?? [], p.x1, p.y1);
      continue;
    }
    const shipId = p.target.ship;
    const ship = shipById(sim, shipId);
    const grid = shipGrid(sim, shipId);
    const combat = sim.world.get(shipId, CombatC);
    const base = { projectile: id, weapon: p.weapon, ship: shipId };
    if (!def || !ship || !grid || !combat || ship.state === 'fled') {
      sim.events.emit({ type: 'projectile.miss', ...base, reason: 'gone', x: p.x1, y: p.y1 });
      continue;
    }
    if (sim.rng.chance(combat.evasion)) {
      sim.events.emit({ type: 'projectile.miss', ...base, reason: 'evaded', x: p.x1, y: p.y1 });
      continue;
    }
    if (!def.shield.bypass && combat.shield.layers > def.shield.pierce) {
      combat.shield.layers = Math.max(0, combat.shield.layers - def.shield.damage);
      sim.events.emit({ type: 'projectile.shieldHit', ...base, layers: combat.shield.layers });
      continue;
    }
    const mod = sim.world.get(p.target.moduleId, ModuleC);
    const modDef = mod && shipIdOf(sim, mod) === shipId ? sim.content.modules[mod.def] : undefined;
    const aimed = mod && modDef
      ? footprintTiles(modDef, mod.x, mod.y, mod.rot)
      : [{ x: Math.floor(p.x1), y: Math.floor(p.y1) }];
    const aim = sim.rng.pick(aimed);
    const x = aim.x + Math.round(gauss(sim) * p.spread);
    const y = aim.y + Math.round(gauss(sim) * p.spread);
    if (!grid.inBounds(x, y) || grid.get('struct', x, y) === Struct.Space) {
      sim.events.emit({ type: 'projectile.miss', ...base, reason: 'space', x: x + 0.5, y: y + 0.5 });
      continue;
    }
    sim.events.emit({ type: 'projectile.hit', ...base, x, y, moduleId: grid.get('module', x, y) });
    applyEffects(sim, { shipId, x, y, projectile: id, weapon: p.weapon }, def.effects);
  }
}

/**
 * A shot that caught a shuttle: the shuttle's evasion rolls first (a miss), then it takes the weapon's total
 * moduleDamage (hull, crew, fire and ion effects do nothing to it). Ship shields do not cover a shuttle, docked or not.
 */
function hitVehicle(sim: Sim, projectile: number, weapon: string, vehicle: number, effects: readonly Effect[], x: number, y: number): void {
  const v = sim.world.get(vehicle, VehicleC);
  const def = v && vehicleDefOf(sim, v);
  if (!v || !def) {
    sim.events.emit({ type: 'projectile.miss', projectile, weapon, ship: 0, reason: 'gone', x, y });
    return;
  }
  if (sim.rng.chance(def.evasion)) {
    sim.events.emit({ type: 'projectile.miss', projectile, weapon, ship: 0, reason: 'evaded', x, y });
    return;
  }
  let amount = 0;
  for (const e of effects) if (e.type === 'moduleDamage') amount += e.amount;
  damageVehicle(sim, vehicle, amount, 'weapon');
}
