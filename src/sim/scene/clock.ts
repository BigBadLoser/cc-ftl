import { ShipC } from '../combat/components';
import { hash32, strHash } from '../galaxy/hash';
import { ModuleC } from '../modules/components';
import { shipGrid, shipIdOf } from '../regions';
import { applyEffects, damageModule } from '../combat/effects';
import { damageStruct } from '../combat/hull';
import { rotatedSize } from '../modules/footprint';
import { Rng } from '../rng';
import type { Sim } from '../sim';
import { Struct, bordersSpace } from '../structure';
import { TICK_HZ } from '../time';
import { FIRE_START_INTENSITY } from '../tuning';
import type { SceneShip, SceneSpec, SceneTimer } from './types';

/**
 * Scene timers that act on the world (DESIGN.md "Physical encounters", timers; "Distress freighter": the reactor fires, then it blows). A timer is a
 * condition, not a script: about the ship it names, it stops for good once that ship's failing systems are mended (`stopOn: 'repaired'`), breaks out
 * fires aboard it as it runs down (`fires`: in the last `leadSec`, a wave every `everySec`, each one fire larger, at most `max`), and at zero does its
 * `due` (`wreck`: the failing system blows, `blow`: its `blast` effects at its middle, the weapon effects any hit is made of, and a hull breach beside
 * it; then every power source aboard is destroyed and the ship-state system makes it a wreck, as any ship with no power left. The wreck takes its own
 * crew; a guest party aboard lives or dies by the blast, the fire and the vacuum, combat/wreck.ts). Timers start when the player deploys. Run once a
 * second by the scene system; deterministic (the fires' tiles are rolled from the scene key, the timer and the wave).
 */

/** The scene ship a timer is about, by tag. */
export const timerShip = (spec: SceneSpec, t: SceneTimer): SceneShip | undefined => (t.ship ? spec.ships.find((s) => s.tag === t.ship) : undefined);

/** True once every module in `ids` is back at full hp (a module gone is not mended). */
export function mended(sim: Sim, ids: readonly number[] | undefined): boolean {
  return (ids ?? []).every((id) => {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    return !!m && !!def && m.hp >= def.maxHp;
  });
}

/** True while a timer still runs: it started, was not stopped, and has not come due. */
export const running = (t: SceneTimer): boolean => t.at !== undefined && !t.stopped && !t.blown;
/** True while a timer has not been stopped or come due (started or still waiting for the player to deploy). */
export const pending = (t: SceneTimer): boolean => !t.stopped && !t.blown;

/** The burnable tiles of a ship (floor and doors), nearest the first of `near` first (ties in tile order). */
function burnable(sim: Sim, ship: number, near: { x: number; y: number } | undefined): { x: number; y: number }[] {
  const grid = shipGrid(sim, ship);
  if (!grid?.has('fire')) return [];
  const out: { x: number; y: number; d: number }[] = [];
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      const k = grid.get('struct', x, y);
      if (k !== Struct.Floor && k !== Struct.Door) continue;
      out.push({ x, y, d: near ? Math.abs(x - near.x) + Math.abs(y - near.y) : 0 });
    }
  }
  return out.sort((a, b) => a.d - b.d);
}

/** One wave of fires: `n` tiles from the nearest `pool` burnable tiles around the failing system, rolled from the scene, timer and wave. */
function ignite(sim: Sim, spec: SceneSpec, t: SceneTimer, ship: number, near: { x: number; y: number } | undefined, wave: number, n: number): void {
  const grid = shipGrid(sim, ship);
  const tiles = burnable(sim, ship, near);
  if (!grid || !tiles.length) return;
  const rng = new Rng(hash32(strHash(spec.key), strHash(t.id), wave));
  const pool = tiles.slice(0, Math.min(tiles.length, 16 * wave));
  for (let i = 0; i < n && pool.length; i++) {
    const at = pool.splice(rng.int(0, pool.length - 1), 1)[0] as { x: number; y: number };
    if (grid.get('fire', at.x, at.y) < FIRE_START_INTENSITY) grid.set('fire', at.x, at.y, FIRE_START_INTENSITY);
  }
}

