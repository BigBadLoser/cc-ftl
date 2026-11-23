import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../../sim/registry';
import { equipmentOf, equipmentShort } from '../../sim/shipgen/equipment';
import { builtFamily, generateShip, previewHull } from '../../sim/shipgen/generate';
import type { FactionDef, GenResult } from '../../sim/shipgen/types';
import { content } from '../index';
import { factions } from './index';

// The plan's equipment is required and a seed builds one family (#577). The sweep is shipgen.equipment.slow.test.ts.
const defs = content.modules as Record<string, ModuleDef>;
const ids = Object.keys(factions) as (keyof typeof factions)[];
const gen = (id: keyof typeof factions, seed: number, depth: number): GenResult => generateShip(factions[id] as FactionDef, id, seed, depth, defs);

describe('ship generator: planned equipment and family (#577)', () => {
  it('every faction carries the guns, shields, point defence and bays its plan asked for, as the family its seed previews', () => {
    for (const id of ids) {
      const g = gen(id, 4242, 4);
      expect(g.problems, id).toEqual([]);
      expect(g.planned, id).toBeDefined();
      expect(equipmentShort(defs, g.planned!, g.template), id).toBeNull();
      expect(builtFamily(g), id).toBe(previewHull(factions[id] as FactionDef, 4242, 4));
    }
  });

  it('navy seed 689483036 at depth 0 previews a corvette and builds one (it used to build a frigate on a reseed)', () => {
    const g = gen('faction.navy', 689483036, 0);
    expect(previewHull(factions['faction.navy'] as FactionDef, 689483036, 0)).toBe('corvette');
    expect(g.role).toBe('corvette');
    expect(g.problems).toEqual([]);
  });

  it('a forked drone lancer keeps its guns (half-tile prongs used to stamp its pods away)', () => {
    const g = gen('faction.drones', 1013904232, 0);
    expect(g.role).toBe('lancer');
    expect(g.topology).toMatch(/fork|twin/);
    const got = equipmentOf(defs, (g.template.modules ?? []).map((m) => m.def));
    expect(got.guns).toBeGreaterThan(0);
    expect(got.pointDefense).toBeGreaterThan(0);
  });

  it('names what a template lacks against its plan', () => {
    const planned = { guns: 3, pointDefense: 0, shieldGens: 1, shieldConsoles: 1, droneBays: 0, vehicleBays: 0 };
    expect(equipmentShort(defs, planned, { modules: [{ def: 'module.burstLaser', x: 0, y: 0, rot: 0 }, { def: 'module.shieldConsole', x: 0, y: 0, rot: 0 }] }))
      .toBe('short of 2 guns, 1 shieldGens');
  });
});
