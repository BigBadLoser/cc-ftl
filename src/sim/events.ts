import type { Faction } from './combat/components';
import type { JobKind } from './crew/components';
import type { EventEffect } from './story/defs';

/** Outbound notifications for UI and audio. */
export type SimEvent =
  | { type: 'debug.markerSpawned'; entity: number; x: number; y: number }
  | { type: 'crew.jobDone'; crew: number; kind: JobKind; ship: number; x: number; y: number }
  /** A room caught fire (first burning tile in a room with no fire). */
  | { type: 'fire.started'; ship: number; room: number; x: number; y: number }
  /** A room opened to space and started venting. */
  | { type: 'hull.breach'; ship: number; room: number }
  /** Some enabled consumers lost power because demand exceeds supply. */
  | { type: 'power.shortage'; ship: number; supply: number; demand: number }
  /** A room's average oxygen fell below the alert level (re-arms once it recovers). */
  | { type: 'o2.low'; ship: number; room: number; o2: number }
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
  | { type: 'item.hauled'; crew: number; item: string; count: number; ship: number; x: number; y: number; to: 'floor' | 'storage' | 'job' | 'vehicle' }
  /** A job lacks materials and no stock exists to fetch (debounced per job). */
  | { type: 'job.missingMaterials'; job: number; ship: number; x: number; y: number; item: string }
  /** A crafting module finished a batch; outputs lie at (x, y). */
  | { type: 'production.done'; module: number; recipe: string; ship: number; x: number; y: number }
  /** A loose stack has no storage to go to (debounced per stack). */
  | { type: 'storage.full'; ship: number; x: number; y: number; item: string }
  /** A ship entered the sector (newGame or debug.spawnEnemy). */
  | { type: 'ship.spawned'; ship: number; faction: Faction }
  | { type: 'combat.started' }
  | { type: 'combat.ended' }
  /** A weapon module launched one shot (`projectile` is its entity). */
  | { type: 'weapon.fired'; ship: number; weaponId: number; weapon: string; projectile: number; targetShip: number; targetModuleId: number }
  /** A shot landed on the hull at tile (x, y); `moduleId` is the module there (0 = none). */
  | { type: 'projectile.hit'; projectile: number; weapon: string; ship: number; x: number; y: number; moduleId: number }
  /** A shot missed: 'evaded' (engines), 'space' (fell outside the hull) or 'gone' (target left). */
  | { type: 'projectile.miss'; projectile: number; weapon: string; ship: number; reason: 'evaded' | 'space' | 'gone'; x: number; y: number }
  /** A shield layer absorbed (or an ion bolt drained) a shot; `layers` remain. */
  | { type: 'projectile.shieldHit'; projectile: number; weapon: string; ship: number; layers: number }
  | { type: 'projectile.intercepted'; projectile: number; weapon: string; ship: number }
  /** A module reached 0 hp from combat damage. */
  | { type: 'module.destroyed'; moduleId: number; def: string; ship: number }
  /** A container left its ship as a free body (same entity id); x, y are its body position in sector tiles. */
  | { type: 'container.detached'; container: number; ship: number; x: number; y: number }
  /** Ship state changes. 'destroyed' = became a wreck. */
  | { type: 'ship.disabled'; ship: number }
  | { type: 'ship.recovered'; ship: number }
  | { type: 'ship.destroyed'; ship: number }
  | { type: 'ship.fled'; ship: number }
  /** A dormant hostile (pirate den) was provoked: aimed at, damaged or boarded. */
  | { type: 'ship.provoked'; ship: number; reason: 'aimed' | 'damaged' | 'boarded' }
  /** A station raised its alarm (intruders, attacked, fire, breach): guards converge, civilians take cover. */
  | { type: 'station.alarm'; ship: number; reason: string }
  /** A station's alarm calmed after a quiet spell; it forgets its grudges. */
  | { type: 'station.calm'; ship: number }
  | { type: 'sector.jumped'; ship: number; from: string; to: string; restored: boolean }
  | { type: 'sector.deployed'; ship: number; x: number; y: number }
  /** An airlock finished a cycle; `side` is the door now open. */
  | { type: 'airlock.cycled'; ship: number; module: number; side: 'inner' | 'outer' }
  /** A shuttle left its bay (home ship `ship`) at sector position (x, y). */
  | { type: 'vehicle.launched'; vehicle: number; ship: number; x: number; y: number }
  /** A shuttle latched on to `airlock` (module) of ship `ship`. */
  | { type: 'vehicle.docked'; vehicle: number; ship: number; airlock: number }
  | { type: 'vehicle.undocked'; vehicle: number; ship: number; airlock: number }
  /** A shuttle flew into its home bay. */
  | { type: 'vehicle.stowed'; vehicle: number; bay: number }
  | { type: 'vehicle.damaged'; vehicle: number; amount: number; hp: number; source: 'weapon' | 'pointDefence' }
  /** A shuttle was destroyed in `state`; see destroyVehicle for what happens to those aboard. */
  | { type: 'vehicle.destroyed'; vehicle: number; state: 'stowed' | 'flying' | 'docked'; x: number; y: number }
  | { type: 'crew.embarked'; crew: number; vehicle: number; role: 'pilot' | 'passenger' }
  | { type: 'crew.disembarked'; crew: number; vehicle: number; ship: number; x: number; y: number }
  /** A crew member attacked `target` with `weapon` (item id or 'unarmed'); (x, y) to (tx, ty) on ship `ship`. Followed by crew.hit or crew.miss. */
  | { type: 'crew.attacked'; crew: number; target: number; weapon: string; ranged: boolean; ship: number; x: number; y: number; tx: number; ty: number }
  | { type: 'crew.hit'; crew: number; target: number; damage: number; hp: number; cover: 'none' | 'partial' | 'full' }
  | { type: 'crew.miss'; crew: number; target: number; cover: 'none' | 'partial' | 'full' }
  | { type: 'crew.equipped'; crew: number; item: string }
  | { type: 'crew.unequipped'; crew: number; item: string }
  | { type: 'crew.surrendered'; crew: number }
  /** `by`'s crew took the ship on ship `ship` (it is now a prize if `by` is the player, else the loss is `game.lost`). */
  | { type: 'ship.captured'; ship: number; by: Faction; from: Faction }
  | { type: 'crew.imprisoned'; crew: number; ship: number }
  /** Robots: stunned by ion/EMP until `until`; shut down (no live AI core) or back online; wrecked at 0 hp; wreck salvaged. */
  | { type: 'robot.stunned'; crew: number; until: number }
  | { type: 'robot.inert'; crew: number }
  /** A held hack lent the robot to `faction` (or it went back to its own side). */
  | { type: 'robot.flipped'; crew: number; faction: Faction }
  /** A robot bay finished assembling a robot (its home bay). */
  | { type: 'robot.assembled'; crew: number; bay: number; ship: number }
  /** A robot settled into its bay to recharge / left it full. */
  | { type: 'robot.charging'; crew: number; bay: number }
  | { type: 'robot.charged'; crew: number; bay: number }
  | { type: 'robot.active'; crew: number }
  | { type: 'robot.wrecked'; crew: number }
  /** A heavy blow (HandWeaponDef.knockdownChance) stunned `crew` until tick `until`. */
  | { type: 'crew.knockedDown'; crew: number; by: number; until: number }
  /** Aliens: an egg sac started hatching (`cause`: a non-alien came near, it was hurt, or a neighbour hatched). */
  | { type: 'eggsac.disturbed'; sac: number; ship: number; cause: 'proximity' | 'damage' | 'chain' }
  /** An egg sac reached .hatch2 and let out `aliens` (crew ids) at (x, y). */
  | { type: 'eggsac.hatched'; sac: number; ship: number; x: number; y: number; aliens: number[] }
  /** An egg sac was destroyed before it hatched. */
  | { type: 'eggsac.destroyed'; sac: number; ship: number }
  /** A nest laid a new egg sac. */
  | { type: 'nest.laid'; nest: number; sac: number; ship: number }
  | { type: 'robot.salvaged'; crew: number; ship: number; x: number; y: number }
  /** A robot fabricator built a robot. */
  | { type: 'robot.fabricated'; crew: number; moduleId: number; ship: number }
  /** An AI core was hacked by `by`. */
  | { type: 'core.hacked'; moduleId: number; ship: number; by: Faction }
  /** The player lost the game; `reason` is a short code ('captured'). */
  | { type: 'game.lost'; reason: string }
  /** EVA: a crew member put on / took off a suit at `airlock` (a module); the tank hit the warning level / ran dry. */
  | { type: 'suit.donned'; crew: number; airlock: number }
  | { type: 'suit.doffed'; crew: number; airlock: number }
  | { type: 'suit.airLow'; crew: number }
  | { type: 'suit.airOut'; crew: number }
  /** Event system: an event started (`notice` is the notice id for notices with a lead, else 0), a choice resolved it, an effect was applied (`text` '' = nothing to show). */
  | { type: 'story.started'; event: string; mode: 'decision' | 'notice'; notice: number }
  | { type: 'story.resolved'; event: string; choice: string; success: boolean | null }
  | { type: 'story.effect'; event: string; effect: EventEffect['type']; text: string }
  /** Trade: a hail was answered or refused (`reason`: 'hostile', 'weaponsHot', 'silent', 'noTrade'); an offer was priced; a deal was made (`courier`: who flies). */
  | { type: 'trade.hailAnswered'; ship: number; name: string }
  | { type: 'trade.hailRefused'; ship: number; name: string; reason: string }
  | { type: 'trade.offered'; offer: number; ship: number; balance: number }
  | { type: 'trade.dealMade'; deal: number; ship: number; courier: 'them' | 'you'; balance: number }
  /** The cargo arrived: `to` 'trader' when the shuttle handed the player's goods over, 'player' when it docked with theirs. */
  | { type: 'trade.delivered'; deal: number; ship: number; to: 'trader' | 'player' }
  /** The deal's credits were paid out (`credits`: positive = the player paid, negative = the player was paid, 0 = barter). */
  | { type: 'trade.settled'; deal: number; ship: number; credits: number }
  | { type: 'trade.failed'; deal: number; ship: number; reason: string }
  /** Starmap: a chunk was generated; the player jumped (fuel and FTL charge spent); sensors revealed nodes; a ship turned up (hostile or not). */
  | { type: 'galaxy.chunk'; key: string }
  | { type: 'galaxy.hyperspace'; ship: number; route: string[]; charge: number }
  /** A hop of the trip ended at `to` (fuel of that hop and, for the first, the FTL charge paid on entry). */
  | { type: 'galaxy.jumped'; from: string; to: string; edge: string; fuel: number; charge: number }
  /** A starmap turn began (a hop was entered); see galaxy/turn.ts. */
  | { type: 'galaxy.turn'; turn: number }
  | { type: 'galaxy.stalled'; node: string; need: number }
  | { type: 'galaxy.dropped'; node: string }
  | { type: 'galaxy.discovered'; count: number }
  | { type: 'galaxy.shipArrived'; node: string; faction: string; ship: number | null }
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
