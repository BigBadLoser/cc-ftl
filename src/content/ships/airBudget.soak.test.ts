import { describe, it } from 'vitest';
import { homeShip } from '../../sim/combat/shipQuery';
import { CrewC, DownedC, HealthC, NeedsC } from '../../sim/crew/components';
import type { SimEvent } from '../../sim/events';
import { ModuleC } from '../../sim/modules/components';
import { newGame, startingRoles } from '../../sim/newGame';
import { shipGrid } from '../../sim/regions';
import { Struct, VentState } from '../../sim/structure';
import { TICK_HZ } from '../../sim/time';
import { O2_HARM_BELOW, O2_LOW_WORK_BELOW, CO2_HARM_ABOVE } from '../../sim/tuning';
import { content } from '../index';
import { run } from '../../../test/support/run';

/**
 * Air budget (a tuning readout, not a claim yet): the starter ship full of air, five crew, life support switched off. How long until
 * the air turns bad? Times are real play time at 1x speed (a game hour is GAME_HOUR_SEC, 40 s). Prints a row every 10 minutes.
 */
describe('air budget', () => {
  it('five crew, no life support, door vents shut: how long the air lasts', { timeout: 1_800_000 }, () => budget(false));
  it('five crew, no life support, every door vent open: how long the air lasts', { timeout: 1_800_000 }, () => budget(true));
});

function budget(vents: boolean): void {
  {
    const roles = startingRoles(content);
    const picks = [...roles, ...roles].slice(0, 5).map((role) => ({ role }));
    const sim = newGame(1, content, 'ship.starter', false, picks);
    const ship = homeShip(sim);
    let off = 0;
    for (const m of sim.world.query(ModuleC)) {
      const mod = sim.world.get(m, ModuleC)!;
      const def = (content.modules as Record<string, { o2PerSec?: number; co2ScrubPerSec?: number }>)[mod.def];
      if (def?.o2PerSec || def?.co2ScrubPerSec) { mod.enabled = false; off++; }
    }
    const grid = shipGrid(sim, ship)!;
    const doors: [number, number][] = [];
    for (let y = grid.y0; y < grid.y0 + grid.height; y++) for (let x = grid.x0; x < grid.x0 + grid.width; x++) if (grid.get('struct', x, y) === Struct.Door) doors.push([x, y]);
    // The player's own setting, through the command (airlock doors refuse it).
    if (vents) for (const [x, y] of doors) sim.enqueue({ type: 'door.vent', ship, x, y, open: true });
    const ventsOpen = (): number => doors.filter(([x, y]) => grid.get('vent', x, y) === VentState.Open).length;
    const tiles: [number, number][] = [];
    for (let y = grid.y0; y < grid.y0 + grid.height; y++) for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      const k = grid.get('struct', x, y);
      if ((k === Struct.Floor || k === Struct.Door) && grid.get('o2', x, y) > 0) tiles.push([x, y]);
    }
    const crew = sim.world.query(CrewC);
    const air = (): { o2: number; min: number; co2: number } => {
      let o2 = 0, co2 = 0, min = Infinity;
      for (const [x, y] of tiles) { const v = grid.get('o2', x, y); o2 += v; min = Math.min(min, v); co2 += grid.get('co2', x, y); }
      return { o2: o2 / tiles.length, min, co2: co2 / tiles.length };
    };
    const firsts = new Map<string, number>();
    const mark = (k: string, min: number): void => { if (!firsts.has(k)) firsts.set(k, min); };
    const clock = (min: number): string => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
    const lines = [`starter ship, door vents ${vents ? 'open' : 'shut'}: ${tiles.length} tiles with air at the start, ${crew.length} crew, ${off} life support module(s) off, ${doors.length} doors`, 'play   meanO2  minO2  meanCO2  hurt  down  minHp  vents'];
    const events: SimEvent[] = [];
    for (let h = 1; h <= 280; h++) {
      // Fed every minute: this measures air, not food (the starter ship's stores run out first).
      for (const c of crew) { const n = sim.world.get(c, NeedsC); if (n && n.hunger !== undefined) n.hunger = 100; }
      events.push(...run(sim, 60 * TICK_HZ)); // one real minute at 1x
      const a = air();
      const hurt = crew.filter((c) => (sim.world.get(c, HealthC)?.hp ?? 0) < (sim.world.get(c, HealthC)?.max ?? 0)).length;
      const down = crew.filter((c) => sim.world.has(c, DownedC) || !sim.world.has(c, CrewC)).length;
      if (a.o2 < O2_LOW_WORK_BELOW) mark(`mean O2 < ${O2_LOW_WORK_BELOW} (work slows, alert)`, h);
      if (a.o2 < O2_HARM_BELOW) mark(`mean O2 < ${O2_HARM_BELOW} (harm)`, h);
      if (a.co2 > CO2_HARM_ABOVE) mark(`mean CO2 > ${CO2_HARM_ABOVE} (harm)`, h);
      if (hurt) mark('first crew hurt', h);
      if (down) mark('first crew down', h);
      const minHp = Math.min(...crew.map((c) => sim.world.get(c, HealthC)?.hp ?? 0));
      if (h % 10 === 0 || (hurt > 0 && h % 2 === 0 && a.co2 > CO2_HARM_ABOVE)) lines.push(`${clock(h).padStart(5)}  ${a.o2.toFixed(2).padStart(7)} ${a.min.toFixed(2).padStart(6)} ${a.co2.toFixed(2).padStart(8)} ${String(hurt).padStart(5)} ${String(down).padStart(5)} ${minHp.toFixed(0).padStart(6)} ${String(ventsOpen()).padStart(6)}`);
      if (down === crew.length) break;
    }
    const alerts = events.filter((e) => e.type === 'o2.low').length;
    lines.push('', ...[...firsts].map(([k, m]) => `${k}: ${clock(m)} of play`), `o2.low events: ${alerts}`);
    console.log(lines.join('\n'));
  }
}
