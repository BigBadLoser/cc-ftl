import { defineComponent } from '../ecs';

type Tile = { x: number; y: number };

/** One yard size tier ('station' or 'hub'): tiles (outline and floor) it will build in one visit, and its price multiplier. */
export interface YardSizeDef {
  cap: number;
  price: number;
}

/**
 * Shipyard content (`ContentRegistry.yard`): which stations offer hull expansion and what it costs. A station offers it when its generator kind
 * (`ShipC.gen.faction`) is in `kinds` and its size (`gen.role`) has a tier in `sizes`. Price per tile built (outline and floor) is `perTile` x the tier's `price`
 * x (1 + `dangerStep` x the node's danger).
 */
export interface YardDef {
  kinds: readonly string[];
  sizes: Record<string, YardSizeDef>;
  perTile: { credits: number; metal: number };
  /** The planning fee: credits per tile the contractors truss (no metal). Tiles that already have a truss are not charged again. */
  trussFee: number;
  dangerStep: number;
  /** The yard crew the station sends: a role id and how many (no more than the shuttle's suits). */
  crew: { role: string; count: number };
}

/**
 * Where an order stands. 'launch': the shuttle is made; 'fly': on its way to the player's airlock; 'work': crew out in suits building;
 * 'seal': all but one gap wall per patch stand, and the crew walk out through the gaps before they are closed (else they would wall themselves in);
 * 'recall': crew walking back to the shuttle (work done, called off, or stalled); 'home': the shuttle flies back to the station; then 'done'.
 * 'failed': ended with nothing built that could be kept (see `reason`).
 */
export type YardPhase = 'launch' | 'fly' | 'work' | 'seal' | 'recall' | 'home' | 'done' | 'failed';

/** What was paid in: credits and metal, held in escrow until the order ends. */
export interface YardMoney {
  credits: number;
  metal: number;
}

/**
 * A paid hull expansion in two passes. First the contractors put an open truss (`Struct.Beam`) on every reachable planned tile that has none (`trusses`,
 * the quick planning pass, outside the visit cap, for `fee`). Then they turn trusses into hull: `walls` are the tiles that become wall, `floor` the floor
 * they enclose, nearest rows first up to the cap (`stage` 'hull'). Both passes are ordinary construction jobs.
 */
export interface YardOrder {
  id: number;
  /** The station (ShipC entity) and the player's ship (ShipC entity). */
  station: number;
  ship: number;
  floor: Tile[];
  walls: Tile[];
  /** The tiles the truss pass builds this visit, and what it costs (credits; part of `price`). */
  trusses: Tile[];
  fee: YardMoney;
  /** 'truss': the planning pass is running; 'hull': trusses are being turned into hull. */
  stage: 'truss' | 'hull';
  /**
   * One wall of each painted patch is left for last: `wall` is closed once the crew are out, by way of `stage`, the open tile beyond it. Without
   * that the crew would wall themselves in. `sealed`: those walls have been posted.
   */
  gaps: { wall: Tile; stage: Tile }[];
  sealed: boolean;
  /** The ship's own crew drafted to walk out of the new rooms before they were closed (given back their work after). */
  ejected: number[];
  /** Escrow still held: all of the price at first; the unbuilt share goes back at the end, the built share to the station. */
  held: YardMoney;
  /** The price of the whole order, planning fee included (for the share maths and the readout). */
  price: YardMoney;
  /** The nearest row with open work (`Job.yardRank`); the crew may work this row and the next. Kept up to date while at work. */
  rank: number;
  phase: YardPhase;
  /** The yard shuttle, its crew (entities) and the player's airlock it docks at. */
  vehicle: number;
  crew: number[];
  airlock: number;
  /** Ticks in this phase, and ticks since a tile was last finished while at work. */
  timer: number;
  stall: number;
  /** Tiles finished when last counted. */
  built: number;
  tick: number;
  /** Why it ended early ('called off', 'combat', 'left', 'stalled', ...). Empty when all was built. */
  reason?: string;
}

export interface YardState {
  orders: YardOrder[];
  nextId: number;
}

export const newYard = (): YardState => ({ orders: [], nextId: 1 });

/** On a yard crew member: the order they work for. They belong to the station, not the player, and go when the order ends. */
export interface YardCrew {
  order: number;
}
export const YardCrewC = defineComponent<YardCrew>('yardCrew');

export const isLiveOrder = (o: YardOrder): boolean => o.phase !== 'done' && o.phase !== 'failed';

/** On a player ship: its planned outer hull (sector tiles), set by `hull.plan`. Planned tiles that have since been built are ignored. */
export interface HullPlan {
  tiles: Tile[];
}
export const HullPlanC = defineComponent<HullPlan>('hullPlan');
