import type { Faction } from './combat/components';
import type { WorkCategory } from './crew/components';
import type { ItemQty } from './registry';

/** Every way to change the sim from outside. Add new variants here. */
export type Command =
  | { type: 'noop' }
  | { type: 'debug.spawnMarker'; x: number; y: number }
  | { type: 'debug.setStruct'; ship: number; x: number; y: number; kind: number }
  | { type: 'job.build'; ship: number; x: number; y: number; struct: number }
  | { type: 'job.deconstruct'; ship: number; x: number; y: number }
  /** Have crew force a jammed door (`jam` field) at (x, y) free: a timed construction job worked from beside it. */
  | { type: 'job.forceDoor'; ship: number; x: number; y: number }
  | { type: 'job.cancel'; ship: number; x: number; y: number }
  /** Blueprint a module; (x, y) is the top-left of the rotated footprint, rot = quarter turns clockwise. */
  | { type: 'job.buildModule'; ship: number; x: number; y: number; def: string; rot: number }
  /** Deconstruct the module covering tile (x, y). */
  | { type: 'job.deconstructModule'; ship: number; x: number; y: number }
  | { type: 'module.setPowerPriority'; id: number; powerPriority: number }
  | { type: 'module.setEnabled'; id: number; enabled: boolean }
  /** Unclamp a container module from its ship: its tiles leave the ship and it drifts off as a free body with its stock. */
  | { type: 'container.detach'; id: number }
  | { type: 'debug.ignite'; ship: number; x: number; y: number }
  | { type: 'debug.setField'; ship: number; x: number; y: number; field: string; value: number }
  | { type: 'crew.setPriority'; id: number; category: WorkCategory; value: number }
  | { type: 'crew.resetPriorities'; id: number }
  | { type: 'crew.draft'; id: number; drafted: boolean }
  /** Drafted crew attack this hostile crew member or egg sac (walking into range first) until it is subdued or burst. Cleared by crew.moveTo. */
  | { type: 'crew.attack'; id: number; target: number }
  /** Drafted crew shoot at the nearest visible hostile on their own (default on), or hold fire. */
  | { type: 'crew.setEngage'; id: number; engage: boolean }
  /** Fetch an `item` weapon from the nearest storage holding it and wield it (swapping the old one back). */
  | { type: 'crew.equip'; id: number; item: string }
  /** Drop the wielded weapon at the crew member's feet. */
  | { type: 'crew.unequip'; id: number }
  /** Walk a drafted crew member to a tile (on `ship` if given; another ship is out of reach). */
  | { type: 'crew.moveTo'; id: number; x: number; y: number; ship?: number }
  /** Ask an airlock module to open its `to` side (it cycles when the open doorway is clear). */
  | { type: 'airlock.cycle'; moduleId: number; to: 'inner' | 'outer' }
  /** Give or take a crew member's EVA suit. */
  | { type: 'suit.set'; crew: number; worn: boolean }
  /** Drafted crew walk to the airlock's suit tile and put on one of its stowed suits (a few seconds). Needs a free suit. */
  | { type: 'eva.suitUp'; crew: number; airlock: number }
  /** Drafted, suited crew walk to an airlock (default: the nearest on their grid) and take the suit off; it returns there with a full tank. */
  | { type: 'eva.suitOff'; crew: number; airlock?: number }
  /** Fly a shuttle to hold station a few tiles off another ship's hull (`ship`: its ShipC entity id; launching a stowed one first). Needs a pilot. */
  | { type: 'vehicle.hover'; vehicle: number; ship: number }
  /** Crew aboard a hovering shuttle (default: all passengers) put on suits from its stock and float out to the target's hull. */
  | { type: 'eva.out'; vehicle: number; crew?: number }
  /** A drafted, suited crew member on the hull floats back to the hovering shuttle, boards and stows the suit. */
  | { type: 'eva.board'; crew: number; vehicle: number }
  /** Turn one shuttle item from a storage module on the bay's ship into a shuttle stowed in the (empty) bay. */
  | { type: 'vehicle.assign'; bay: number; item?: string }
  /** Walk a crew member to the vehicle's boarding tile (bay access tile, or the docked airlock's inside tile) and climb in. */
  | { type: 'vehicle.embark'; crew: number; vehicle: number }
  /** Passengers (or just `crew`, pilot included) leave at the boarding tile. Needs the vehicle stowed or docked. */
  | { type: 'vehicle.disembark'; vehicle: number; crew?: number }
  /** Launch a stowed vehicle from its bay (needs a pilot aboard). It hovers where it starts. */
  | { type: 'vehicle.launch'; vehicle: number }
  /** Fly to an airlock's outer door and dock there (launches a stowed vehicle first). */
  | { type: 'vehicle.dock'; vehicle: number; airlock: number }
  | { type: 'vehicle.undock'; vehicle: number }
  /** Fly back to the home bay and stow (undocks first if docked). */
  | { type: 'vehicle.return'; vehicle: number }
  /** Queue a production order on a crafting module. `target`: batches ('count') or stock level ('keep'). */
  | { type: 'production.add'; moduleId: number; recipe: string; mode: 'count' | 'keep'; target: number }
  /** Remove the order at `index` of the module's list. */
  | { type: 'production.remove'; moduleId: number; index: number }
  /** Change the mode and/or target of the order at `index`, keeping its batches done. */
  | { type: 'production.edit'; moduleId: number; index: number; mode?: 'count' | 'keep'; target?: number }
  /** Move the order at index `from` to index `to`. */
  | { type: 'production.reorder'; moduleId: number; from: number; to: number }
  /** Restrict a storage module to `items` (item ids), or null to accept everything. */
  | { type: 'storage.setFilter'; moduleId: number; items: string[] | null }
  /** Spawn a hostile ship from a template; (x, y) is its top-left tile in sector coordinates. */
  /** Place the waiting ship (state 'deploying') with its top-left at sector (x, y); checked by the gap rule. */
  | { type: 'sector.deploy'; x: number; y: number }
  | { type: 'debug.spawnEnemy'; template: string; x: number; y: number }
  /**
   * Generate an asteroid (`big`: one rock body, `field`: a cluster of small rocks) from `seed` and stamp it with its top-left at
   * sector (x, y), or at the first spot that fits when both are omitted. `coverage` forces a big asteroid's rock-mass class
   * (default: rolled from the seed). Checked by the gap rule (`asteroidGapError`).
   */
  /**
   * Order mining pod `pod` (a piloted vehicle with a mining laser, stowed or out; a free crew member is sent to fly it) to mine asteroid `asteroid`: trips until its
   * ore is gone or it is recalled. `tiles` limits it to those ore tiles (sector tiles). Replaces the pod's current order.
   */
  | { type: 'mining.order'; pod: number; asteroid: number; tiles?: { x: number; y: number }[] }
  /**
   * A base-logistics run (`ferry`): a free shuttle (`vehicle`, 0 = pick one) carries `items` (clipped to what `from` holds and to the
   * hold) and `crew` (standing in `from`) from player region `from` to player region `to` (the home ship or a claimed base),
   * docking at a free working airlock of each or, at a region with none that is not its home ship, hovering (suited crew,
   * instant cargo swap). Then it flies home. Replaces nothing: a shuttle on a trade run, a ferry or a mining order is busy.
   */
  | { type: 'ferry.order'; vehicle?: number; from: number; to: number; items?: { item: string; count: number }[]; crew?: number[] }
  /**
   * Queue a logistics transfer: move `items` (clipped to what `from` holds) from player region `from` (or a salvage site) to player
   * region `to`. A free shuttle and pilot take it in as many trips as it needs; nothing else to micro-manage.
   */
  | { type: 'transfer.order'; from: number; to: number; items: { item: string; count: number }[] }
  /** Cancel a transfer: pending trips stop, goods stay where they are (a trip already on its way to the drop-off finishes). */
  | { type: 'transfer.cancel'; order: number }
  /** Call a run off: crew still aboard ride home, the shuttle flies back to its bay. */
  | { type: 'ferry.cancel'; vehicle: number }
  /** Recall a mining pod: it flies home with what it has, unloads, and ends its order. */
  | { type: 'mining.recall'; pod: number }
  /**
   * Generate an asteroid outpost (`surface`: habitats on the plains of an open asteroid; `dug`: rooms carved into a dense one)
   * from `seed` and stamp it at (x, y) or the first spot that fits. `kind` picks the flavour (default rolled).
   */
  /**
   * Start a player base on big asteroid `asteroid`: an immobile player-owned region (ShipC with `base`) over the sector rectangle
   * (x, y, w, h), 4-60 tiles a side, inside the asteroid's box, at least half on its rock, its padded frame clear of every other
   * region. The rock stays the asteroid's until crew dig or build on it.
   */
  | { type: 'asteroid.claim'; asteroid: number; x: number; y: number; w: number; h: number }
  | { type: 'debug.spawnOutpost'; style: 'surface' | 'dug'; seed: number; kind?: 'trading' | 'farming' | 'mining' | 'pirate' | 'criminal' | 'covert'; x?: number; y?: number }
  | { type: 'debug.spawnAsteroid'; kind: 'big' | 'field'; seed: number; x?: number; y?: number; coverage?: 'open' | 'mixed' | 'dense' }
  /**
   * Generate a hostile ship for a faction (content.factions) at sector `depth` from `seed` (default: drawn from the sim
   * RNG) and spawn it centred on sector tile (cx, cy), clamped into the sector. The origin is stored on the ship.
   */
  | { type: 'debug.spawnGenerated'; faction: string; depth: number; seed?: number; cx: number; cy: number }
  /**
   * Like debug.spawnGenerated, then run the derelict ruin pass (shipgen/ruin.ts) over it with `seed` and spawn the result as
   * an inert wreck: no crew, no AI, state 'wreck', neutral side. `intensity` 0..1 (default 0.5); `cause` default rolled.
   */
  | { type: 'debug.spawnDerelict'; faction: string; depth: number; seed?: number; cx: number; cy: number; intensity?: number; cause?: 'combat' | 'decay' }
  /** Set a weapon module's target (`weaponId` null = the ship-wide target). targetShip 0 clears; targetModuleId 0 = any module; `targetVehicle` (with targetShip 0) aims at a shuttle in flight or docked. */
  | { type: 'combat.setTarget'; ship: number; weaponId: number | null; targetShip: number; targetModuleId: number; targetVehicle?: number }
  /** Hold fire: weapons charge but only fire on combat.fireVolley. */
  | { type: 'combat.setHold'; ship: number; hold: boolean }
  /** Fire every charged weapon of the ship now. */
  | { type: 'combat.fireVolley'; ship: number }
  /**
   * Flee: leave the node with a charged FTL drive. The player's ship enters hyperspace like `galaxy.jump` with a one-hop route to `to` (an
   * adjacent node), else to the cheapest connected node it can afford; AI ships just leave (state 'fled').
   */
  | { type: 'combat.flee'; ship: number; to?: string }
  /** Turn a captured (prize) ship into a derelict wreck. Needs no player crew aboard. */
  | { type: 'ship.scuttle'; ship: number }
  /** Order a drafted (or about to be) crew member with the hacking skill to hack an enemy AI core: a job of HACK_SEC. */
  | { type: 'crew.hack'; id: number; module: number }
  /** Queue assembly of a robot of `role` (a role with `assemble`) in a free robot bay; the bay becomes its home. */
  | { type: 'module.assembleRobot'; moduleId: number; role: string }
  /** Cancel the assembly running in a robot bay (delivered materials drop to the floor). */
  | { type: 'module.cancelAssembly'; moduleId: number }
  /** Spawn one crew member of `role` (robot variants included) on a walkable tile; faction defaults to the grid's ship. */
  | { type: 'debug.spawnCrew'; ship: number; x: number; y: number; role: string; faction?: Faction }
  /** Place a finished module without a build job (the debug panel); rejected when placement is invalid. */
  | { type: 'debug.spawnModule'; ship: number; x: number; y: number; def: string; rot: number }
  /** Set the battery (0..100) of every battery robot (the debug panel). */
  | { type: 'debug.setCharge'; value: number }
  /** Take the ship `ship` as a prize at once, its crew surrendering (the debug panel). */
  | { type: 'debug.capture'; ship: number }
  /** Event system: pick an option of the open decision. Rejected when none is open or its requirements are unmet. */
  | { type: 'story.choose'; choice: string }
  /** Drop the tutorial goal chain for this game. */
  | { type: 'story.skipGoals' }
  /** Debug: start an event by id, ignoring its triggers and eligibility. */
  | { type: 'story.fire'; event: string }
  /** Set the pool context (danger tier, faction territory) and/or the periodic draw interval in seconds (0 = off). */
  | { type: 'story.setContext'; danger?: number; faction?: string | null }
  /** The player arrived somewhere: draw one event from the arrival pool for the current context. */
  /** Open the decision a lead notice points at, or drop the notice. */
  | { type: 'story.openNotice'; notice: number }
  | { type: 'story.dismissNotice'; notice: number }
  /** Debug: set a persistent flag/counter (0 clears it). */
  | { type: 'story.setFlag'; flag: string; value: number }
  /**
   * The one way to travel (step 9): the player's `ship` enters hyperspace and follows `route` (the nodes to pass, in order, the first one
   * joined to the current node, each pair by an edge). Needs a valid route, an active sector, no live trade deal, FTL charge for the
   * largest hop (spent once) and fuel for the first hop (each later hop pays as it is entered; the trip stops where it cannot). The
   * ship (with its stowed and docked own vehicles and the crew aboard) lifts into a packet and the rest of the sector is archived.
   * `withDocked`: ids of non-player vehicles docked at its airlocks to take along (the others are cut loose). Crew or shuttles away
   * stay in the archive (the UI confirms first, see `jumpWarnings`). Nothing is paid or moved if it is rejected.
   */
  | { type: 'galaxy.jump'; ship: number; route: string[]; withDocked?: number[] }
  /** End the hyperspace trip at the node last passed: its archive comes back (or its ships appear on the first visit) and the ship waits to deploy. */
  | { type: 'galaxy.drop' }
  /** Charge the drive: post the helm job (the best free pilot, else any crew, walks over and sits). With `jump`, fly that route (without the current node) once charged. */
  | { type: 'ftl.charge'; ship: number; jump?: string[]; withDocked?: number[] }
  /** Cancel the charge order and any queued jump. */
  | { type: 'ftl.cancelCharge'; ship: number }
  /**
   * Answer a pending encounter (galaxy/respond.ts): an interdiction takes `evade` (a seeded roll against the fleet), `bribe` (credits) or `fight`
   * (the event grid opens); a distress call `respond` (an event grid with the damaged fleet) or `ignore`; a hail or scan `acknowledge`.
   */
  | { type: 'galaxy.respond'; encounter: number; choice: 'evade' | 'bribe' | 'fight' | 'respond' | 'ignore' | 'acknowledge' }
  /** Pay a pirate den at the current node to clear the player's notoriety (galaxy/heat.ts). */
  | { type: 'galaxy.clearNotoriety' }
  /** Take a job offered at the player's node (galaxy/jobs.ts), by its offer key; give one up. */
  | { type: 'crew.hire'; key: string }
  | { type: 'jobs.accept'; key: string }
  | { type: 'jobs.abandon'; id: number }
  /** Break a delivery's crate open on deck: its goods spill out, kept, and the delivery fails. */
  | { type: 'jobs.openCrate'; id: number }
  /** Debug: set the player's notoriety (galaxy/heat.ts). */
  | { type: 'debug.notoriety'; value: number }
  /** Leave the event grid (the player's `combat.flee` does the same): the ship goes back into hyperspace and the trip carries on. Hostiles about need a charged drive. */
  | { type: 'galaxy.leaveEvent' }
  /** Debug: generate every chunk within `radius` chunks of the current galaxy node and discover all their nodes. */
  | { type: 'debug.galaxyReveal'; radius: number }
  /** Debug: move to any generated galaxy node at no cost, as if arriving there (no event draw). */
  | { type: 'debug.galaxyTeleport'; node: string }
  /** Debug: fill the player's FTL drive. */
  | { type: 'debug.chargeFtl' }
  /** Call a ship (or station) in the node. Non-hostile ones answer (see trade/traders.ts `hailVerdict`), hostile ones refuse. */
  | { type: 'trade.hail'; ship: number }
  /**
   * Propose an exchange with an answering trader: `give` items from the player's storage, `get` items from its stock. The
   * credit balance (get priced at its sell prices minus give at its buy prices) is paid by whoever owes it; `barter` swaps items
   * only and needs the balance to be <= 0.
   */
  | { type: 'trade.offer'; ship: number; give: ItemQty[]; get: ItemQty[]; barter?: boolean }
  /** Take a priced offer: escrow the credits, set the goods aside and start the delivery. */
  | { type: 'trade.accept'; offer: number }
  /** Withdraw an offer, or call off a deal whose shuttle has not left yet. `id` is the offer or deal id. */
  | { type: 'trade.cancel'; id: number }
  /** Spawn a trading station (an entity with a wallet and stock but no grid; deliveries use the instant fallback). */
  /**
   * Generate and stamp a station (shipgen/stationGen.ts) of `kind` ('station.trading'...) and `size` at (x, y), or east of
   * everything in the node, with a trader aboard. The old grid-less form `{profile: 'trader.station'}` still works: it
   * spawns a trading outpost.
   */
  | { type: 'debug.spawnStation'; kind?: string; size?: 'outpost' | 'station' | 'hub'; seed?: number; x?: number; y?: number; profile?: string; name?: string }
  /** Set the player's credits. */
  | { type: 'debug.setCredits'; value: number }
  | { type: 'debug.spawnItems'; ship: number; x: number; y: number; item: string; count: number };

