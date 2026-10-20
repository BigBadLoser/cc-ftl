import { CrewC, DeadC, PositionC } from '../crew/components';
import type { Grid } from '../grid';
import { ModuleC } from '../modules/components';
import { airlockTiles, airlockWorking } from '../modules/airlock';
import { AirlockC, type Airlock } from '../modules/airlock';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { gridIdOf, shipIdOf } from '../regions';

/**
 * Airlock cycling. The two doors are never open together. A requested side only starts to cycle once the doorway that
 * is open now is clear of crew. During a cycle both doors are shut and the chamber's air is pumped between the chamber
 * and the ship tile inside the inner door, so the ship loses nothing when crew pass. An unpowered or broken airlock
 * freezes mid-cycle with both doors shut (it is closed rather than open to space). Runs after the doors system, which
 * leaves airlock doors alone.
 */
export function airlockSystem(sim: Sim): void {
  for (const id of sim.world.query(AirlockC, ModuleC)) {
    const a = sim.world.get(id, AirlockC) as Airlock;
    const m = sim.world.get(id, ModuleC)!;
    const def = sim.content.modules[m.def];
    const grid = sim.grids.get(gridIdOf(sim, m));
    if (!def?.airlock || !grid) continue;
    const t = airlockTiles(def, m);
    const working = airlockWorking(sim, id);

    if (a.state === 'toOuter' || a.state === 'toInner') {
      setDoors(grid, t, null);
      if (!working) continue;
      pump(grid, t, a.state === 'toOuter', a.timer, !!def.airlock.layout);
      a.timer--;
      if (a.timer <= 0) {
        a.timer = 0;
        a.state = a.state === 'toOuter' ? 'outer' : 'inner';
        sim.events.emit({ type: 'airlock.cycled', ship: shipIdOf(sim, m), module: id, side: a.state });
      }
    } else if (a.request && a.request !== a.state && working && (def.airlock.layout || !occupied(sim, gridIdOf(sim, m), a.state === 'inner' ? t.inner : t.outer))) {
      a.state = a.request === 'outer' ? 'toOuter' : 'toInner';
      a.timer = Math.max(1, Math.round(def.airlock.cycleSec * TICK_HZ));
      a.request = null;
      setDoors(grid, t, null);
      continue;
    }
    if (a.request === a.state) a.request = null;
    if (a.state === 'inner' || a.state === 'outer') setDoors(grid, t, a.state);
  }
}

/** Open the given side's door and shut the other; null shuts both. */
function setDoors(grid: Grid, t: ReturnType<typeof airlockTiles>, open: 'inner' | 'outer' | null): void {
  setDoor(grid, t.inner, open === 'inner' ? 255 : 0);
  setDoor(grid, t.outer, open === 'outer' ? 255 : 0);
}

function setDoor(grid: Grid, p: { x: number; y: number }, value: number): void {
  if (grid.get('door', p.x, p.y) !== value) grid.set('door', p.x, p.y, value);
}

/**
 * Move one tick's share of chamber air. Out: every chamber tile (and the outer door tile) hands its gas to the tile inside the inner door.
 * In: the chamber draws up to the inside tile's level from it. Mass moves tile to tile, so nothing is lost.
 */
function pump(grid: Grid, t: ReturnType<typeof airlockTiles>, out: boolean, remaining: number, layout: boolean): void {
  const share = 1 / Math.max(1, remaining);
  // A docking airlock has no chamber: its two door tiles (pod and hull hatch) are the lock, so crew waiting in either
  // one never hold up a cycle (they ride it out between the shut doors).
  const lock = layout ? [t.outer, t.inner] : [t.outer, ...t.chamber];
  for (const field of ['o2', 'co2'] as const) {
    for (const c of lock) {
      const have = grid.get(field, c.x, c.y);
      const inside = grid.get(field, t.inside.x, t.inside.y);
      const move = out ? have * share : Math.max(0, inside - have) * share;
      if (move <= 0) continue;
      grid.set(field, c.x, c.y, have + (out ? -move : move));
      grid.set(field, t.inside.x, t.inside.y, inside + (out ? move : -move));
    }
  }
}

function occupied(sim: Sim, gridId: number, tile: { x: number; y: number }): boolean {
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (sim.world.has(id, DeadC)) continue;
    const p = sim.world.get(id, PositionC)!;
    if (gridIdOf(sim, p) === gridId && ((p.x === tile.x && p.y === tile.y) || (p.toX === tile.x && p.toY === tile.y))) return true;
  }
  return false;
}
