import { describe, expect, it } from 'vitest';
import { CrewC, DownedC } from '../sim/crew/components';
import { bleedOutMult, healMult } from '../sim/crew/body';
import { implantTier, isNamedImplant } from '../sim/crew/implants';
import { fitImplant } from '../sim/crew/surgeryOutcome';
import { operationsOf, surgeryChance } from '../sim/crew/surgery';
import { playerCrew } from '../sim/story/world';
import type { Sim } from '../sim/sim';
import { cachedNewGame } from '../../test/support/content';
import { cachedScenario } from '../../test/support/scenario';
import { play } from './scenario';
import { pickCrew } from './scenario/lib/crewPick';

const human = (sim: Sim): number => playerCrew(sim).filter((id) => sim.world.get(id, CrewC)?.species === 'species.human')[0] as number;
const implants = (sim: Sim) => Object.entries(sim.content.items).flatMap(([id, item]) => (item.implant ? [{ id, def: item.implant, item }] : []));
/** The Mk lines: an item id minus its trailing tier digit. */
const line = (id: string): string => id.replace(/_\d$/, '');

describe('Mk tiers and named cyberware (#626)', () => {
  it('every Mk line has Mk I, II and III', () => {
    const sim = cachedNewGame(3);
    const lines = new Map<string, Set<number>>();
    for (const { id, def } of implants(sim)) if (!isNamedImplant(def)) lines.set(line(id), (lines.get(line(id)) ?? new Set()).add(def.tier as number));
    expect(lines.size).toBeGreaterThan(10);
    for (const [name, tiers] of lines) expect([name, [...tiers].sort()]).toEqual([name, [1, 2, 3]]);
  });

  it('named cyberware has no Mk tier and no Mk in its name', () => {
    const sim = cachedNewGame(3);
    const named = implants(sim).filter((d) => isNamedImplant(d.def));
    expect(named.map((n) => n.id).sort()).toEqual(['item.chip_coprocessor', 'item.halcyon_heart']);
    for (const n of named) {
      expect(n.def.tier).toBeUndefined();
      expect(n.item.tier).toBeUndefined();
      expect(n.item.name).not.toMatch(/Mk/);
    }
    for (const { def } of implants(sim)) if (!isNamedImplant(def)) expect(def.tier).toBeDefined();
  });

  it('named pieces operate as Mk III and are never picked for an urgent replacement', () => {
    const sim = cachedNewGame(3);
    const [surgeon, patient] = playerCrew(sim).filter((id) => sim.world.has(id, CrewC)) as [number, number];
    expect(implantTier(sim.content.items['item.halcyon_heart']?.implant)).toBe(3);
    const chance = (item: string): number => surgeryChance(sim, surgeon, patient, { kind: 'fit', part: 'part.heart', item }, 'rig');
    expect(chance('item.halcyon_heart')).toBe(chance('item.cyber_heart_3'));
    expect(chance('item.halcyon_heart')).toBeLessThan(chance('item.cyber_heart_1'));
    const built = cachedScenario('surgery'); // the hold holds a Mk I heart and the Halcyon Heart
    const pilot = pickCrew(built.sim, 2)!;
    built.sim.enqueue({ type: 'debug.setCrew', id: pilot, injuries: [{ part: 'part.heart', kind: 'injury.organ_damage', as: 'destroyed' }] });
    play(built, 20);
    expect(built.sim.world.has(pilot, DownedC)).toBe(true);
    expect(operationsOf(built.sim, pilot)[0]?.item).toBe('item.cyber_heart_1');
  });

  it("Halcyon Heart's bleed-out x4 and healing x2 take effect", () => {
    const sim = cachedNewGame(3);
    const id = human(sim);
    const [bleed, heal] = [bleedOutMult(sim, id), healMult(sim, id)];
    fitImplant(sim, id, 'part.heart', 'item.halcyon_heart');
    expect(bleedOutMult(sim, id)).toBeCloseTo(bleed * 4, 6);
    expect(healMult(sim, id)).toBeCloseTo(heal * 2, 6);
  });
});
