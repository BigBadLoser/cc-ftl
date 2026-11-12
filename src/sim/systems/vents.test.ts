import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import type { ContentRegistry, ModuleDef } from '../registry';
import { shipGrid } from '../regions';
import { spawnTemplateModules } from '../ship';
import { Sim } from '../sim';
import { Struct, VentState, gasConductance } from '../structure';
import { VENT_CONDUCTANCE } from '../tuning';
import { ModuleC } from '../modules/components';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({ name: 'm', asset: 'm', footprint: [1, 1], solid: true, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o });
const content: ContentRegistry = {
  ships: {}, roles: {}, species: {}, crewNames: [], items: {}, recipes: {}, structCosts: {},
  modules: { reactor: mod({ power: 20 }) },
};
// Two 3x3 rooms joined by a door at (5, 3).
const rows = ['...........', '.#########.', '.#___#___#.', '.#___D___#.', '.#___#___#.', '.#########.', '...........'];
const D = { x: 5, y: 3 };

function make(powered = true): Sim {
  const sim = new Sim(5, content);
  stampShip(sim, { name: 't', rows }, { faction: 'player', state: 'prize', x: 0, y: 0 });
  if (powered) spawnTemplateModules(sim, 1, { name: 't', rows, modules: [{ def: 'reactor', x: 7, y: 4, rot: 0 }] });
  return sim;
}
const grid = (sim: Sim) => shipGrid(sim, 1)!;
const run = (sim: Sim, n: number) => { for (let i = 0; i < n; i++) sim.step(); };
const vent = (sim: Sim) => grid(sim).get('vent', D.x, D.y);
function fill(sim: Sim, x0: number, x1: number, o2: number): void {
  for (let y = 2; y <= 4; y++) for (let x = x0; x <= x1; x++) grid(sim).set('o2', x, y, o2);
}
const avg = (sim: Sim, x0: number, x1: number): number => {
  let s = 0;
  for (let y = 2; y <= 4; y++) for (let x = x0; x <= x1; x++) s += grid(sim).get('o2', x, y);
  return s / 9;
};
const setOpen = (sim: Sim, open = true): void => {
  sim.enqueue({ type: 'door.vent', ship: 1, x: D.x, y: D.y, open });
  sim.step();
};

describe('door vents', () => {
  it('conducts a fraction of an open door, and only when asked (fire, heat and smoke ask without)', () => {
    expect(gasConductance(Struct.Door, 0)).toBe(0);
    expect(gasConductance(Struct.Door, 0, true)).toBe(VENT_CONDUCTANCE);
    expect(gasConductance(Struct.Door, 255, true)).toBe(1);
    expect(VENT_CONDUCTANCE).toBeLessThan(1);
  });

  it('a closed vent seals the shut door', () => {
    const sim = make();
    fill(sim, 2, 4, 15);
    fill(sim, 6, 8, 21);
    run(sim, 400);
    expect(vent(sim)).toBe(VentState.Closed);
    expect(avg(sim, 2, 4)).toBeCloseTo(15, 1);
    expect(avg(sim, 6, 8)).toBeCloseTo(21, 1);
  });

  it('air evens out through an open vent while the door stays shut', () => {
    const sim = make();
    fill(sim, 2, 4, 15);
    fill(sim, 6, 8, 21);
    setOpen(sim);
    expect(vent(sim)).toBe(VentState.Open);
    run(sim, 1200);
    expect(grid(sim).get('door', D.x, D.y)).toBe(0);
    expect(avg(sim, 2, 4)).toBeGreaterThan(17.5);
    expect(avg(sim, 6, 8)).toBeLessThan(18.5);
    expect(Math.abs(avg(sim, 2, 4) - avg(sim, 6, 8))).toBeLessThan(0.6);
  });

  it('closing the vent seals it again', () => {
    const sim = make();
    setOpen(sim);
    setOpen(sim, false);
    expect(vent(sim)).toBe(VentState.Closed);
  });

  const hazards: [string, (sim: Sim) => void][] = [
    ['fire', (s) => grid(s).set('fire', 4, 3, 120)],
    ['smoke', (s) => grid(s).set('smoke', 6, 3, 40)],
    ['vacuum or thin air', (s) => fill(s, 6, 8, 3)],
    ['heat', (s) => grid(s).set('temp', 4, 3, 90)],
    ['cold', (s) => grid(s).set('temp', 6, 3, -40)],
    ['toxic air', (s) => grid(s).set('co2', 6, 3, 30)],
  ];
  for (const [name, apply] of hazards) {
    it(`shuts on ${name} on either side and reopens when it clears`, () => {
      const sim = make();
      setOpen(sim);
      expect(vent(sim)).toBe(VentState.Open);
      apply(sim);
      sim.step();
      expect(vent(sim)).toBe(VentState.HeldHazard);
      // the player's setting survives: clear the hazard and it reopens by itself
      const g = grid(sim);
      for (let y = 2; y <= 4; y++) {
        for (let x = 2; x <= 8; x++) {
          g.set('fire', x, y, 0); g.set('smoke', x, y, 0); g.set('temp', x, y, 20); g.set('co2', x, y, 0.04); g.set('o2', x, y, 21);
        }
      }
      sim.step();
      expect(vent(sim)).toBe(VentState.Open);
    });
  }

  it('fails shut without power and opens by itself when power returns', () => {
    const sim = make(false);
    setOpen(sim);
    expect(vent(sim)).toBe(VentState.HeldNoPower);
    spawnTemplateModules(sim, 1, { name: 't', rows, modules: [{ def: 'reactor', x: 7, y: 4, rot: 0 }] });
    run(sim, 2);
    expect(vent(sim)).toBe(VentState.Open);
    const id = sim.world.query(ModuleC)[0] as number;
    (sim.world.get(id, ModuleC) as { enabled: boolean }).enabled = false;
    run(sim, 2);
    expect(vent(sim)).toBe(VentState.HeldNoPower);
  });

  it('a held vent lets no air through', () => {
    const sim = make(false);
    fill(sim, 2, 4, 15);
    fill(sim, 6, 8, 21);
    setOpen(sim);
    run(sim, 400);
    expect(avg(sim, 2, 4)).toBeCloseTo(15, 1);
  });

  it('rejects a vent on a wall', () => {
    const sim = make();
    sim.enqueue({ type: 'door.vent', ship: 1, x: 4, y: 3, open: true });
    sim.step();
    expect(grid(sim).get('vent', 4, 3)).toBe(0);
  });
});
