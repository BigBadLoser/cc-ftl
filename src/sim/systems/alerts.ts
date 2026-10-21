import type { Grid } from '../grid';
import { regions } from '../regions';
import { roomTiles } from '../roomIndex';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { ALERT_INTERVAL_TICKS, O2_ALERT_BELOW, O2_ALERT_CLEAR_ABOVE } from '../tuning';

interface Memory {
  breached: Set<number>;
  burning: Set<number>;
  lowO2: Set<number>;
}

/**
 * Which alerts are currently active per room, so each is announced once (debounced) and re-arms
 * when the condition clears. Output-only bookkeeping that never feeds back into the sim, so it is
 * not saved: after a load an ongoing alert may be announced once more.
 */
const memory = new WeakMap<Grid, Memory>();

/** Raise hull.breach, fire.started and o2.low once per room as conditions start (every few ticks). */
export function alertsSystem(sim: Sim): void {
  if (sim.tick % ALERT_INTERVAL_TICKS !== 0) return;
  for (const { grid, ship } of regions(sim)) {
    if (!grid.has('room') || !grid.has('o2') || !grid.has('fire')) continue;
    let mem = memory.get(grid);
    if (!mem) memory.set(grid, (mem = { breached: new Set(), burning: new Set(), lowO2: new Set() }));
    scan(sim, grid, ship, mem);
  }
}

function scan(sim: Sim, grid: Grid, ship: number, mem: Memory): void {
  const { width, height } = grid;
  const struct = grid.load('struct');
  const fire = grid.load('fire');
  const room = grid.load('room');
  const o2 = grid.load('o2');
  const breached = new Set<number>();
  const burning = new Map<number, number>();
  for (let i = 0; i < struct.length; i++) {
    const r = room[i] as number;
    if (r === 0) continue;
    const x = i % width;
    const y = (i - x) / width;
    if (
      (x > 0 && struct[i - 1] === Struct.Space) || (x < width - 1 && struct[i + 1] === Struct.Space) ||
      (y > 0 && struct[i - width] === Struct.Space) || (y < height - 1 && struct[i + width] === Struct.Space)
    ) breached.add(r);
    if ((fire[i] as number) > 0 && !burning.has(r)) burning.set(r, i);
  }
  for (const r of breached) {
    if (!mem.breached.has(r)) sim.events.emit({ type: 'hull.breach', ship, room: r });
  }
  for (const [r, i] of burning) {
    if (!mem.burning.has(r)) {
      const x = i % width;
      sim.events.emit({ type: 'fire.started', ship, room: r, x: grid.x0 + x, y: grid.y0 + (i - x) / width });
    }
  }
  mem.breached = breached;
  mem.burning = new Set(burning.keys());

  for (const [r, tiles] of roomTiles(grid)) {
    let sum = 0;
    for (const i of tiles) sum += o2[i] as number;
    const avg = sum / tiles.length;
    if (avg < O2_ALERT_BELOW && !mem.lowO2.has(r)) {
      mem.lowO2.add(r);
      sim.events.emit({ type: 'o2.low', ship, room: r, o2: avg });
    } else if (avg > O2_ALERT_CLEAR_ABOVE) {
      mem.lowO2.delete(r);
    }
  }
}
