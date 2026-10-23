import type { SectorGrid } from '../sectorGrid';
import type { GenOrigin } from '../shipgen/types';
import type { RuinBreach, RuinDecal, RuinHook } from '../shipgen/ruinTypes';
import { defineComponent } from '../ecs';
import type { ShipPacket } from '../sector/packet';

/** The sector all ships share. Saved with the game. */
export interface Sector {
  /**
   * Every tile of the sector: ships are stamped into it at their position (a ship's bounded view of it is `shipGrid(sim, ship)`, read from its ShipC rectangle). Not plain
   * data: the save writes it with `SectorGrid.serialize`.
   */
  grid: SectorGrid;
  /** Size in tiles. */
  width: number;
  height: number;
  /** True while an active player ship and an active/disabled hostile ship coexist. */
  inCombat: boolean;
  /** Set once the player has lost (reason code, e.g. 'captured'); see the `game.lost` event. */
  lost?: string;
  /** Galaxy node id this sector is (`START_NODE` at the start). Archives are keyed by it. */
  node: string;
  /**
   * 'active': normal play. 'hyperspace': the player's ship has been lifted into `packet` and travels (`galaxy.travel`); the sector
   * is empty and only the travel clock runs. 'deploying': it dropped out at a node and waits as `packet` until `sector.deploy` stamps
   * it (the deploy picker pauses the sim meanwhile).
   */
  state: 'active' | 'hyperspace' | 'deploying';
  /** The player's ship in transit while in hyperspace or deploying. */
  packet?: ShipPacket;
}

/** 'rogue': rogue AI (robot crews under an AI core); hostile to every other faction, neutral included. */
/** 'alien': wild creatures on derelicts; like rogue, at war with every other faction. */
export type Faction = 'player' | 'hostile' | 'neutral' | 'rogue' | 'alien';
/**
 * 'prize': a captured ship. Player-owned but inactive: no weapons, shields, AI or combat role; not flown. The player can
 * salvage it or scuttle it (-> 'wreck').
 */
export type ShipState = 'active' | 'disabled' | 'wreck' | 'fled' | 'prize';

/**
 * The part of a derelict's ruin meta the renderer needs (dressing art per tile and module), kept small and saved with the
 * ship. Tiles are ship-local (from the grid's top-left), like the meta.
 */
export interface ShipRuin {
  cause: 'combat' | 'decay';
  /** Impact centres (combat) or decay foci: the renderer scorches nearby walls from these. */
  impacts: { x: number; y: number; r: number }[];
  breaches: RuinBreach[];
  decals: RuinDecal[];
  /** Egg sacs, nests and AI spawns that carry art (static dressing). */
  hooks: Pick<RuinHook, 'x' | 'y' | 'size' | 'art'>[];
  /** Modules whose look the ruin changed: their template position, wreck state and art override. */
  modules: { x: number; y: number; state: 'damaged' | 'destroyed' | 'intact'; art?: string; flicker?: boolean }[];
}

/** A ship (one per grid): identity, world placement and lifecycle state. */
export interface Ship {
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
  /** Set on generated ships: the faction, seed and depth they were generated from (the grid itself is saved). */
  gen?: GenOrigin;
  /** Set on derelicts: dressing data for the renderer (see ShipRuin). */
  ruin?: ShipRuin;
  /**
   * Set on asteroid outposts (outposts/gen.ts): its style and kind; a dug one is roofed with rock. `hidden` until the player
   * discovers it (dug ones start hidden). Outposts are also `immobile` and `dormant` until provoked. See outposts/state.ts.
   */
  outpost?: { style: 'surface' | 'dug'; kind: string; hidden: boolean };
  /** Set on a base the player claimed on an asteroid (`asteroid.claim`): immobile, never disabled or wrecked by the ship-state system. */
  base?: { asteroid: number };
  /** Stations: no FTL, no engines, never flees or jumps; it stays in its node (archived with it). */
  immobile?: true;
  /**
   * Dormant (a pirate den or an asteroid outpost): no combat until provoked. Holds the integrity it had when it went quiet;
   * aiming at it, damaging it or boarding it wakes it (dormancySystem), as does digging or breaching into an outpost. All wake
   * through `wake` (combat/dormant.ts), which removes the field.
   */
  dormant?: number;
}
export const ShipC = defineComponent<Ship>('ship');

/** A weapon target: a ship and optionally one of its modules (0 = any module), or a vehicle. */
export interface Target {
  /** The target ship's `ShipC` entity id. */
  ship: number;
  moduleId: number;
  /** Set (with ship 0, moduleId 0) when the target is a shuttle in flight or docked. */
  vehicle?: number;
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
  /** Piloting skill of whoever mans the helm (0 when nobody does); with `evasion` it gives the hyperspace evade odds. */
  pilot: number;
  /**
   * The same two figures for a ship under way with nobody manning the helm (consoles are only manned in combat): the best pilot aboard (awake, on their feet)
   * and the powered engines with that pilot's boost; 0 when the ship has no powered helm. The hyperspace evade odds use these when `pilot` is 0.
   */
  cruisePilot: number;
  cruiseEvasion: number;
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
  /**
   * Roof turret aim, quantised to 8 directions: 0 = +x (east in grid space), then clockwise in grid space
   * (y grows downward): 1 = +x+y, 2 = +y, 3 = -x+y, 4 = -x, 5 = -x-y, 6 = -y, 7 = +x-y. Renderer-readable.
   */
  aim: number;
}
export const WeaponC = defineComponent<Weapon>('weapon');

/** On point-defence modules. */
export interface PointDefense {
  /** Turret aim toward the shot it is engaging; same 8-direction coding as Weapon.aim. Renderer-readable. */
  aim: number;
}
export const PointDefenseC = defineComponent<PointDefense>('pointDefense');

/** A shot in flight, in sector coordinates (tiles). */
export interface Projectile {
  /** WeaponDef id. */
  weapon: string;
  /** Firing ship (`ShipC` entity id) and weapon module. */
  fromShip: number;
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

/** On a ship entity while the other side holds its bridge: ticks held so far and by whom. */
export interface CaptureProgress {
  by: Faction;
  ticks: number;
}
export const CaptureProgressC = defineComponent<CaptureProgress>('captureProgress');

/** On a captured ship's entity: the record a future ship broker prices. */
export interface Prize {
  capturedTick: number;
  /** Faction it belonged to. */
  from: Faction;
  /** Hull value estimate at capture, from module build costs x hp and wall integrity. Refresh with `prizeValue`. */
  hullValue: number;
}
export const PrizeC = defineComponent<Prize>('prize');