/** The wall tile nearest `at` that borders space (a hull wall), or null. */
function nearestHull(sim: Sim, ship: number, at: { x: number; y: number }): { x: number; y: number } | null {
  const grid = shipGrid(sim, ship);
  if (!grid) return null;
  let best: { x: number; y: number; d: number } | null = null;
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (grid.get('struct', x, y) !== Struct.Wall || !bordersSpace(grid, x, y)) continue;
      const d = Math.max(Math.abs(x - at.x), Math.abs(y - at.y));
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  return best;
}

/**
 * The failing system explodes (`SceneTimer.blast` at its middle, as a hit there; the nearest hull wall breached; a `ship.blast` event the renderer
 * shows), then the ship goes dark: every power source aboard is destroyed (the ship-state system wrecks a ship with none left).
 */
function blow(sim: Sim, spec: SceneSpec, t: SceneTimer, ship: number, failing: number | undefined): void {
  const m = failing === undefined ? undefined : sim.world.get(failing, ModuleC);
  const def = m && sim.content.modules[m.def];
  const grid = shipGrid(sim, ship);
  if (m && def && t.blast && grid) {
    const [w, h] = rotatedSize(def, m.rot);
    const at = { x: m.x + Math.floor(w / 2), y: m.y + Math.floor(h / 2) };
    applyEffects(sim, { shipId: ship, x: at.x, y: at.y, projectile: 0, weapon: '' }, t.blast);
    const wall = nearestHull(sim, ship, at);
    if (wall) damageStruct(grid, wall.x, wall.y, Infinity);
    const radius = Math.max(0, ...t.blast.map((e) => ('radius' in e ? e.radius ?? 0 : 0)));
    sim.events.emit({ type: 'ship.blast', ship, x: at.x + 0.5, y: at.y + 0.5, radius });
  } else ignite(sim, spec, t, ship, m ? { x: m.x, y: m.y } : undefined, 1, 8);
  for (const id of sim.world.query(ModuleC)) {
    const p = sim.world.get(id, ModuleC);
    const pd = p && sim.content.modules[p.def];
    if (p && pd && pd.power > 0 && p.hp > 0 && shipIdOf(sim, p) === ship) damageModule(sim, id, p.hp, ship);
  }
}

/** Start the scene's timers once the player's ship is deployed in the pocket (not while it picks its spot). True when one started. */
function startClocks(sim: Sim, spec: SceneSpec): boolean {
  if (sim.sector.state !== 'active') return false;
  let started = false;
  for (const t of spec.timers) {
    if (t.at !== undefined) continue;
    t.at = sim.tick + Math.round(t.afterSec * TICK_HZ);
    started = true;
  }
  return started;
}

/** Once a second in the event grid: start, stop, burn and blow per each timer's conditions. True when a timer started, stopped or came due. */
export function tendClocks(sim: Sim, spec: SceneSpec): boolean {
  let changed = startClocks(sim, spec);
  for (const t of spec.timers) {
    if (!running(t) || (!t.stopOn && !t.fires && !t.due)) continue;
    const s = timerShip(spec, t);
    const id = s?.contact.ship;
    const ship = id === undefined ? undefined : sim.world.get(id, ShipC);
    if (!s || id === undefined || !ship || ship.state === 'wreck' || ship.state === 'fled') continue;
    if (t.stopOn === 'repaired' && s.failing?.length && mended(sim, s.failing)) {
      t.stopped = true;
      changed = true;
      sim.events.emit({ type: 'scene.observed', rule: `${t.id}Stopped`, ship: id, text: `The ${ship.name}'s failing system is mended: the clock has stopped`, tone: 'good' });
      continue;
    }
    const m = s.failing?.length ? sim.world.get(s.failing[0] as number, ModuleC) : undefined;
    const near = m ? { x: m.x, y: m.y } : undefined;
    const at = t.at as number;
    if (sim.tick >= at) {
      if (t.due === 'wreck') blow(sim, spec, t, id, s.failing?.[0]);
      t.blown = true;
      changed = true;
      continue;
    }
    if (!t.fires) continue;
    const into = sim.tick - (at - Math.round(t.fires.leadSec * TICK_HZ));
    if (into < 0) continue;
    const wave = Math.floor(into / Math.round(t.fires.everySec * TICK_HZ)) + 1;
    if (wave <= (t.fired ?? 0)) continue;
    t.fired = wave;
    ignite(sim, spec, t, id, near, wave, Math.min(wave, t.fires.max));
  }
  return changed;
}
