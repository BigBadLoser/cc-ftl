import { describe, expect, it } from 'vitest';
import { ShipC, generateShip, newGame, stampShip, type FactionDef, type ModuleDef } from '../../sim';
import { applyRuin } from '../../sim/combat/derelict';
import { shipGrid } from '../../sim/regions';
import { ruin } from '../../sim/shipgen/ruin';
import { LIGHT_DARK_BELOW, WRECK_LIGHT_SCALE } from '../../sim/tuning';
import { content } from '../index';
import { factions } from './index';

const defs = content.modules as Record<string, ModuleDef>;

function lightOf(power: 'off' | 'emergency' | 'live'): { max: number; lit: number } {
  const g = generateShip(factions['faction.civilian'] as FactionDef, 'faction.civilian', 3, 1, defs);
  const sim = newGame(1, content);
  const ship = stampShip(sim, g.template, { faction: 'hostile', x: 300, y: 60, state: 'active' });
  if (power !== 'live') {
    const r = ruin(g.template, 3, { defs, intensity: 0.1, cause: 'decay' });
    r.meta.power = power;
    for (const m of r.meta.modules) { m.hp = 1; m.state = 'intact'; }
    applyRuin(sim, ship, g.template, r.meta);
  }
  for (let i = 0; i < 5; i++) sim.step();
  expect(sim.world.get(ship, ShipC)?.state === 'wreck').toBe(power !== 'live');
  const grid = shipGrid(sim, ship)!;
  const light = grid.load('light');
  let max = 0, lit = 0;
  for (const v of light) { max = Math.max(max, v); if (v > 0) lit++; }
  return { max, lit };
}

describe('wreck lighting', () => {
  it('has no light without power, and only dim emergency light with it', () => {
    const live = lightOf('live');
    const emergency = lightOf('emergency');
    const off = lightOf('off');
    expect(live.max).toBeGreaterThan(150);
    expect(off.max).toBe(0);
    expect(emergency.max).toBeGreaterThan(0);
    expect(emergency.max).toBeLessThanOrEqual(Math.ceil(live.max * WRECK_LIGHT_SCALE));
    expect(emergency.max).toBeLessThan(LIGHT_DARK_BELOW * 3);
  });
});
