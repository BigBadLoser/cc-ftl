import { CrewC, DeadC, JobC, PositionC } from '../crew/components';
import { EvaFloatC } from '../eva/components';
import { AllegianceC } from '../fight/components';
import { ItemStackC } from '../items/components';
import { ModuleC } from '../modules/components';
import type { ComponentKey } from '../ecs';
import { AlienC, EggSacC, NestC } from '../aliens/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { AboardC, VehicleC } from '../vehicles/components';
import { vehicleFaction } from '../vehicles/lifecycle';

/**
 * Which non-player vehicles docked at the ship's airlocks travel with it: `true` all of them, `false` (the default) none
 * (they are cut loose and stay behind), or a list of the vehicle ids to take. The player's own vehicles stowed in its bays
 * or docked at its airlocks always come.
 */
export type WithDocked = boolean | readonly number[];

export interface LiftOptions {
  withDocked?: WithDocked;
}

/** Vehicles docked at one of the ship's airlocks or stowed in one of its bays, by whether they are the player's. */
function attached(sim: Sim, onShip: Set<number>): { own: number[]; foreign: number[] } {
  const own: number[] = [];
  const foreign: number[] = [];
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC);
    if (!v) continue;
    const stowed = v.state === 'stowed' && onShip.has(v.home);
    const docked = v.state === 'docked' && onShip.has(v.dock);
    if (!stowed && !docked) continue;
    (stowed || vehicleFaction(sim, v) === 'player' ? own : foreign).push(id);
  }
  return { own, foreign };
}

/** Entities standing on the ship (its tiles, rectangle or EVA ring by the `shipIdAt` rule), the ship itself first. */
function onShipSet(sim: Sim, ship: number): Set<number> {
  const out = new Set<number>([ship]);
  const w = sim.world;
  const at = (id: number, p: { x: number; y: number } | undefined): void => {
    if (p && shipIdOf(sim, p) === ship) out.add(id);
  };
  for (const id of w.query(ModuleC)) at(id, w.get(id, ModuleC));
  for (const id of w.query(JobC)) at(id, w.get(id, JobC));
  for (const id of w.query(ItemStackC)) at(id, w.get(id, ItemStackC));
  // A suited crew member drifting to or from a shuttle that stays behind is away, whatever tile their Position names.
  for (const id of w.query(PositionC)) if (!w.has(id, EvaFloatC)) at(id, w.get(id, PositionC));
  for (const key of [EggSacC, NestC, AlienC] as ComponentKey<{ ship: number }>[]) for (const id of w.query(key)) if (w.get(id, key)?.ship === ship) out.add(id);
  return out;
}

/** Every entity that lifts with the ship: what stands on it, the vehicles that travel with it and the crew aboard them. Ascending ids. */
export function liftSet(sim: Sim, ship: number, opts: LiftOptions = {}): number[] {
  const set = onShipSet(sim, ship);
  const { own, foreign } = attached(sim, set);
  const pick = opts.withDocked ?? false;
  const vehicles = [...own, ...foreign.filter((id) => pick === true || (Array.isArray(pick) && pick.includes(id)))];
  for (const id of vehicles) set.add(id);
  for (const id of sim.world.query(AboardC)) if (set.has(sim.world.get(id, AboardC)?.vehicle ?? 0)) set.add(id);
  return [...set].sort((a, b) => a - b);
}

/** What a jump of `ship` would leave behind that the player should be warned about (the jump confirm reads it). */
export interface JumpWarnings {
  /** Living player crew not aboard (boarding parties, EVA, crew on a shuttle that is away). */
  crew: number[];
  /** Player vehicles not stowed or docked on the ship. */
  vehicles: number[];
  /** Non-player vehicles docked at the ship's airlocks: the player chooses whether each comes along or is cut loose. */
  hostileDocked: number[];
}

/** The jump-confirm query: crew and shuttles that would stay behind, and the non-player vehicles docked to the ship. */
export function jumpWarnings(sim: Sim, ship: number): JumpWarnings {
  const lifting = new Set(liftSet(sim, ship, { withDocked: false }));
  const w = sim.world;
  const crew = w.query(CrewC).filter((id) => !lifting.has(id) && !w.has(id, DeadC) && w.get(id, AllegianceC)?.faction === 'player');
  const vehicles = w.query(VehicleC).filter((id) => {
    const v = w.get(id, VehicleC);
    return !lifting.has(id) && !!v && vehicleFaction(sim, v) === 'player';
  });
  const hostileDocked = attached(sim, onShipSet(sim, ship)).foreign;
  return { crew, vehicles, hostileDocked };
}