/** A command tagged with the tick at whose start it applies. */
export interface QueuedCommand {
  tick: number;
  cmd: Command;
}

/**
 * The single inbound channel. Commands are queued, then applied in enqueue order at the start
 * of their tick. A ring buffer keeps the last N applied commands for "copy repro".
 */
export class CommandQueue {
  private pending: QueuedCommand[] = [];
  private log: QueuedCommand[] = [];
  private logStart = 0;

  constructor(private readonly logSize = 2000) {}

  /** Queue a command to apply at the start of `tick`. */
  enqueue(cmd: Command, tick: number): void {
    this.pending.push({ tick, cmd });
  }

  /** Apply (in order) every queued command due at or before `tick`, logging each. */
  drain(tick: number, apply: (cmd: Command) => void): void {
    const due = this.pending.filter((q) => q.tick <= tick);
    this.pending = this.pending.filter((q) => q.tick > tick);
    for (const q of due) {
      apply(q.cmd);
      this.record({ tick, cmd: q.cmd });
    }
  }

  /** Applied commands, oldest first (at most logSize). */
  getLog(): readonly QueuedCommand[] {
    return [...this.log.slice(this.logStart), ...this.log.slice(0, this.logStart)];
  }

  /** Commands queued but not yet applied. */
  getPending(): readonly QueuedCommand[] {
    return this.pending;
  }

  /** Replace pending commands (used by save loading). */
  setPending(pending: QueuedCommand[]): void {
    this.pending = [...pending];
  }

  private record(q: QueuedCommand): void {
    if (this.log.length < this.logSize) {
      this.log.push(q);
    } else {
      this.log[this.logStart] = q;
      this.logStart = (this.logStart + 1) % this.logSize;
    }
  }
}
