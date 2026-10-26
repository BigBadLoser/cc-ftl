import { describe, expect, it } from 'vitest';
import { ModuleC, ResearchC, homeShip, isBlueprintKnown, labsOf, newGame, serialize, deserialize, stockOn, storageAdd, type ModuleDef } from '../sim';
import { content } from './index';

const modules: Record<string, ModuleDef> = content.modules;
const items: Record<string, unknown> = content.items;

describe('research content', () => {
  it('every project unlocks a blueprint module, costs real items and gates Mk III behind Mk II', () => {
    const projects = Object.entries(content.research);
    expect(projects.length).toBe(6);
    for (const [id, p] of projects) {
      expect(p.unlocks.length, id).toBeGreaterThan(0);
      for (const u of p.unlocks) expect(modules[u]?.blueprint, `${id} ${u}`).toBeDefined();
      for (const c of p.cost) expect(items[c.item], `${id} ${c.item}`).toBeDefined();
      for (const r of p.requires ?? []) expect(modules[r], `${id} ${r}`).toBeDefined();
      expect(p.work, id).toBeGreaterThan(0);
    }
    for (const fam of ['reactor', 'shieldGen', 'engine']) {
      const mk2 = content.research[`research.${fam}.mk2`];
      const mk3 = content.research[`research.${fam}.mk3`];
      expect(mk2?.requires).toBeUndefined();
      expect(mk3?.requires).toEqual([`module.${fam}.mk2`]);
      expect(mk3?.cost.length).toBeGreaterThan(mk2?.cost.length ?? 99);
    }
  });

  it('the research module is a basic blueprint, so research is reachable on day one', () => {
    const def = modules['module.research'];
    expect(def?.research).toBe(true);
    expect(def?.blueprint).toBeUndefined();
    expect(isBlueprintKnown(newGame(1, content), 'module.research')).toBe(true);
  });

  it('every role can work research but the creatures and the security bot; the scientist has science', () => {
    for (const [id, role] of Object.entries(content.roles)) {
      const none = id.startsWith('role.alien') || id === 'role.robot_security';
      expect(role.priorities.research > 0, id).toBe(!none);
    }
    expect(content.roles['role.scientist']?.skills?.science).toBe(3);
  });

  it('queues Mk II on the starter ship, pays it from stock and survives a save', () => {
    const sim = newGame(7, content);
    const ship = homeShip(sim);
    const store = sim.world.query(ModuleC).find((id) => sim.content.modules[sim.world.get(id, ModuleC)?.def ?? '']?.storage) as number;
    const s = sim.world.get(store, ModuleC);
    // Drop a research module on a free floor tile near the first storage module.
    for (let dx = -3; dx <= 3 && labsOf(sim, ship).length === 0; dx++) {
      sim.enqueue({ type: 'debug.spawnModule', ship, x: (s?.x ?? 0) + dx, y: (s?.y ?? 0) - 2, def: 'module.research', rot: 0 });
      sim.step();
    }
    expect(labsOf(sim, ship)).toHaveLength(1);
    const before = { e: stockOn(sim, ship, 'item.electronics'), p: stockOn(sim, ship, 'item.parts') };
    storageAdd(sim, store, 'item.electronics', 60);
    storageAdd(sim, store, 'item.parts', 20);
    sim.events.drain();
    sim.enqueue({ type: 'research.queue', ship, project: 'research.reactor.mk3' });
    sim.step();
    expect(sim.events.drain().map((e) => (e.type === 'command.rejected' ? e.reason : ''))).toContain('locked');
    sim.enqueue({ type: 'research.queue', ship, project: 'research.reactor.mk2' });
    for (let i = 0; i < 20; i++) sim.step();
    expect(sim.world.get(ship, ResearchC)?.paid).toBe(true);
    expect(stockOn(sim, ship, 'item.electronics')).toBe(before.e + 60 - 20);
    expect(stockOn(sim, ship, 'item.parts')).toBe(before.p + 20 - 6);
    const copy = deserialize(serialize(sim), content);
    expect(copy.world.get(ship, ResearchC)).toEqual(sim.world.get(ship, ResearchC));
  });
});
