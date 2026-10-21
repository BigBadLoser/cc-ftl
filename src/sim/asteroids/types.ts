import type { Rect } from '../grid';

/** Big: one rock body 40-120 tiles across (base or outpost site). Field: a cluster of small rocks for mining pods. */
export type AsteroidKind = 'big' | 'field';

/**
 * How much of a big asteroid is rock mass (the rest is rock ground): 'open' mostly plains with a few ridges, 'mixed', 'dense'
 * mostly or all rock mass with only small ledges and crater floors. Field rocks are 'dense' (solid boulders).
 */
export type AsteroidCoverage = 'open' | 'mixed' | 'dense';

/**
 * An ore kind (content/ores.ts), referenced by string id. `code` is what the `ore` tile field stores (1..255; 0 = no ore), so
 * codes must be unique and never reused once saves exist.
 */
export interface OreDef {
  code: number;
  name: string;
  /** Item a mined tile yields (an existing item id). */
  item: string;
  /** Relative odds of a vein (big asteroids) or a pocket (field rocks) being this ore. 0 = never. */
  weight: { big: number; field: number };
  /** Units of ore per tile, inclusive range (the `oreAmt` field, 1..255). */
  amount: [number, number];
  /** Placeholder colour for debug drawing and contact sheets (0xRRGGBB). */
  color: number;
}

/**
 * A generated asteroid in local tiles (0, 0 = top-left), before it is stamped: one value per tile, row-major, `w * h` long.
 * `struct` holds Struct.Space / Rock (mass) / Ground, `ore` an OreDef code (0 none), `amt` the units left. `parts` are the
 * bounding boxes of the separate rock bodies (one for a big asteroid). `coverage` is the rolled class and `mass` the share of
 * rock tiles that are rock mass. Not saved: only its tiles are, once stamped.
 */
export interface AsteroidPlan {
  kind: AsteroidKind;
  seed: number;
  coverage: AsteroidCoverage;
  mass: number;
  w: number;
  h: number;
  struct: Uint8Array;
  ore: Uint8Array;
  amt: Uint8Array;
  parts: Rect[];
}
