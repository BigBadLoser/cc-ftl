import type { ItemQty } from '../registry';

/**
 * One kind of work a drone type does (DESIGN.md "Drones"). A drone tries its def's jobs in list order and takes the nearest free target
 * of the first kind that has one; the drone system interprets each kind the same way for every type (drones/work.ts).
 */
export type DroneJobDef =
  /** Repair damaged modules on its ship, at `rate` times a crew member's repair speed at workSpeed 1. */
  | { kind: 'repair'; rate: number }
  /** Put out fires no bigger than `maxFire` intensity, at `rate` times a crew member's extinguish speed. */
  | { kind: 'extinguish'; rate: number; maxFire: number }
  /**
   * First aid: a downed patient is patched in `patchSec` seconds (the bleeding stops; they still need a bed), a conscious wounded one is
   * healed `healPerSec` hp a second up to `healTo` of their max hp. Never a mechanical body.
   */
  | { kind: 'firstAid'; patchSec: number; healPerSec: number; healTo: number }
  /**
   * Defence, in space: while its ship is in a fight the drone launches through its bay's hatch and orbits the ship `gap` tiles off its hull,
   * shooting what is already hostile and within `range` tiles: interceptable shots at its ship first (`hitChance` each), then enemy drones
   * (`droneDamage`), then enemy shuttles (`shuttleDamage`, chipping like point defence). One shot every `fireSec`. Never a ship, so it never
   * provokes anyone (combat/provoke.ts).
   */
  | { kind: 'intercept'; range: number; gap: number; fireSec: number; hitChance: number; droneDamage: number; shuttleDamage: number }
  /**
   * Seal hull breaches from outside (DESIGN.md "Drones"): flies out through its bay's hatch to a hole in the hull of its ship and closes it
   * with a wall, in the crew's wall time divided by `rate`. The wall's cost is paid from the drone's supply load (`DroneDef.supply`); a drone
   * that cannot carry the whole cost, or has too little of it, does not take the work.
   */
  | { kind: 'seal'; rate: number };

export type DroneJobKind = DroneJobDef['kind'];

/** A drone type (content/drones.ts). Drones are their own entities (DroneC on a BodyC), run by the drone system, never crew. */
export interface DroneDef {
  name: string;
  /** Flight speed in tiles per second. */
  speed: number;
  maxHp: number;
  /**
   * Battery 0..100: drains `drainPerSec` a second out of the bay, `workMult` times that while working. Below `lowBelow` it flies home; it
   * leaves the bay again once charged above `launchAbove`.
   */
  charge: { drainPerSec: number; workMult: number; lowBelow: number; launchAbove: number };
  /** Seconds an ion or EMP hit knocks it out. */
  ionStunSec: number;
  /** What a destroyed drone leaves. */
  wreck: readonly ItemQty[];
  /** A load of one item it carries (topped up from its ship's storage while docked in a powered bay) and spends on work, e.g. the metal of a seal. */
  supply?: { item: string; capacity: number };
  /** Its work, best first. */
  jobs: readonly DroneJobDef[];
  /** Placeholder colour of its body until the art exists. Render-only. */
  tint: number;
}

/**
 * A drone bay module (ModuleDef.droneBay): `slots` drones docked on its footprint tiles in order, each recharged `chargePerSec` and mended
 * `repairPerSec` while powered. Drones bound for space go up through the ceiling hatch at the middle of its footprint.
 */
export interface DroneBayDef {
  slots: number;
  chargePerSec: number;
  /** Hp a second it mends a docked drone while powered. */
  repairPerSec: number;
}
