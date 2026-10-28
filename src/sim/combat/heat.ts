import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { CombatC, IonC, type Combat, type Heat, type OverchargeSystem } from './components';
import {
  HEAT_MAX, LOCKOUT_SEC, OVERCHARGE_COOLDOWN_SEC, OVERCHARGE_SEC, PASSIVE_COOL_PER_SEC, RADIATOR_VENT_FACTOR, VENT_MIN_HEAT, VENT_OPERATED_BONUS, VENT_SEC,
} from './heatTuning';

/**
 * Combat heat. One meter per combat ship (0..HEAT_MAX). Firing, shields absorbing hits and overcharge add heat; heat only
 * falls while the shields are down (0 layers up, which includes unpowered or disabled generators): passive cooling plus
 * radiators, a vent, or the lockout that follows hitting the maximum. The per-tick work is in systems/heat.ts.
 */

export const OVERCHARGE_SYSTEMS: readonly OverchargeSystem[] = ['weapons', 'shields', 'engines'];

export function newHeat(): Heat {
  return {
    value: 0, lockout: 0, vent: 0, ventLen: 0, auto: true,
    overcharge: { weapons: { left: 0, cooldown: 0 }, shields: { left: 0, cooldown: 0 }, engines: { left: 0, cooldown: 0 } },
  };
}

/** The shields are down: nothing up to absorb hits (no layers, whether from a lockout, a vent, a shot-down or missing generator). */
export function shieldsDown(c: Combat): boolean {
  return c.shield.layers <= 0;
}

/** Overheated: weapons cannot charge or fire. */
export function lockedOut(c: Combat): boolean {
  return c.heat.lockout > 0;
}

/** Weapons cannot fire: venting or locked out. */
export function fireBlocked(c: Combat): boolean {
  return c.heat.lockout > 0 || c.heat.vent > 0;
}

export function overchargeActive(c: Combat, sys: OverchargeSystem): boolean {
  return c.heat.overcharge[sys].left > 0;
}

/** Add heat to a ship (not below 0); at HEAT_MAX it overheats. */
export function addHeat(sim: Sim, shipId: number, amount: number): void {
  const c = sim.world.get(shipId, CombatC);
  if (!c || amount === 0) return;
  const h = c.heat;
  h.value = Math.max(0, Math.min(HEAT_MAX, h.value + amount));
  if (h.value >= HEAT_MAX && h.lockout === 0) {
    h.lockout = Math.round(LOCKOUT_SEC * TICK_HZ);
    h.vent = 0;
    c.shield.layers = 0;
    c.shield.timer = 0;
    for (const sys of OVERCHARGE_SYSTEMS) h.overcharge[sys].left = 0;
    sim.events.emit({ type: 'combat.overheated', ship: shipId });
  }
}

/** Heat per second the ship's powered, intact radiators add. */
export function radiatorCooling(sim: Sim, shipId: number): number {
  let sum = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const r = m && sim.content.modules[m.def]?.radiator;
    if (!m || !r || !m.powered || m.hp <= 0 || sim.world.has(id, IonC) || shipIdOf(sim, m) !== shipId) continue;
    sum += r.coolPerSec;
  }
  return sum;
}

/** Heat per second shed while the shields are down and the ship is not venting. */
export function passiveCooling(sim: Sim, shipId: number): number {
  return PASSIVE_COOL_PER_SEC + radiatorCooling(sim, shipId);
}

/** Vent extra from radiators (heat per second). */
export function ventRadiatorCooling(sim: Sim, shipId: number): number {
  return radiatorCooling(sim, shipId) * RADIATOR_VENT_FACTOR;
}

/**
 * The crew member manning the ship's coolant console, or 0. There is no coolant console yet (it would be a new `ConsoleKind`
 * with an engineer operating it), so this is the hook: when one exists, return its operator and vents get VENT_OPERATED_BONUS faster.
 */
export function coolantOperator(sim: Sim, shipId: number): number {
  void sim;
  void shipId;
  return 0;
}

/** Why a vent is refused, or null if it can start. */
export function ventError(c: Combat): string | null {
  if (c.heat.lockout > 0) return 'overheated';
  if (c.heat.vent > 0) return 'venting';
  if (c.heat.value < VENT_MIN_HEAT) return 'cool';
  return null;
}

/** Start a vent: shields drop now, weapons hold fire, heat dumps fast for a few seconds. */
export function startVent(sim: Sim, shipId: number, c: Combat): void {
  const speed = 1 + (coolantOperator(sim, shipId) ? VENT_OPERATED_BONUS : 0);
  c.heat.ventLen = Math.max(1, Math.round((VENT_SEC * TICK_HZ) / speed));
  c.heat.vent = c.heat.ventLen;
  c.shield.layers = 0;
  c.shield.timer = 0;
  sim.events.emit({ type: 'combat.vented', ship: shipId });
}

/** Why an overcharge is refused, or null if it can start. */
export function overchargeError(c: Combat, sys: OverchargeSystem): string | null {
  if (c.heat.lockout > 0) return 'overheated';
  const o = c.heat.overcharge[sys];
  return o.left > 0 || o.cooldown > 0 ? 'cooldown' : null;
}

export function startOvercharge(sim: Sim, shipId: number, c: Combat, sys: OverchargeSystem): void {
  const o = c.heat.overcharge[sys];
  o.left = Math.round(OVERCHARGE_SEC * TICK_HZ);
  o.cooldown = Math.round(OVERCHARGE_COOLDOWN_SEC * TICK_HZ);
  sim.events.emit({ type: 'combat.overcharged', ship: shipId, system: sys });
}
