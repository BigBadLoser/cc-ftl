import { CombatC, ProjectileC } from '../combat/components';
import { applyEffects } from '../combat/effects';
import { gauss } from '../combat/geometry';
import { shipEntityOf, shipOf } from '../combat/ships';
import { ModuleC } from '../modules/components';
import { footprintTiles } from '../modules/footprint';
import type { Sim } from '../sim';
import { Struct } from '../structure';

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
    const gridId = p.target.gridId;
    const ship = shipOf(sim, gridId);
    const grid = sim.grids.get(gridId);
    const combat = sim.world.get(shipEntityOf(sim, gridId), CombatC);
    const base = { projectile: id, weapon: p.weapon, gridId };
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
    const modDef = mod && mod.gridId === gridId ? sim.content.modules[mod.def] : undefined;
    const aimed = mod && modDef
      ? footprintTiles(modDef, mod.x, mod.y, mod.rot)
      : [{ x: Math.floor(p.x1 - ship.x), y: Math.floor(p.y1 - ship.y) }];
    const aim = sim.rng.pick(aimed);
    const x = aim.x + Math.round(gauss(sim) * p.spread);
    const y = aim.y + Math.round(gauss(sim) * p.spread);
    if (!grid.inBounds(x, y) || grid.get('struct', x, y) === Struct.Space) {
      sim.events.emit({ type: 'projectile.miss', ...base, reason: 'space', x: ship.x + x + 0.5, y: ship.y + y + 0.5 });
      continue;
    }
    sim.events.emit({ type: 'projectile.hit', ...base, x, y, moduleId: grid.get('module', x, y) });
    applyEffects(sim, { gridId, x, y, projectile: id, weapon: p.weapon }, def.effects);
  }
}
