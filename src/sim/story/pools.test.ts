import { describe, expect, it } from 'vitest';
import type { EventDef } from './defs';
import { drawEvent, poolFor, pump } from './engine';
import { TICK_HZ } from '../time';
import { spawnShip } from '../combat/ships';
import type { SimEvent } from '../events';
import { createCrew } from '../crew/spawn';
import type { ContentRegistry, ModuleDef } from '../registry';
import { Sim } from '../sim';

import { storageAdd } from '../items/storage';
import { ModuleC } from '../modules/components';
import { StorageC } from '../items/components';


const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'Crate', asset: 'm', footprint: [1, 1], solid: true, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const item = (name: string, stackSize = 100) => ({ name, tags: [], stackSize });
const all = { firefighting: 2, medical: 2, operating: 2, repair: 2, construction: 2, hauling: 2, refining: 2, crafting: 2, research: 2, cooking: 2, patrol: 0 };

export const baseContent = (events: Record<string, EventDef>): ContentRegistry => ({
  ships: {},
  roles: {
    'role.engineer': { name: 'Engineer', priorities: all, skills: { repair: 6 } },
    'role.rookie': { name: 'Rookie', priorities: all, skills: { repair: 1 } },
    'role.bot': { name: 'Bot', priorities: all, species: 'species.robot' },
  },
  species: {
    'species.human': { name: 'Human', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 },
    'species.robot': { name: 'Robot', moveSpeed: 2, workSpeed: 1, restDecay: 0, airless: true },
  },
  modules: { 'module.crate': mod({ storage: { capacity: 4 }, access: [0, 1] }) },
  crewNames: ['Mara', 'Joss', 'Tek'],
  items: { 'item.scrap': item('Scrap'), 'item.parts': item('Spare parts'), 'item.metal': item('Metal') },
  recipes: {},
  structCosts: {},
  events,
});

const rows = ['##########', '#________#', '#________#', '#________#', '##########'];

/** A sim with the player's ship (grid 1, one crate) and crew of the given roles. */
export function storySim(events: Record<string, EventDef>, roles: string[] = ['role.engineer', 'role.rookie'], seed = 7): Sim {
  const sim = new Sim(seed, baseContent(events));
  spawnShip(sim, { name: 'P', rows, modules: [{ def: 'module.crate', x: 7, y: 1, rot: 0 }] }, { faction: 'player', x: 0, y: 0 });
  roles.forEach((r, i) => createCrew(sim, 1, r, { x: 1 + i, y: 2 }, { faction: 'player', name: i === 0 ? 'Mara' : `C${i}` }));
  return sim;
}

export const crate = (sim: Sim): number => sim.world.query(StorageC, ModuleC)[0] as number;
export const give = (sim: Sim, itemId: string, n: number): void => void storageAdd(sim, crate(sim), itemId, n);
export const run = (sim: Sim, ticks = 1): void => {
  for (let i = 0; i < ticks; i++) sim.step();
};

const notice = (extra: Partial<EventDef>): EventDef => ({ title: 'N', text: 'n', mode: 'notice', triggers: [{ kind: 'transit', weight: 1 }], ...extra });
const decision = (extra: Partial<EventDef>): EventDef => ({
  title: 'D', text: 'd', mode: 'decision', triggers: [{ kind: 'transit', weight: 1 }], choices: [{ id: 'ok', label: 'ok', outcome: {} }], ...extra,
});

