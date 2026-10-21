/**
 * Asteroid outpost generator (pure, seeded): a big asteroid plus a base template in a rectangle of it. Enemies and NPC
 * factions use the same generator and pick by `kind`.
 * - 'surface' (trading, farming, mining): an open asteroid; the base sits on levelled rock ground at the asteroid's north edge.
 *   Prefab habitats (9x8 hulls with their own walls) in a row, joined by pressurized tubes (walled corridors), the first with an
 *   airlock in its north hull facing open space (the dock).
 * - 'dug' (pirate, criminal, covert): a dense asteroid; the same rooms are carved into rock mass, which stands in for every wall,
 *   and a tunnel runs north from the first room to an airlock set in a notch of the rock face.
 * The habitat and room contents are hand-made kits (reactor, life support, lights, beds, storage, galley) for now; they should
 * switch to the station prefabs and room recipes of the `stations` branch once it lands.
 */
import { generateAsteroid } from '../asteroids/gen';
import type { AsteroidPlan, OreDef } from '../asteroids/types';
import type { ShipTemplate } from '../registry';
import { Rng } from '../rng';
import { isAsteroidRock, Struct } from '../structure';

export type OutpostStyle = 'surface' | 'dug';
export type OutpostKind = 'trading' | 'farming' | 'mining' | 'pirate' | 'criminal' | 'covert';
export const OUTPOST_KINDS: Record<OutpostStyle, readonly OutpostKind[]> = { surface: ['trading', 'farming', 'mining'], dug: ['pirate', 'criminal', 'covert'] };

/** Generated outpost: the asteroid plan (edited to host the base), the base template and its top-left in the plan's tiles. */
export interface OutpostPlan {
  style: OutpostStyle;
  kind: OutpostKind;
  seed: number;
  asteroid: AsteroidPlan;
  template: ShipTemplate;
  at: { x: number; y: number };
}

/** Habitat (room) size with its walls, the gap a tube spans, the dug tunnel length, the ring of rock or ground around. */
export const OUTPOST = { habW: 9, habH: 8, tube: [3, 6], tunnel: [3, 6], habs: [2, 3], ring: 1, tries: 12 } as const;

type Mod = NonNullable<ShipTemplate['modules']>[number];

/** Rooms after the first, by kind: what each extra habitat holds (positions in habitat tiles, walls at 0 and W-1 / H-1). */
function extraHab(kind: OutpostKind, k: number): Mod[] {
  const light = { def: 'module.light', x: 4, y: 6, rot: 0 };
  const ls = { def: 'module.lifeSupport', x: 7, y: 5, rot: 0 };
  if (k === 1) return [ls, light, ...[1, 2, 3].map((x) => ({ def: 'module.bed', x, y: 1, rot: 0 })), { def: 'module.storage', x: 6, y: 1, rot: 0 }];
  if (kind === 'farming') return [ls, light, { def: 'module.galley', x: 1, y: 1, rot: 0 }, { def: 'module.storage', x: 5, y: 1, rot: 0 }];
  return [ls, light, ...[1, 2, 3, 4, 5].map((x) => ({ def: 'module.storage', x, y: 1, rot: 0 }))];
}

/** Carve or build the base into a fresh rows canvas of the base rectangle. */
function layout(style: OutpostStyle, kind: OutpostKind, rng: Rng): ShipTemplate {
  const { habW: W, habH: H, ring } = OUTPOST;
  const n = rng.int(OUTPOST.habs[0], OUTPOST.habs[1]);
  const gaps = Array.from({ length: n - 1 }, () => rng.int(OUTPOST.tube[0], OUTPOST.tube[1]));
  const tunnel = style === 'dug' ? rng.int(OUTPOST.tunnel[0], OUTPOST.tunnel[1]) : 0;
  const top = style === 'dug' ? ring + 4 + tunnel : ring; // the first habitat's north wall row
  const width = 2 * ring + n * W + gaps.reduce((s, g) => s + g, 0);
  const height = top + H + ring;
  const cells: string[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => '.'));
  const wall = style === 'surface' ? '#' : '.'; // dug: the rock mass is the wall
  const put = (x: number, y: number, c: string) => { (cells[y] as string[])[x] = c; };
  const modules: Mod[] = [];
  let hx = ring;
  for (let k = 0; k < n; k++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(hx + x, top + y, x === 0 || y === 0 || x === W - 1 || y === H - 1 ? wall : '_');
    const mods: Mod[] = k === 0
      ? [{ def: 'module.reactor', x: 1, y: 5, rot: 0 }, { def: 'module.lifeSupport', x: 7, y: 5, rot: 0 }, { def: 'module.light', x: 1, y: 1, rot: 0 }, { def: 'module.light', x: 7, y: 1, rot: 0 }]
      : extraHab(kind, k);
    for (const m of mods) modules.push({ ...m, x: hx + m.x, y: top + m.y });
    if (k > 0) put(hx, top + 4, 'D');
    if (k < n - 1) {
      put(hx + W - 1, top + 4, 'D');
      const g = gaps[k] as number;
      for (let x = hx + W; x < hx + W + g; x++) {
        put(x, top + 4, '_');
        put(x, top + 3, wall);
        put(x, top + 5, wall);
      }
      hx += W + g;
    }
  }
  const ax = ring + 3; // airlock columns ax..ax+2, its outer (hull) row at y = ring
  if (style === 'surface') {
    // the airlock sits in the first habitat's north hull, its pod and chamber inside the room
    modules.push({ def: 'module.airlock', x: ax, y: ring, rot: 0 });
  } else {
    for (let y = ring; y < ring + 4; y++) for (let x = ax; x < ax + 3; x++) put(x, y, y === ring ? '#' : '_');
    modules.push({ def: 'module.airlock', x: ax, y: ring, rot: 0 });
    for (let y = ring + 4; y < top; y++) put(ax + 1, y, '_');
    put(ax + 1, top, 'D');
  }
  return { name: `${kind} outpost`, rows: cells.map((r) => r.join('')), modules };
}

