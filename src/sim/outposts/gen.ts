/**
 * Asteroid outpost generator (pure, seeded): a big asteroid plus a small station on it. An outpost is a real `station.<kind>` of the
 * 'outpost' size tier (shipgen/stationGen.ts: room recipes, crew and security, docks), run by the station director like any station;
 * this file only fits it onto rock. Enemies and NPC factions use the same generator and pick by `kind`.
 * - 'surface' (trading, farming, mining): an open asteroid; the station stands on levelled rock ground (a pad one tile wider than
 *   the station) with its dock airlock at the asteroid's edge, facing open space.
 * - 'dug' (pirate, criminal, covert): a dense asteroid; the station's rooms are carved into rock mass, which stands in for every
 *   outer wall (`carveInRock`), a rock roof hides it, and one airlock is set in a notch of the rock face.
 * Both keep the station's other airlocks; on rock or ground they open on the asteroid, not on space.
 */
import { generateAsteroid } from '../asteroids/gen';
import type { AsteroidPlan, OreDef } from '../asteroids/types';
import type { ModuleDef, ShipTemplate } from '../registry';
import { Rng } from '../rng';
import { generateStation, type StationResult } from '../shipgen/stationGen';
import type { StationDef } from '../shipgen/stationTypes';
import { isAsteroidRock, Struct } from '../structure';
import { builtOf, carveInRock, pickDock, placeAt, type Dock } from './site';

export type OutpostStyle = 'surface' | 'dug';
export type OutpostKind = 'trading' | 'farming' | 'mining' | 'pirate' | 'criminal' | 'covert';
export const OUTPOST_KINDS: Record<OutpostStyle, readonly OutpostKind[]> = { surface: ['trading', 'farming', 'mining'], dug: ['pirate', 'criminal', 'covert'] };

/** The station kind (content id) an outpost kind is built from. Criminal and covert bases are pirate-run for now. */
export const OUTPOST_STATION: Record<OutpostKind, string> = {
  trading: 'station.trading', farming: 'station.farming', mining: 'station.mining', pirate: 'station.pirate', criminal: 'station.pirate', covert: 'station.pirate',
};

/** What generation reads from content: ore kinds, module defs and the station kinds. */
export interface OutpostContent {
  ores: readonly OreDef[];
  modules: Record<string, ModuleDef>;
  stations: Record<string, StationDef>;
}

/**
 * Generated outpost: the asteroid plan (edited to host the base), the base template (the station, carved for a dug one) and its
 * top-left in the plan's tiles, the generated station (rooms, for station life), its station kind and the dock airlock.
 */
export interface OutpostPlan {
  style: OutpostStyle;
  kind: OutpostKind;
  seed: number;
  asteroid: AsteroidPlan;
  template: ShipTemplate;
  at: { x: number; y: number };
  stationKind: string;
  station: StationResult;
  dock: Dock;
}

/** Station attempts, asteroids per station, the ring of rock or ground around the base, and the share of base tiles that may overhang space. */
export const OUTPOST = { stations: 4, tries: 10, ring: 1, bulge: 0.2 } as const;

/** Recount the plan's rock-mass share after the base was cut in. */
function recount(plan: AsteroidPlan): void {
  let rock = 0, mass = 0;
  for (const k of plan.struct) {
    if (isAsteroidRock(k)) rock++;
    if (k === Struct.Rock) mass++;
  }
  plan.mass = rock ? mass / rock : 0;
}

/** Level (surface) or pack (dug) the base and the ring round it, and open the dock's notch to space. */
function shape(plan: AsteroidPlan, style: OutpostStyle, t: ShipTemplate, dock: Dock, at: { x: number; y: number; face: number }): void {
  const b = builtOf(t);
  const fill = style === 'surface' ? Struct.Ground : Struct.Rock;
  const clear = (i: number) => { plan.ore[i] = 0; plan.amt[i] = 0; };
  for (let ly = -OUTPOST.ring; ly < b.h + OUTPOST.ring; ly++) {
    for (let lx = -OUTPOST.ring; lx < b.w + OUTPOST.ring; lx++) {
      const px = at.x + lx, py = at.y + ly;
      if (px < 0 || py < 0 || px >= plan.w || py >= plan.h) continue;
      let near = false;
      for (let dy = -OUTPOST.ring; dy <= OUTPOST.ring; dy++) for (let dx = -OUTPOST.ring; dx <= OUTPOST.ring; dx++) near ||= b.has(lx + dx, ly + dy);
      if (!near) continue;
      const i = py * plan.w + px;
      plan.struct[i] = fill;
      if (style === 'surface' || b.has(lx, ly)) clear(i);
    }
  }
  // the notch: three columns of open space from the dock's collar out to the plan's edge
  for (let cx = at.x + dock.outer.x - 1; cx <= at.x + dock.outer.x + 1; cx++) {
    for (let py = at.y + dock.collar.y; py >= 0 && py < plan.h; py += dock.dir) {
      if (b.has(cx - at.x, py - at.y)) continue;
      const i = py * plan.w + cx;
      plan.struct[i] = Struct.Space;
      clear(i);
    }
  }
}

/**
 * Generate an outpost of `style` from `seed`. `kind` defaults to one of the style's kinds rolled from the seed. Deterministic.
 * A station of the kind is generated and a big asteroid (open for surface, dense for dug) is searched for one where its dock airlock
 * fits the rock face. Returns null if none fits in OUTPOST.stations x OUTPOST.tries attempts.
 */
export function generateOutpost(style: OutpostStyle, seed: number, content: OutpostContent, kind?: OutpostKind): OutpostPlan | null {
  const rng = new Rng((seed >>> 0) ^ 0x0b57a7e5);
  const k = kind ?? rng.pick(OUTPOST_KINDS[style]);
  const stationKind = OUTPOST_STATION[k];
  const def = content.stations[stationKind];
  if (!def) return null;
  for (let s = 0; s < OUTPOST.stations; s++) {
    let station: StationResult;
    try {
      station = generateStation(def, stationKind, 'outpost', (seed + s * 104729) >>> 0, content.modules);
    } catch {
      continue;
    }
    const dock = station.problems.length === 0 ? pickDock(station.template, content.modules) : null;
    if (!dock) continue;
    const template = { ...(style === 'dug' ? carveInRock(station.template, content.modules) : station.template), name: `${k} outpost` };
    const b = builtOf(template);
    for (let t = 0; t < OUTPOST.tries; t++) {
      const plan = generateAsteroid('big', (seed + (s * OUTPOST.tries + t) * 7919) >>> 0, content.ores, { coverage: style === 'surface' ? 'open' : 'dense', minSize: Math.max(b.w, b.h) + 12 });
      const at = placeAt(plan, template, dock, OUTPOST.bulge);
      if (!at) continue;
      shape(plan, style, template, dock, at);
      recount(plan);
      return { style, kind: k, seed, asteroid: plan, template, at: { x: at.x, y: at.y }, stationKind, station, dock };
    }
  }
  return null;
}
