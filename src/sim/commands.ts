import type { Faction } from './combat/components';
import type { WorkCategory } from './crew/components';
import type { PortalKind, PortalRequirement } from './portals/components';

/** Every way to change the sim from outside. Add new variants here. */
export type Command =
  | { type: 'noop' }
  | { type: 'debug.spawnMarker'; x: number; y: number }
  | { type: 'debug.setStruct'; gridId: number; x: number; y: number; kind: number }
  | { type: 'job.build'; gridId: number; x: number; y: number; struct: number }
  | { type: 'job.deconstruct'; gridId: number; x: number; y: number }
  | { type: 'job.cancel'; gridId: number; x: number; y: number }
  /** Blueprint a module; (x, y) is the top-left of the rotated footprint, rot = quarter turns clockwise. */
  | { type: 'job.buildModule'; gridId: number; x: number; y: number; def: string; rot: number }
  /** Deconstruct the module covering tile (x, y). */
  | { type: 'job.deconstructModule'; gridId: number; x: number; y: number }
  | { type: 'module.setPriority'; id: number; priority: number }
  | { type: 'module.setEnabled'; id: number; enabled: boolean }
  | { type: 'debug.ignite'; gridId: number; x: number; y: number }
  | { type: 'debug.setField'; gridId: number; x: number; y: number; field: string; value: number }
  | { type: 'crew.setPriority'; id: number; category: WorkCategory; value: number }
  | { type: 'crew.resetPriorities'; id: number }
  | { type: 'crew.draft'; id: number; drafted: boolean }
  /** Drafted crew attack this hostile crew member (walking into range first) until it is subdued. Cleared by crew.moveTo. */
  | { type: 'crew.attack'; id: number; target: number }
  /** Drafted crew shoot at the nearest visible hostile on their own (default on), or hold fire. */
  | { type: 'crew.setEngage'; id: number; engage: boolean }
  /** Fetch an `item` weapon from the nearest storage holding it and wield it (swapping the old one back). */
  | { type: 'crew.equip'; id: number; item: string }
  /** Drop the wielded weapon at the crew member's feet. */
  | { type: 'crew.unequip'; id: number }
  /** Walk a drafted crew member to a tile, on another grid if `gridId` is given and portals lead there. */
  | { type: 'crew.moveTo'; id: number; x: number; y: number; gridId?: number }
  /** Link two tiles through a portal. `cost`/`ticks` default by kind; ends on an airlock's outer door attach to that airlock. */
  | {
      type: 'portal.link'; kind: PortalKind; a: { gridId: number; x: number; y: number }; b: { gridId: number; x: number; y: number };
      cost?: number; ticks?: number; requires?: PortalRequirement[]; oneWay?: boolean;
    }
  | { type: 'portal.unlink'; id: number }
  /** Ask an airlock module to open its `to` side (it cycles when the open doorway is clear). */
  | { type: 'airlock.cycle'; moduleId: number; to: 'inner' | 'outer' }
  /** Give or take a crew member's EVA suit. */
  | { type: 'suit.set'; crew: number; worn: boolean }
  /** Drafted crew walk to the airlock's suit tile and put on one of its stowed suits (a few seconds). Needs a free suit. */
  | { type: 'eva.suitUp'; crew: number; airlock: number }
  /** Drafted, suited crew walk to an airlock (default: the nearest on their grid) and take the suit off; it returns there with a full tank. */
  | { type: 'eva.suitOff'; crew: number; airlock?: number }
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
  | { type: 'debug.spawnEnemy'; template: string; x: number; y: number }
  /** Set a weapon module's target (`weaponId` null = the ship-wide target). targetGridId 0 clears; targetModuleId 0 = any module; `targetVehicle` (with targetGridId 0) aims at a shuttle in flight or docked. */
  | { type: 'combat.setTarget'; shipGridId: number; weaponId: number | null; targetGridId: number; targetModuleId: number; targetVehicle?: number }
  /** Hold fire: weapons charge but only fire on combat.fireVolley. */
  | { type: 'combat.setHold'; gridId: number; hold: boolean }
  /** Fire every charged weapon of the ship now. */
  | { type: 'combat.fireVolley'; gridId: number }
  /** Jump away with a fully charged FTL drive. */
  | { type: 'combat.flee'; gridId: number }
  /** Turn a captured (prize) ship into a derelict wreck. Needs no player crew aboard. */
  | { type: 'ship.scuttle'; gridId: number }
  /** Order a drafted (or about to be) crew member with the hacking skill to hack an enemy AI core: a job of HACK_SEC. */
  | { type: 'crew.hack'; id: number; module: number }
  /** Queue assembly of a robot of `role` (a role with `assemble`) in a free robot bay; the bay becomes its home. */
  | { type: 'module.assembleRobot'; moduleId: number; role: string }
  /** Cancel the assembly running in a robot bay (delivered materials drop to the floor). */
  | { type: 'module.cancelAssembly'; moduleId: number }
  /** Spawn one crew member of `role` (robot variants included) on a walkable tile; faction defaults to the grid's ship. */
  | { type: 'debug.spawnCrew'; gridId: number; x: number; y: number; role: string; faction?: Faction }
  /** Place a finished module without a build job (the debug panel); rejected when placement is invalid. */
  | { type: 'debug.spawnModule'; gridId: number; x: number; y: number; def: string; rot: number }
  /** Set the battery (0..100) of every battery robot (the debug panel). */
  | { type: 'debug.setCharge'; value: number }
  /** Take the ship on `gridId` as a prize at once, its crew surrendering (the debug panel). */
  | { type: 'debug.capture'; gridId: number }
  | { type: 'debug.spawnItems'; gridId: number; x: number; y: number; item: string; count: number };

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
