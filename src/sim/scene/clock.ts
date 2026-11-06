import { ShipC } from '../combat/components';
import { hash32, strHash } from '../galaxy/hash';
import { ModuleC } from '../modules/components';
import { shipGrid } from '../regions';
import { Rng } from '../rng';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { TICK_HZ } from '../time';
import { FIRE_START_INTENSITY } from '../tuning';
import type { SceneShip, SceneSpec, SceneTimer } from './types';

/**
 * Scene timers that act on the world (DESIGN.md "Physical encounters", timers; "Distress freighter": the reactor fires, then it blows). A timer is a
 * condition, not a script: about the ship it names, it stops for good once that ship's failing systems are mended (`stopOn: 'repaired'`), breaks out
 * fires aboard it as it runs down (`fires`: in the last `leadSec`, a wave every `everySec`, each one fire larger, at most `max`), and at zero does its
 * `due` (`wreck`: every power source aboard is destroyed, and the ship-state system makes it a wreck, as any ship with no power left; whoever is still
 * aboard goes with it). Run once a second by the scene system; deterministic (the fires' tiles are rolled from the scene key, the timer and the wave).
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

/** Destroy every power source aboard (the ship-state system wrecks a ship with none left) and set the failing system's room alight. */
function blow(sim: Sim, spec: SceneSpec, t: SceneTimer, ship: number, near: { x: number; y: number } | undefined): void {
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (m && def && def.power > 0 && shipGrid(sim, ship)?.inBounds(m.x, m.y)) m.hp = 0;
  }
  ignite(sim, spec, t, ship, near, 1, 8);
}

/** Once a second in the event grid: stop, burn and blow per each timer's conditions. True when a timer stopped or came due. */
export function tendClocks(sim: Sim, spec: SceneSpec): boolean {
  let changed = false;
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
      if (t.due === 'wreck') blow(sim, spec, t, id, near);
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