/** Recount the plan's rock-mass share after the base was cut in. */
function recount(plan: AsteroidPlan): void {
  let rock = 0, mass = 0;
  for (const k of plan.struct) {
    if (isAsteroidRock(k)) rock++;
    if (k === Struct.Rock) mass++;
  }
  plan.mass = rock ? mass / rock : 0;
}

/**
 * Generate an outpost of `style` from `seed`. `kind` defaults to one of the style's kinds rolled from the seed. Deterministic.
 * The base rectangle (plus its ring) is levelled to ground (surface) or packed with rock mass (dug), the airlock's notch and
 * collar are cut to open space, and no ore is left under built tiles. Returns null if no asteroid fits in OUTPOST.tries seeds.
 */
export function generateOutpost(style: OutpostStyle, seed: number, ores: readonly OreDef[], kind?: OutpostKind): OutpostPlan | null {
  const rng = new Rng((seed >>> 0) ^ 0x0b57a7e5);
  const k = kind ?? rng.pick(OUTPOST_KINDS[style]);
  const template = layout(style, k, rng);
  const rw = Math.max(...template.rows.map((r) => r.length));
  const rh = template.rows.length;
  for (let t = 0; t < OUTPOST.tries; t++) {
    const plan = generateAsteroid('big', (seed + t * 7919) >>> 0, ores, { coverage: style === 'surface' ? 'open' : 'dense' });
    if (plan.w < rw + 6 || plan.h < rh + 6) continue;
    const x0 = Math.floor((plan.w - rw) / 2);
    const ax = x0 + OUTPOST.ring + 3;
    // the hull row sits on the topmost body row under the airlock columns, so the airlock faces open space
    let hull = 0;
    for (let x = ax; x < ax + 3; x++) {
      let y = 0;
      while (y < plan.h && plan.struct[y * plan.w + x] === Struct.Space) y++;
      hull = Math.max(hull, y);
    }
    const y0 = hull - OUTPOST.ring;
    if (y0 < 0 || y0 + rh + 2 > plan.h) continue;
    const fill = style === 'surface' ? Struct.Ground : Struct.Rock;
    for (let y = Math.max(0, y0); y < y0 + rh + 1; y++) {
      for (let x = x0 - 1; x < x0 + rw + 1; x++) {
        const i = y * plan.w + x;
        const lx = x - x0, ly = y - y0;
        const built = lx >= 0 && ly >= 0 && lx < rw && ly < rh && template.rows[ly]?.[lx] !== '.';
        if (y < hull && x >= ax && x < ax + 3) { plan.struct[i] = Struct.Space; plan.ore[i] = 0; plan.amt[i] = 0; continue; }
        if (y < hull) continue; // above the face: leave the asteroid's outline
        plan.struct[i] = fill;
        if (built || style === 'surface') { plan.ore[i] = 0; plan.amt[i] = 0; }
      }
    }
    // clear the notch above the airlock up to the plan's top (open space for the collar)
    for (let y = 0; y < hull; y++) {
      for (let x = ax; x < ax + 3; x++) {
        const i = y * plan.w + x;
        plan.struct[i] = Struct.Space;
        plan.ore[i] = 0;
        plan.amt[i] = 0;
      }
    }
    recount(plan);
    return { style, kind: k, seed, asteroid: plan, template, at: { x: x0, y: y0 } };
  }
  return null;
}
