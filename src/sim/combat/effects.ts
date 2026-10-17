import { CrewC, DeadC, DownedC, HealthC, PositionC } from '../crew/components';
import { origin } from '../crew/helpers';
import { ModuleC } from '../modules/components';
import type { Effect } from '../registry';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { TICK_HZ } from '../time';
import { IGNITE_INTENSITY } from '../tuning';
import { CombatC, IonC } from './components';
import { damageStruct } from './hull';
import { shipEntityOf } from './ships';

/** Where and from what an impact happens. */
export interface Impact {
  gridId: number;
  x: number;
  y: number;
  /** Projectile entity and weapon id, for events. */
  projectile: number;
  weapon: string;
}

/**
 * The one effect applier: writes a weapon's typed effect list to tile fields and components around an
 * impact tile. Shield drain is applied in list order, so `ifNoDrain` effects after it see whether it drained.
 */
export function applyEffects(sim: Sim, impact: Impact, effects: readonly Effect[]): void {
  let drained = false;
  for (const e of effects) {
    switch (e.type) {
      case 'hullDamage': hullDamage(sim, impact, e.amount, e.radius ?? 0, e.falloff ?? 1); break;
      case 'moduleDamage': moduleDamage(sim, impact, e.amount, e.radius ?? 0); break;
      case 'crewDamage': crewDamage(sim, impact, e.amount, e.radius ?? 0); break;
      case 'ignite': ignite(sim, impact, e.radius ?? 0); break;
      case 'shieldDrain': drained = drainShield(sim, impact, e.layers) || drained; break;
      case 'ionDisable': if (!(e.ifNoDrain && drained)) ionDisable(sim, impact, e.seconds); break;
    }
  }
}

function hullDamage(sim: Sim, at: Impact, amount: number, radius: number, falloff: number): void {
  const grid = sim.grids.get(at.gridId);
  if (!grid?.has('hp')) return;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = at.x + dx;
      const y = at.y + dy;
      if (grid.inBounds(x, y)) damageStruct(grid, x, y, dx === 0 && dy === 0 ? amount : amount * falloff);
    }
  }
}

/** Distinct module ids within `radius` tiles (Chebyshev) of the impact. */
function modulesNear(sim: Sim, at: Impact, radius: number): number[] {
  const grid = sim.grids.get(at.gridId);
  const out: number[] = [];
  if (!grid?.has('module')) return out;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (!grid.inBounds(at.x + dx, at.y + dy)) continue;
      const id = grid.get('module', at.x + dx, at.y + dy);
      if (id && !out.includes(id)) out.push(id);
    }
  }
  return out;
}

function moduleDamage(sim: Sim, at: Impact, amount: number, radius: number): void {
  for (const id of modulesNear(sim, at, radius)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || m.hp <= 0) continue;
    m.hp = Math.max(0, m.hp - amount);
    if (m.hp === 0) sim.events.emit({ type: 'module.destroyed', moduleId: id, def: m.def, gridId: at.gridId });
  }
}

function crewDamage(sim: Sim, at: Impact, amount: number, radius: number): void {
  for (const id of sim.world.query(CrewC, HealthC, PositionC)) {
    const pos = sim.world.get(id, PositionC);
    if (!pos || pos.gridId !== at.gridId || sim.world.has(id, DeadC) || sim.world.has(id, DownedC)) continue;
    const o = origin(pos);
    if (Math.max(Math.abs(o.x - at.x), Math.abs(o.y - at.y)) > radius) continue;
    const health = sim.world.get(id, HealthC);
    if (health) health.hp = Math.max(0, health.hp - amount);
  }
}

function ignite(sim: Sim, at: Impact, radius: number): void {
  const grid = sim.grids.get(at.gridId);
  if (!grid?.has('fire')) return;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const x = at.x + dx;
      const y = at.y + dy;
      if (!grid.inBounds(x, y)) continue;
      const kind = grid.get('struct', x, y);
      if ((kind === Struct.Floor || kind === Struct.Door) && grid.get('fire', x, y) < IGNITE_INTENSITY) grid.set('fire', x, y, IGNITE_INTENSITY);
    }
  }
}

function drainShield(sim: Sim, at: Impact, layers: number): boolean {
  const combat = sim.world.get(shipEntityOf(sim, at.gridId), CombatC);
  if (!combat || combat.shield.layers <= 0) return false;
  combat.shield.layers = Math.max(0, combat.shield.layers - layers);
  sim.events.emit({ type: 'projectile.shieldHit', projectile: at.projectile, weapon: at.weapon, gridId: at.gridId, layers: combat.shield.layers });
  return true;
}

function ionDisable(sim: Sim, at: Impact, seconds: number): void {
  const grid = sim.grids.get(at.gridId);
  const id = grid?.has('module') ? grid.get('module', at.x, at.y) : 0;
  if (!id || !sim.world.has(id, ModuleC)) return;
  const until = sim.tick + Math.round(seconds * TICK_HZ);
  const cur = sim.world.get(id, IonC);
  sim.world.add(id, IonC, { until: Math.max(until, cur?.until ?? 0) });
}
