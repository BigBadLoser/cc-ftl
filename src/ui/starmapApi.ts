/** Starmap view data (published by app/starmapSnapshot.ts). Plain data; map units, y down. */

export interface UiStarSector {
  id: string;
  name: string;
  x: number;
  y: number;
  /** SVG points string of the padded hull. */
  hull: string;
  faction: string | null;
  /** Territory tint (grey for open space). */
  color: string;
  danger: number;
  /** Top of the hull (map y), where the label goes. */
  top: number;
  /** At least one node discovered: tint and name are shown. */
  known: boolean;
}

export interface UiStarNode {
  id: string;
  sector: string;
  x: number;
  y: number;
  name: string;
  known: boolean;
  visited: boolean;
  current: boolean;
  danger: number;
  faction: string | null;
  /** Structure badges ("T", "A", "D"...). Empty for unknown nodes. */
  badges: string[];
  structures: string[];
  resources: string[];
  /** Ships seen at the node (within sensor range only): hostile and other. */
  hostiles: number;
  others: number;
}

export interface UiStarEdge {
  id: string;
  kind: 'route' | 'hyperlane';
  ax: number;
  ay: number;
  bx: number;
  by: number;
  anchor: boolean;
}

export interface UiStarFaction {
  id: string;
  name: string;
  color: string;
  tier: 'hostile' | 'neutral' | 'friendly';
  standing: number;
}

export interface UiStarmap {
  rev: number;
  current: string;
  fuel: number;
  charge: number;
  chargeMax: number;
  jumps: number;
  days: number;
  /** Map units per danger tier (rings on the map). */
  dangerStep: number;
  sectors: UiStarSector[];
  nodes: UiStarNode[];
  /** Only edges whose both ends are discovered. */
  edges: UiStarEdge[];
  factions: UiStarFaction[];
}

/** A planned route to a node. */
export interface UiStarRoute {
  to: string;
  path: string[];
  hops: number;
  fuel: number;
  time: number;
  /** FTL charge the next jump needs, and whether the tank and the drive cover the route / the next jump. */
  nextCharge: number;
  fuelOk: boolean;
  chargeOk: boolean;
  /** Why the next jump cannot go now (a short sentence), or null. */
  blocker: string | null;
}
