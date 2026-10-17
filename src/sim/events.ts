import type { JobKind } from './crew/components';

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
  /** A crew member deposited items into a storage module (`to` 'storage') or onto a job (`to` 'job'). */
  | { type: 'item.hauled'; crew: number; item: string; count: number; gridId: number; x: number; y: number; to: 'floor' | 'storage' | 'job' }
  /** A job lacks materials and no stock exists to fetch (debounced per job). */
  | { type: 'job.missingMaterials'; job: number; gridId: number; x: number; y: number; item: string }
  /** A crafting module finished a batch; outputs lie at (x, y). */
  | { type: 'production.done'; module: number; recipe: string; gridId: number; x: number; y: number }
  /** A loose stack has no storage to go to (debounced per stack). */
  | { type: 'storage.full'; gridId: number; x: number; y: number; item: string }
  /** A ship entered the sector (newGame or debug.spawnEnemy). */
  | { type: 'ship.spawned'; gridId: number; faction: 'player' | 'hostile' | 'neutral' }
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
