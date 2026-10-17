import { defineComponent } from '../ecs';

/** The sector all ships share. Saved with the game. */
export interface Sector {
  /** Size in tiles. */
  width: number;
  height: number;
  /** True while an active player ship and an active/disabled hostile ship coexist. */
  inCombat: boolean;
}

export type Faction = 'player' | 'hostile' | 'neutral';
export type ShipState = 'active' | 'disabled' | 'wreck' | 'fled';

/** A ship (one per grid): identity, world placement and lifecycle state. */
export interface Ship {
  gridId: number;
  name: string;
  faction: Faction;
  state: ShipState;
  /** Sector position of the grid's top-left tile. */
  x: number;
  y: number;
  /** Grid size in tiles (the ship's sector footprint). */
  width: number;
  height: number;
  /** Largest wall + door integrity total seen (the wall part of the integrity maximum). */
  hullMax: number;
  /** 0..1 overall integrity: wall integrity (lightly weighted) plus module hp. Updated by the ship-state system. */
  integrity: number;
}
export const ShipC = defineComponent<Ship>('ship');

/** A weapon target: a ship grid and optionally one of its modules (0 = any module). */
export interface Target {
  gridId: number;
  moduleId: number;
}

export type Doctrine = 'weapons' | 'shields' | 'random';

/** Per-ship combat state. */
export interface Combat {
  /** Hold fire: weapons charge but wait for combat.fireVolley. */
  hold: boolean;
  /** Set by combat.fireVolley; the firing system fires every charged weapon once, then clears it. */
  volley: boolean;
  /** Ship-wide target, used by weapons without their own. */
  target: Target | null;
  doctrine: Doctrine;
  /** Seconds of FTL charge (flee needs FTL_CHARGE_SEC). */
  ftl: number;
  shield: { layers: number; max: number; /** Seconds toward the next layer. */ timer: number };
  /** Chance 0..1 that an incoming shot misses; derived each tick from powered engines and the pilot. */
  evasion: number;
  /** Ticks until the AI next reconsiders its targets. */
  aiTimer: number;
}
export const CombatC = defineComponent<Combat>('combat');

/** On weapon modules. */
export interface Weapon {
  /** 0..1, full at 1. */
  charge: number;
  /** Own target; null = use the ship-wide one. */
  target: Target | null;
  /** Shots still to launch in the running volley. */
  shotsLeft: number;
  /** Tick of the next shot of the volley. */
  nextShotTick: number;
  /** Resolved target of the running volley. */
  volleyTarget: Target | null;
}
export const WeaponC = defineComponent<Weapon>('weapon');

/** A shot in flight, in sector coordinates (tiles). */
export interface Projectile {
  /** WeaponDef id. */
  weapon: string;
  /** Firing ship grid and weapon module. */
  fromGridId: number;
  fromModuleId: number;
  target: Target;
  /** Launch and destination points. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Current position. */
  x: number;
  y: number;
  /** Flight progress 0..1; it lands at 1. */
  t: number;
  /** Progress per tick. */
  dt: number;
  /** Aim error sigma in tiles, fixed at launch (operator skill applied). */
  spread: number;
  /** True once point defence has had its chance. */
  pdRolled: boolean;
}
export const ProjectileC = defineComponent<Projectile>('projectile');

/** On a module disabled by ion: out of action until this tick. */
export interface Ion {
  until: number;
}
export const IonC = defineComponent<Ion>('ion');
