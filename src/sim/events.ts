import type { Faction } from './combat/components';
import type { JobKind } from './crew/components';
import type { EventEffect } from './story/defs';
import type { StationJobKind } from './galaxy/types';

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
  /** An asteroid region was stamped (`asteroid` is its AsteroidC entity); its bbox in sector tiles. */
  | { type: 'mining.ordered'; pod: number; asteroid: number; tiles: number }
  /** A crew member was sent to fly a pod (walking to its bay); the order waits for them. */
  | { type: 'mining.pilotSent'; pod: number; crew: number }
  /** A mining order cannot launch: `noPilot` (no free crew member on the pod's ship). Fired once per wait. */
  | { type: 'mining.waiting'; pod: number; reason: 'noPilot' }
  /** A pod left its bay on a mining trip (also `vehicle.launched`), heading for ore tile (x, y). */
  | { type: 'mining.launched'; pod: number; asteroid: number; x: number; y: number; trip: number }
  /** A pod cut the last ore off tile (x, y): the rock there is gone (Space). */
  | { type: 'mining.tileCleared'; pod: number; asteroid: number; x: number; y: number }
  /** A pod heads home with `cargo` ore units (hold full, nothing left, or recalled). */
  | { type: 'mining.returning'; pod: number; cargo: number }
  /** A mining order ended: 'exhausted' (no ore left), 'recalled', or 'lost' (no bay to return to). */
  | { type: 'mining.done'; pod: number; asteroid: number; reason: 'exhausted' | 'recalled' | 'lost'; trips: number }
  /** A base-logistics run began: shuttle `vehicle` carries `items` units and `crew` people from region `from` to region `to`. */
  | { type: 'ferry.started'; vehicle: number; from: number; to: number; items: number; crew: number }
  /** A run set its load down at `to`: `items` units and `crew` people. */
  | { type: 'ferry.delivered'; vehicle: number; to: number; items: number; crew: number }
  /** A run ended and the shuttle is back in its bay (`reason` is set when it was called off or could not finish). */
  | { type: 'ferry.done'; vehicle: number; reason?: 'noAirlock' | 'timeout' | 'lost' | 'cancelled' | 'nothing' | 'noRoom' }
  /** A transfer order (logistics) was queued; `auto` for salvage the game queued itself. */
  | { type: 'transfer.queued'; order: number; from: number; to: number; items: number; auto: boolean }
  /** A transfer's shuttle left with a load: trip number `trip`, `pilot` flying (0 = flying itself). */
  | { type: 'transfer.underway'; order: number; vehicle: number; pilot: number; trip: number; items: number }
  /** A trip set `items` units down at `to`; `final` when the order has nothing left to move. */
  | { type: 'transfer.delivered'; order: number; to: number; items: number; left: number; final: boolean }
  /** A transfer cannot go on for `reason` (fired once per change; it retries by itself, except `failed`, which waits for a cancel). */
  | { type: 'transfer.blocked'; order: number; reason: 'noShuttle' | 'noPilot' | 'noAirlock' | 'noStock' | 'failed' }
  /** An order ended without finishing: 'player', 'lost' (a region is gone), 'nothing' (salvage that vanished), 'recalled' (its trip was called off). */
  | { type: 'transfer.cancelled'; order: number; reason: 'player' | 'lost' | 'nothing' | 'recalled' }
  /** A dig through a vein dropped `count` units of `item` on the dug tile. */
  | { type: 'rock.dug'; ship: number; x: number; y: number; item: string; count: number }
  /** An outpost was stamped: its asteroid and its base region (ShipC). */
  /** A hidden outpost was found (still dormant): 'proximity' (player crew or vehicle near it), 'breach', or 'provoked'. */
  | { type: 'outpost.discovered'; ship: number; reason: 'proximity' | 'breach' | 'provoked' }
  /** The player claimed a base region (`ship`) on an asteroid. */
  | { type: 'asteroid.claimed'; asteroid: number; ship: number; x: number; y: number; w: number; h: number }
  | { type: 'outpost.spawned'; asteroid: number; ship: number; style: 'surface' | 'dug'; kind: string; x: number; y: number }
  | { type: 'asteroid.spawned'; asteroid: number; kind: 'big' | 'field'; x: number; y: number; w: number; h: number }
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
  /** A ship's heat hit the maximum: lockout (no weapons, no shields) until it cools. */
  | { type: 'combat.overheated'; ship: number }
  /** A ship started venting heat (shields down, weapons held). */
  | { type: 'combat.vented'; ship: number }
  | { type: 'combat.overcharged'; ship: number; system: 'weapons' | 'shields' | 'engines' }
  /** A dormant ship (pirate den, outpost) was provoked: aimed at, damaged, boarded, dug into or breached. */
  | { type: 'ship.provoked'; ship: number; reason: 'aimed' | 'damaged' | 'boarded' | 'dug' | 'breach' }
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
  /** Zealot raiders held a ship's AI core long enough: it was torn out and lost (its robots go inert). */
  | { type: 'core.torn'; ship: number }
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
  /** Player boarders: a crew member was ordered to wreck `module` of hostile ship `ship`; it ended (`destroyed`, `interrupted` by a fight or a new order, `downed`, `cancelled`). */
  | { type: 'crew.sabotageStarted'; crew: number; module: number; ship: number }
  | { type: 'crew.sabotageEnded'; crew: number; module: number; ship: number; reason: 'destroyed' | 'interrupted' | 'downed' | 'cancelled' }
  /** A boarding party was recalled: `crew` walk to shuttle `vehicle` docked at hostile ship `ship`; the shuttle brought them home; the recall failed (`crew` may be empty) for `reason`. */
  | { type: 'crew.recallStarted'; vehicle: number; ship: number; crew: number[] }
  | { type: 'crew.recalled'; vehicle: number; crew: number[] }
  | { type: 'crew.recallFailed'; vehicle: number; crew: number[]; reason: string }
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
  /** An overcharged jump (ship over its engines' hull capacity) took its toll: engines hit, engines destroyed, engine-room fires lit (ftl/overcharge.ts). */
  | { type: 'ftl.overcharged'; ship: number; damaged: number; destroyed: number; fires: number }
  /** A shipyard order was paid (yard/), and ended: `built` of `total` tiles stand; `reason` is empty when all was built. */
  /** A ship's hull plan was set (hull.plan): `tiles` still open. */
  | { type: 'hull.planned'; ship: number; tiles: number }
  | { type: 'yard.ordered'; order: number; station: number; tiles: number }
  | { type: 'yard.ended'; order: number; reason: string; built: number; total: number }
  /** A hop of the trip ended at `to` (fuel of that hop and, for the first, the FTL charge paid on entry). */
  | { type: 'galaxy.jumped'; from: string; to: string; edge: string; fuel: number; charge: number }
  /** A starmap turn began (a hop was entered, or `cause: 'time'` for a game-time turn); see galaxy/turn.ts. */
  | { type: 'galaxy.turn'; turn: number; cause?: 'time' }
  /** The player's hop met an NPC fleet (see galaxy/encounters.ts); an encounter was stored for it (`kind`) or resolved/expired. */
  | { type: 'galaxy.crossing'; fleet: number; faction: string; role: string; how: 'pass' | 'overlap' | 'node'; node: string }
  | { type: 'galaxy.encounter'; id: number; kind: 'interdict' | 'hail' | 'scan' | 'distress'; fleet: number; faction: string; role: string; node: string }
  /** An interdiction cut the player's trip short at `node` (it drops there). */
  | { type: 'galaxy.interdicted'; node: string }
  | { type: 'galaxy.encounterResolved'; id: number; outcome: string }
  | { type: 'galaxy.evadeRoll'; id: number; odds: number; roll: number; success: boolean }
  | { type: 'galaxy.distressSent'; node: string; due: number }
  | { type: 'galaxy.towArrived'; fuel: number; paid: number; owed: number }
  | { type: 'galaxy.bribed'; id: number; cost: number; faction: string }
  | { type: 'scan.found'; id: number; faction: string; value: number }
  | { type: 'scan.settled'; id: number; faction: string; outcome: 'confiscated' | 'bribed'; cost: number }
  | { type: 'truce.breached'; node: string; until: number }
  | { type: 'galaxy.eventEntered'; id: number; kind: 'fight' | 'rescue' }
  | { type: 'galaxy.eventLeft'; id: number; node: string }
  | { type: 'galaxy.rescued'; id: number; faction: string }
  | { type: 'galaxy.stalled'; node: string; need: number }
  | { type: 'galaxy.dropped'; node: string }
  | { type: 'galaxy.populated'; node: string; count: number }
  | { type: 'galaxy.news'; id: number; kind: string; node: string }
  /** The player's notoriety changed (galaxy/heat.ts); `faction` is the victim's when a kill caused it. */
  | { type: 'galaxy.notoriety'; value: number; delta: number; faction: string | null }
  /** A faction sent a hunter fleet after the player (galaxy/hunters.ts). */
  | { type: 'galaxy.hunt'; fleet: number; faction: string; node: string; ships: number }
  /** A station job was taken, or closed: 'done' (paid), 'failed' (ran out of time), 'abandoned'. */
  /** Crew was hired at a station (galaxy/recruit.ts). */
  /** A research project finished and its blueprints are known (sim/research). */
  | { type: 'research.done'; ship: number; project: string }
  /** A blueprint was bought at a station (galaxy/blueprintShop.ts). */
  | { type: 'blueprint.bought'; def: string; port: string; cost: number }
  | { type: 'crew.hired'; crew: number; role: string; cost: number }
  | { type: 'job.accepted'; id: number; kind: StationJobKind; issuer: string }
  /** A bounty's target was destroyed or a survey's node entered: the job is now a claim to hand in at a station of the issuing type. */
  | { type: 'job.completed'; id: number; kind: 'bounty' | 'survey'; issuer: string; reward: number }
  /** A claim was handed in and paid. */
  | { type: 'job.handedIn'; id: number; kind: 'bounty' | 'survey'; issuer: string; reward: number; port: string }
  /** The station sent its shuttle for a delivery's crate. */
  | { type: 'job.shuttleSent'; id: number; station: number; via: 'station' | 'own' }
  /** A delivery was paid (`reward`): the station's shuttle took the crate ('shuttle'), the player's shuttle dropped it at the station ('own'), or no shuttle could ('instant'; see galaxy/handover.ts). */
  | { type: 'job.handedOver'; id: number; issuer: string; reward: number; via: 'shuttle' | 'own' | 'instant' }
  /** A goal of the tutorial chain was met, and an act of it finished (its reward paid). */
  | { type: 'goal.done'; goal: string; title: string }
  | { type: 'goal.actDone'; act: string; title: string }
  | { type: 'job.closed'; id: number; kind: StationJobKind; outcome: 'done' | 'failed' | 'abandoned'; reward: number }
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