describe('pools', () => {
  it('filters by danger tier and faction territory', () => {
    const sim = storySim({
      any: notice({}),
      calm: notice({ danger: { max: 1 } }),
      hot: notice({ danger: { min: 2 } }),
      corp: notice({ factions: ['corp'] }),
      open: notice({ factions: [null] }),
      chain: notice({ triggers: [{ kind: 'chain' }] }),
      flagged: notice({ triggers: [{ kind: 'flag', flag: 'f' }] }),
    });
    const ids = (): string[] => poolFor(sim, 'transit').map((p) => p.id);
    expect(ids()).toEqual(['any', 'calm', 'open']);
    sim.story.context = { danger: 3, faction: 'corp' };
    expect(ids()).toEqual(['any', 'hot', 'corp']);
  });

  it('respects eligibility, once and cooldown', () => {
    const sim = storySim({
      needsFlag: notice({ eligible: [{ kind: 'flag', flag: 'x' }] }),
      once: notice({ once: true }),
      cool: notice({ cooldownSec: 10 }),
    });
    expect(poolFor(sim, 'transit').map((p) => p.id)).toEqual(['once', 'cool']);
    sim.story.flags['x'] = 1;
    expect(poolFor(sim, 'transit').map((p) => p.id)).toEqual(['needsFlag', 'once', 'cool']);
    sim.story.seen['once'] = { count: 1, last: 0 };
    sim.story.seen['cool'] = { count: 1, last: 0 };
    expect(poolFor(sim, 'transit').map((p) => p.id)).toEqual(['needsFlag']);
    run(sim, 10 * TICK_HZ);
    expect(poolFor(sim, 'transit').map((p) => p.id)).toEqual(['needsFlag', 'cool']);
  });

  it('sums trigger weights and draws in proportion, deterministically', () => {
    const ev = { heavy: notice({ triggers: [{ kind: 'transit', weight: 3 }] }), light: notice({ triggers: [{ kind: 'transit', weight: 1 }] }) };
    const counts = (seed: number): Record<string, number> => {
      const sim = storySim(ev, [], seed);
      const out: Record<string, number> = { heavy: 0, light: 0 };
      for (let i = 0; i < 400; i++) out[drawEvent(sim, 'transit') as string]!++;
      return out;
    };
    const a = counts(5);
    expect(counts(5)).toEqual(a);
    expect(a['heavy']! / 400).toBeGreaterThan(0.68);
    expect(a['heavy']! / 400).toBeLessThan(0.82);
  });

  it('returns null from an empty pool', () => {
    expect(drawEvent(storySim({}), 'transit')).toBeNull();
  });
});

describe('triggers over time', () => {
  it('nothing is drawn on its own: a long idle stretch starts no event', () => {
    const sim = storySim({ d: decision({}), n: notice({}) });
    run(sim, 1200 * TICK_HZ);
    expect(sim.story.active).toBeNull();
    expect(sim.story.seen).toEqual({});
  });

  it('a flag-queued decision waits for hyperspace, then opens', () => {
    const sim = storySim({ d: decision({ triggers: [{ kind: 'flag', flag: 'f' }] }) });
    sim.story.queue.push({ event: 'd', due: 0 });
    run(sim, 60 * TICK_HZ);
    expect(sim.story.active).toBeNull();
    expect(sim.story.queue).toHaveLength(1);
    sim.sector.state = 'hyperspace';
    pump(sim);
    expect(sim.story.active?.event).toBe('d');
  });

  it('a transit draw uses the pool for the context', () => {
    const sim = storySim({
      a: notice({ triggers: [{ kind: 'transit', weight: 1 }], factions: ['corp'] }),
      b: notice({ triggers: [{ kind: 'transit', weight: 1 }], factions: ['pirates'] }),
    });
    sim.enqueue({ type: 'story.setContext', danger: 2, faction: 'pirates' });
    run(sim);
    drawEvent(sim, 'transit');
    expect(Object.keys(sim.story.seen)).toEqual(['b']);
  });
});

describe('notices', () => {
  it('a notice applies its effects and is announced; a lead opens its decision; leads lapse', () => {
    const sim = storySim({
      lead: notice({ lead: 'd', expireSec: 5, effects: [{ type: 'flag', flag: 'saw' }] }),
      d: decision({ triggers: [{ kind: 'chain' }] }),
    });
    const events: SimEvent[] = [];
    sim.enqueue({ type: 'story.fire', event: 'lead' });
    run(sim);
    events.push(...sim.events.drain());
    const started = events.find((e) => e.type === 'story.started');
    expect(started).toMatchObject({ event: 'lead', mode: 'notice' });
    expect(sim.story.flags['saw']).toBe(1);
    expect(sim.story.active).toBeNull();
    const id = sim.story.notices[0]?.id as number;
    sim.enqueue({ type: 'story.openNotice', notice: id });
    run(sim);
    expect(sim.story.active?.event).toBe('d');
    expect(sim.story.notices).toHaveLength(0);

    sim.enqueue({ type: 'story.fire', event: 'lead' });
    run(sim, 6 * TICK_HZ);
    expect(sim.story.notices).toHaveLength(0);
  });

  it('dismissing a notice drops it', () => {
    const sim = storySim({ lead: notice({ lead: 'x' }), x: decision({}) });
    sim.enqueue({ type: 'story.fire', event: 'lead' });
    run(sim);
    sim.enqueue({ type: 'story.dismissNotice', notice: sim.story.notices[0]?.id as number });
    run(sim);
    expect(sim.story.notices).toHaveLength(0);
  });
});
