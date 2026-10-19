import type { Faction } from './combat/components';
import type { JobKind } from './crew/components';
import type { PortalEnd, PortalKind } from './portals/components';

/** Outbound notifications for UI and audio. */
export type SimEvent =
  | { type: 'debug.markerSpawned'; entity: number; x: number; y: number }
  | { type: 'crew.jobDone'; crew: number; kind: JobKind; gridId: number; x: number; y: number }
  /** A room caught fire (first burning tile in a room with no fire). */
  | { type: 'fire.started'; gridId: number; room: number; x: number; y: number }
  /** A room opened to space and started venting. */
  | { type: 'hull.breach'; gridId: number; room: number }
  /** Some enabled consumers lost power because demand exceeds supply. */
  | { type: 'power.shortage'; gridId: number; supply: number; demand: number }
  /** A room's average oxygen fell below the alert level (re-arms once it recovers). */
  | { type: 'o2.low'; gridId: number; room: number; o2: number }
  | { type: 'crew.downed'; crew: number }
  | { type: 'crew.died'; crew: number }
  | { type: 'crew.rescued'; crew: number; by: number }
  | { type: 'crew.fellAsleep'; crew: number }
  | { type: 'crew.wokeUp'; crew: number }
  | { type: 'crew.ate'; crew: number; item: string; galley: boolean }
  /** Hunger just hit zero: the crew member now loses health slowly. */
  | { type: 'crew.starving'; crew: number }
  /** Mood fell below MOOD_VERY_LOW (re-arms once it recovers above MOOD_LOW). */
  | { type: 'crew.moodLow'; crew: number; mood: number }
  /** A crew member deposited items into a storage module (`to` 'storage') or onto a job (`to` 'job'). */
  | { type: 'item.hauled'; crew: number; item: string; count: number; gridId: number; x: number; y: number; to: 'floor' | 'storage' | 'job' | 'vehicle' }
  /** A job lacks materials and no stock exists to fetch (debounced per job). */
  | { type: 'job.missingMaterials'; job: number; gridId: number; x: number; y: number; item: string }
  /** A crafting module finished a batch; outputs lie at (x, y). */
  | { type: 'production.done'; module: number; recipe: string; gridId: number; x: number; y: number }
  /** A loose stack has no storage to go to (debounced per stack). */
  | { type: 'storage.full'; gridId: number; x: number; y: number; item: string }
  /** A ship entered the sector (newGame or debug.spawnEnemy). */
  | { type: 'ship.spawned'; gridId: number; faction: Faction }
  | { type: 'combat.started' }
  | { type: 'combat.ended' }
  /** A weapon module launched one shot (`projectile` is its entity). */
  | { type: 'weapon.fired'; gridId: number; weaponId: number; weapon: string; projectile: number; targetGridId: number; targetModuleId: number }
  /** A shot landed on the hull at tile (x, y); `moduleId` is the module there (0 = none). */
  | { type: 'projectile.hit'; projectile: number; weapon: string; gridId: number; x: number; y: number; moduleId: number }
  /** A shot missed: 'evaded' (engines), 'space' (fell outside the hull) or 'gone' (target left). */
  | { type: 'projectile.miss'; projectile: number; weapon: string; gridId: number; reason: 'evaded' | 'space' | 'gone'; x: number; y: number }
  /** A shield layer absorbed (or an ion bolt drained) a shot; `layers` remain. */
  | { type: 'projectile.shieldHit'; projectile: number; weapon: string; gridId: number; layers: number }
  | { type: 'projectile.intercepted'; projectile: number; weapon: string; gridId: number }
  /** A module reached 0 hp from combat damage. */
  | { type: 'module.destroyed'; moduleId: number; def: string; gridId: number }
  /** Ship state changes. 'destroyed' = became a wreck. */
  | { type: 'ship.disabled'; gridId: number }
  | { type: 'ship.recovered'; gridId: number }
  | { type: 'ship.destroyed'; gridId: number }
  | { type: 'ship.fled'; gridId: number }
  /** A crew member finished crossing a portal and now stands at (x, y) on `toGridId`. */
  | { type: 'crew.crossed'; crew: number; portal: number; kind: PortalKind; fromGridId: number; toGridId: number; x: number; y: number }
  | { type: 'portal.linked'; portal: number; kind: PortalKind; a: PortalEnd; b: PortalEnd }
  | { type: 'portal.unlinked'; portal: number }
  /** An airlock finished a cycle; `side` is the door now open. */
  | { type: 'airlock.cycled'; gridId: number; module: number; side: 'inner' | 'outer' }
  /** A shuttle left its bay (home ship `gridId`) at sector position (x, y). */
  | { type: 'vehicle.launched'; vehicle: number; gridId: number; x: number; y: number }
  /** A shuttle latched on to `airlock` (module) of ship `gridId`. */
  | { type: 'vehicle.docked'; vehicle: number; gridId: number; airlock: number }
  | { type: 'vehicle.undocked'; vehicle: number; gridId: number; airlock: number }
  /** A shuttle flew into its home bay. */
  | { type: 'vehicle.stowed'; vehicle: number; bay: number }
  | { type: 'vehicle.damaged'; vehicle: number; amount: number; hp: number; source: 'weapon' | 'pointDefence' }
  /** A shuttle was destroyed in `state`; see destroyVehicle for what happens to those aboard. */
  | { type: 'vehicle.destroyed'; vehicle: number; state: 'stowed' | 'flying' | 'docked'; x: number; y: number }
  | { type: 'crew.embarked'; crew: number; vehicle: number; role: 'pilot' | 'passenger' }
  | { type: 'crew.disembarked'; crew: number; vehicle: number; gridId: number; x: number; y: number }
  /** A crew member attacked `target` with `weapon` (item id or 'unarmed'); (x, y) to (tx, ty) on grid `gridId`. Followed by crew.hit or crew.miss. */
  | { type: 'crew.attacked'; crew: number; target: number; weapon: string; ranged: boolean; gridId: number; x: number; y: number; tx: number; ty: number }
  | { type: 'crew.hit'; crew: number; target: number; damage: number; hp: number; cover: 'none' | 'partial' | 'full' }
  | { type: 'crew.miss'; crew: number; target: number; cover: 'none' | 'partial' | 'full' }
  | { type: 'crew.equipped'; crew: number; item: string }
  | { type: 'crew.unequipped'; crew: number; item: string }
  | { type: 'crew.surrendered'; crew: number }
  /** `by`'s crew took the ship on grid `gridId` (it is now a prize if `by` is the player, else the loss is `game.lost`). */
  | { type: 'ship.captured'; gridId: number; by: Faction; from: Faction }
  | { type: 'crew.imprisoned'; crew: number; gridId: number }
  /** Robots: stunned by ion/EMP until `until`; shut down (no live AI core) or back online; wrecked at 0 hp; wreck salvaged. */
  | { type: 'robot.stunned'; crew: number; until: number }
  | { type: 'robot.inert'; crew: number }
  /** A held hack lent the robot to `faction` (or it went back to its own side). */
  | { type: 'robot.flipped'; crew: number; faction: Faction }
  /** A robot bay finished assembling a robot (its home bay). */
  | { type: 'robot.assembled'; crew: number; bay: number; gridId: number }
  /** A robot settled into its bay to recharge / left it full. */
  | { type: 'robot.charging'; crew: number; bay: number }
  | { type: 'robot.charged'; crew: number; bay: number }
  | { type: 'robot.active'; crew: number }
  | { type: 'robot.wrecked'; crew: number }
  | { type: 'robot.salvaged'; crew: number; gridId: number; x: number; y: number }
  /** A robot fabricator built a robot. */
  | { type: 'robot.fabricated'; crew: number; moduleId: number; gridId: number }
  /** An AI core was hacked by `by`. */
  | { type: 'core.hacked'; moduleId: number; gridId: number; by: Faction }
  /** The player lost the game; `reason` is a short code ('captured'). */
  | { type: 'game.lost'; reason: string }
  /** EVA: a crew member put on / took off a suit at `airlock` (a module); the tank hit the warning level / ran dry. */
  | { type: 'suit.donned'; crew: number; airlock: number }
  | { type: 'suit.doffed'; crew: number; airlock: number }
  | { type: 'suit.airLow'; crew: number }
  | { type: 'suit.airOut'; crew: number }
  /** A command failed validation and was ignored. `reason` is a short machine-readable code. */
  | { type: 'command.rejected'; command: string; reason: string };

/**
 * The single outbound channel. Systems emit during a tick; the app drains after the tick.
 * Events are NEVER read by sim logic. Anything the sim needs later belongs in components or grids.
 */
export class EventBuffer {
  private buffer: SimEvent[] = [];

  /** Record an event. */
  emit(e: SimEvent): void {
    this.buffer.push(e);
  }

  /** Return all buffered events and clear the buffer. */
  drain(): SimEvent[] {
    const out = this.buffer;
    this.buffer = [];
    return out;
  }
}
