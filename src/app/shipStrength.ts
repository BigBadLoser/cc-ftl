import { ModuleC, hullTiles, shipIdOf, shieldCapacity, playerShip, shipGrid, type Sim } from '../sim';
import { generateShip } from '../sim/shipgen/generate';
import type { UiStrength, UiStrengthRead } from '../ui/api';

/** One shield layer is worth about this many hull plates when sizing up a fight. */
const SHIELD_PLATES = 12;
/** Their strength over ours beyond these bounds reads as "outmatched" / "weaker"; between them "even". */
const OUTMATCHED_AT = 1.3;
const WEAKER_AT = 0.75;

const cache = new WeakMap<object, Map<string, UiStrength | null>>();
const CACHE_MAX = 64;

/** Guns x (hull plates + shield layers in plates): a rough fight value, the same for both sides. */
const power = (s: UiStrength): number => s.guns * (s.hull + s.shields * SHIELD_PLATES);

/** Outmatched / even / weaker, comparing the two ships' guns, shields and hull. Null when there is nothing to compare. */
export function readStrength(theirs: UiStrength, mine: UiStrength | null): UiStrengthRead | null {
  if (!mine || power(mine) <= 0) return null;
  const r = power(theirs) / power(mine);
  return r >= OUTMATCHED_AT ? 'outmatched' : r <= WEAKER_AT ? 'weaker' : 'even';
}

/** The player's ship as it is now: working guns, shield layers its generators give, hull plates (walls and doors) standing (`hullTiles`, also what engine capacity measures). */
export function playerStrength(sim: Sim): UiStrength | null {
  const id = playerShip(sim);
  const grid = id ? shipGrid(sim, id) : null;
  if (!id || !grid) return null;
  let guns = 0;
  for (const mid of sim.world.query(ModuleC)) {
    const m = sim.world.get(mid, ModuleC);
    if (m && m.hp > 0 && sim.content.modules[m.def]?.weapon && shipIdOf(sim, m) === id) guns++;
  }
  return { guns, shields: shieldCapacity(sim, id, false), hull: hullTiles(grid) };
}

/**
 * What a ship of this (shipgen, seed, depth) will have when it appears: generated the way `spawnContact` does it (same faction generator, same
 * seed and depth), then read off its layout: guns, shield layers and hull plates. A pure function of the key, so it is cached; null if it cannot be generated.
 */
export function targetStrength(sim: Sim, shipgen: string, seed: number, depth: number): UiStrength | null {
  let memo = cache.get(sim.content);
  if (!memo) cache.set(sim.content, (memo = new Map()));
  const key = `${shipgen}|${seed}|${depth}`;
  if (memo.has(key)) return memo.get(key) ?? null;
  let out: UiStrength | null = null;
  const def = sim.content.factions?.[shipgen];
  if (def) {
    try {
      const gen = generateShip(def, shipgen, seed, depth, sim.content.modules);
      let guns = 0;
      let shields = 0;
      for (const m of gen.template.modules ?? []) {
        const md = sim.content.modules[m.def];
        if (md?.weapon) guns++;
        if (md?.shieldGen) shields += Math.floor(Math.abs(md.power) * md.shieldGen.layersPerPower);
      }
      const hull = gen.template.rows.reduce((n, row) => n + [...row].filter((c) => c === '#' || c === 'D').length, 0);
      out = { guns, shields, hull };
    } catch {
      out = null;
    }
  }
  memo.set(key, out);
  if (memo.size > CACHE_MAX) memo.delete(memo.keys().next().value as string);
  return out;
}
