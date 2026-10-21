import { CombatC, ShipC, type Combat, type Ship } from '../combat/components';
import { shieldCapacity } from '../combat/ships';
import type { Sim } from '../sim';

/**
 * Outpost hostility (user decision, 2026-10-21). An outpost is **dormant** until provoked: it is no combatant for the combat
 * trigger, alerts, auto-target or the hostile count, whatever its faction. A dug outpost is also **hidden** until discovered:
 * not listed, not targetable, not selectable, always under its rock roof. Discovery shows it but leaves it dormant;
 * provocation (shots, boarding, digging into it) makes it a combatant (it gets a `CombatC`). Both flags live on
 * `ShipC.outpost` and are saved.
 */

/** True for an outpost that has not been provoked: never a combatant. */
export function isDormant(ship: Ship | undefined): boolean {
  return !!ship?.outpost && !ship.outpost.provoked;
}

/** True for an outpost the player has not discovered yet. */
export function isHiddenOutpost(ship: Ship | undefined): boolean {
  return !!ship?.outpost?.hidden;
}

export type DiscoverReason = 'proximity' | 'breach' | 'provoked';
export type ProvokeReason = 'shot' | 'boarded' | 'dug' | 'breach';

/** Reveal a hidden outpost (it stays dormant). No-op if it is not hidden. */
export function discoverOutpost(sim: Sim, ship: number, reason: DiscoverReason): void {
  const s = sim.world.get(ship, ShipC);
  if (!s?.outpost?.hidden) return;
  s.outpost.hidden = false;
  sim.events.emit({ type: 'outpost.discovered', ship, reason });
}

/** Provoke an outpost: it is revealed and becomes a combatant (a `CombatC` like a spawned ship's). No-op once provoked. */
export function provokeOutpost(sim: Sim, ship: number, reason: ProvokeReason): void {
  const s = sim.world.get(ship, ShipC);
  if (!s?.outpost || s.outpost.provoked) return;
  discoverOutpost(sim, ship, 'provoked');
  s.outpost.provoked = true;
  if (!sim.world.has(ship, CombatC)) {
    const layers = shieldCapacity(sim, ship, false);
    const combat: Combat = {
      hold: false, volley: false, target: null, doctrine: 'random', ftl: 0,
      shield: { layers, max: layers, timer: 0 }, evasion: 0, aiTimer: 0,
    };
    sim.world.add(ship, CombatC, combat);
  }
  sim.events.emit({ type: 'outpost.provoked', ship, reason });
}
