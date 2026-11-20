import { describe, it } from 'vitest';
import { homeShip } from '../../sim/combat/shipQuery';
import { CrewC, DownedC, HealthC, NeedsC } from '../../sim/crew/components';
import { SuitC } from '../../sim/eva/components';
import type { SimEvent } from '../../sim/events';
import { ModuleC } from '../../sim/modules/components';
import { newGame, startingRoles } from '../../sim/newGame';
import { shipGrid } from '../../sim/regions';
import { Struct } from '../../sim/structure';
import { HOUR_TICKS } from '../../sim/clock';
import { O2_HARM_BELOW, O2_LOW_WORK_BELOW, CO2_HARM_ABOVE } from '../../sim/tuning';
import { content } from '../index';
import { run } from '../../../test/support/run';

/**
 * Air budget (a tuning readout, not a claim yet): the starter ship full of air, five crew, life support switched off. How long until
 * the air turns bad? Prints a row per few game hours.
 */
describe('air budget', () => {
  it('five crew, no life support: how long the air lasts', { timeout: 1_800_000 }, () => {
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
    const mark = (k: string, h: number): void => { if (!firsts.has(k)) firsts.set(k, h); };
    const lines = [`starter ship: ${tiles.length} tiles with air at the start, ${crew.length} crew, ${off} life support module(s) off`, 'hour   meanO2  minO2  meanCO2  hurt  down  suited  minHp  hunger'];
    const events: SimEvent[] = [];
    for (let h = 1; h <= 420; h++) {
      // Fed every hour: this measures air, not food (the starter ship's stores run out first).
      for (const c of crew) { const n = sim.world.get(c, NeedsC); if (n && n.hunger !== undefined) n.hunger = 100; }
      events.push(...run(sim, HOUR_TICKS));
      const a = air();
      const hurt = crew.filter((c) => (sim.world.get(c, HealthC)?.hp ?? 0) < (sim.world.get(c, HealthC)?.max ?? 0)).length;
      const down = crew.filter((c) => sim.world.has(c, DownedC) || !sim.world.has(c, CrewC)).length;
      const suited = crew.filter((c) => sim.world.has(c, SuitC)).length;
      if (a.o2 < O2_LOW_WORK_BELOW) mark(`mean O2 < ${O2_LOW_WORK_BELOW} (work slows, alert)`, h);
      if (a.o2 < O2_HARM_BELOW) mark(`mean O2 < ${O2_HARM_BELOW} (harm)`, h);
      if (a.co2 > CO2_HARM_ABOVE) mark(`mean CO2 > ${CO2_HARM_ABOVE} (harm)`, h);
      if (hurt) mark('first crew hurt', h);
      if (down) mark('first crew down', h);
      const minHp = Math.min(...crew.map((c) => sim.world.get(c, HealthC)?.hp ?? 0));
      const hunger = crew.reduce((n, c) => n + (sim.world.get(c, NeedsC)?.hunger ?? 100), 0) / crew.length;
      if (h % 24 === 0 || h === 1 || (hurt > 0 && h % 8 === 0)) lines.push(`${String(h).padStart(4)}  ${a.o2.toFixed(2).padStart(7)} ${a.min.toFixed(2).padStart(6)} ${a.co2.toFixed(2).padStart(8)} ${String(hurt).padStart(5)} ${String(down).padStart(5)} ${String(suited).padStart(7)} ${minHp.toFixed(0).padStart(6)} ${hunger.toFixed(0).padStart(7)}`);
      if (down === crew.length) break;
    }
    const alerts = events.filter((e) => e.type === 'o2.low').length;
    lines.push('', ...[...firsts].map(([k, h]) => `${k}: game hour ${h}`), `o2.low events: ${alerts}`);
    console.log(lines.join('\n'));
  });
});
