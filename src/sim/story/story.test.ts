import { describe, expect, it } from 'vitest';
import { CrewC, DeadC, HealthC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import type { SimEvent } from '../events';
import { playerStock } from './world';
import { deserialize, serialize } from '../save';
import { TICK_HZ } from '../time';
import type { EventDef } from './defs';
import { pump } from './engine';
import { spawnShip } from '../combat/ships';
import { createCrew } from '../crew/spawn';
import type { ContentRegistry, ModuleDef } from '../registry';
import { Sim } from '../sim';
import { storageAdd, storageCount } from '../items/storage';
import { ModuleC } from '../modules/components';
import { StorageC } from '../items/components';

import { SkillXpC, ImplantsC } from './components';
import { levelsFor } from '../crew/xp';
import { checkOdds, describeRequirement, meets, unmetReasons } from './requirements';
import { playerCrew, skillOf } from './world';
import { shipIdOf } from '../regions';
import { shipIds } from '../regions';

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
    'species.human': { name: 'Human', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6, mood: true },
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

const decision = (choices: NonNullable<EventDef['choices']>, extra: Partial<EventDef> = {}): EventDef => ({
  title: 'T', text: 'x', mode: 'decision', triggers: [{ kind: 'chain' }], choices, ...extra,
});
const drain = (sim: ReturnType<typeof storySim>): SimEvent[] => sim.events.drain();
const fire = (sim: ReturnType<typeof storySim>, id: string): void => {
  sim.enqueue({ type: 'story.fire', event: id });
  run(sim);
};
const pick = (sim: ReturnType<typeof storySim>, choice: string): void => {
  sim.enqueue({ type: 'story.choose', choice });
  run(sim);
};

describe('requirements', () => {
  const sim = storySim({});
  const bot = storySim({}, ['role.engineer', 'role.bot']);

  it('checks species, skill, module, item, flag, reputation, crew, implant', () => {
    expect(meets(sim, { kind: 'species', species: 'species.robot' })).toBe(false);
    expect(meets(bot, { kind: 'species', species: 'species.robot' })).toBe(true);
    expect(meets(sim, { kind: 'skill', skill: 'repair', level: 6 })).toBe(true);
    expect(meets(sim, { kind: 'skill', skill: 'repair', level: 7 })).toBe(false);
    expect(meets(sim, { kind: 'module', def: 'module.crate' })).toBe(true);
    expect(meets(sim, { kind: 'module', def: 'module.crate', count: 2 })).toBe(false);
    give(sim, 'item.scrap', 5);
    expect(meets(sim, { kind: 'item', item: 'item.scrap', count: 5 })).toBe(true);
    expect(meets(sim, { kind: 'item', item: 'item.scrap', count: 6 })).toBe(false);
    expect(meets(sim, { kind: 'flag', flag: 'f' })).toBe(false);
    expect(meets(sim, { kind: 'flag', flag: 'f', max: 0 })).toBe(true);
    sim.story.flags['f'] = 2;
    expect(meets(sim, { kind: 'flag', flag: 'f' })).toBe(true);
    expect(meets(sim, { kind: 'flag', flag: 'f', min: 3 })).toBe(false);
    sim.story.reputation['corp'] = 2;
    expect(meets(sim, { kind: 'reputation', faction: 'corp', min: 2 })).toBe(true);
    expect(meets(sim, { kind: 'reputation', faction: 'corp', max: 1 })).toBe(false);
    expect(meets(sim, { kind: 'crew', count: 2 })).toBe(true);
    expect(meets(sim, { kind: 'crew', count: 3 })).toBe(false);
    expect(meets(sim, { kind: 'implant', implant: 'imp.eye' })).toBe(false);
    sim.world.add(playerCrew(sim)[0] as number, ImplantsC, { list: ['imp.eye'] });
    expect(meets(sim, { kind: 'implant', implant: 'imp.eye' })).toBe(true);
  });

  it('explains unmet requirements and costs', () => {
    const reasons = unmetReasons(bot, { id: 'c', label: 'c', requires: [{ kind: 'species', species: 'species.alien' }, { kind: 'skill', skill: 'repair', level: 9 }], cost: [{ item: 'item.scrap', count: 3 }] });
    expect(reasons).toEqual(['Needs a species.alien aboard', 'Needs Repair skill 9', 'Needs 3x Scrap']);
    expect(describeRequirement(bot, { kind: 'species', species: 'species.robot' })).toBe('Needs a Robot aboard');
  });

  it('ignores dead and enemy crew', () => {
    const s = storySim({});
    expect(playerCrew(s)).toHaveLength(2);
    const [a, b] = playerCrew(s) as [number, number];
    s.world.add(a, DeadC, { tick: 0 });
    s.world.add(b, AllegianceC, { faction: 'hostile' });
    expect(playerCrew(s)).toHaveLength(0);
    expect(meets(s, { kind: 'skill', skill: 'repair', level: 1 })).toBe(false);
    expect(skillOf(storySim({}), a, 'repair')).toBe(6);
  });
});

describe('skill check odds', () => {
  it('uses the best crew member, base 50% and 10% per level, clamped', () => {
    const sim = storySim({});
    const o = checkOdds(sim, { skill: 'repair', difficulty: 6 });
    expect(o?.chance).toBeCloseTo(0.5);
    expect(o?.label).toBe('Repair skill 6 (Mara): 50%');
    expect(checkOdds(sim, { skill: 'repair', difficulty: 3 })?.chance).toBeCloseTo(0.8);
    expect(checkOdds(sim, { skill: 'repair', difficulty: 0 })?.chance).toBe(0.95);
    expect(checkOdds(sim, { skill: 'repair', difficulty: 30 })?.chance).toBe(0.05);
    expect(checkOdds(sim, { skill: 'repair', difficulty: 6, base: 0.7, perLevel: 0.05 })?.chance).toBeCloseTo(0.7);
  });

  it('is null with no crew', () => {
    expect(checkOdds(storySim({}, []), { skill: 'repair', difficulty: 1 })).toBeNull();
  });

  it('rolls deterministically for a seed and succeeds about as often as the odds say', () => {
    const ev: Record<string, EventDef> = {
      e: decision([{ id: 'go', label: 'go', check: { skill: 'repair', difficulty: 6 }, success: { text: 'yes' }, failure: { text: 'no' } }]),
    };
    const outcomes = (seed: number): boolean[] => {
      const sim = storySim(ev, ['role.engineer'], seed);
      const out: boolean[] = [];
      for (let i = 0; i < 200; i++) {
        fire(sim, 'e');
        pick(sim, 'go');
        out.push(sim.story.last?.success as boolean);
      }
      return out;
    };
    const a = outcomes(11);
    expect(outcomes(11)).toEqual(a);
    expect(outcomes(12)).not.toEqual(a);
    const wins = a.filter(Boolean).length;
    expect(wins).toBeGreaterThan(70);
    expect(wins).toBeLessThan(130);
  });

  it('does not disturb the simulation rng', () => {
    const ev = { e: decision([{ id: 'go', label: 'go', check: { skill: 'repair', difficulty: 6 }, success: {}, failure: {} }]) };
    const sim = storySim(ev);
    const control = storySim(ev);
    fire(sim, 'e');
    pick(sim, 'go');
    run(control, 2);
    expect(sim.rng.getState()).toBe(control.rng.getState());
  });
});

describe('choose', () => {
  const ev: Record<string, EventDef> = {
    e: decision([
      { id: 'gated', label: 'gated', requires: [{ kind: 'species', species: 'species.robot' }], outcome: {} },
      { id: 'pay', label: 'pay', cost: [{ item: 'item.scrap', count: 10 }], outcome: { text: 'ok', effects: [{ type: 'items', item: 'item.parts', count: 2 }] } },
    ]),
  };

  it('pauses on an active decision and starts/resolves with events', () => {
    const sim = storySim(ev);
    fire(sim, 'e');
    expect(sim.story.active?.event).toBe('e');
    give(sim, 'item.scrap', 10);
    pick(sim, 'pay');
    expect(sim.story.active).toBeNull();
    expect(sim.story.last).toMatchObject({ event: 'e', choice: 'pay', success: null, text: 'ok', lines: ['-10x Scrap', '+2x Spare parts'] });
    const types = drain(sim).map((e) => e.type);
    expect(types.filter((t) => t.startsWith('story.'))).toEqual(['story.started', 'story.effect', 'story.resolved']);
  });

  it('rejects unmet choices, a missing cost, and unknown choices without changing anything', () => {
    const sim = storySim(ev);
    fire(sim, 'e');
    drain(sim);
    pick(sim, 'gated');
    pick(sim, 'pay');
    pick(sim, 'nope');
    const rejected = drain(sim).filter((e) => e.type === 'command.rejected');
    expect(rejected).toHaveLength(3);
    expect(sim.story.active?.event).toBe('e');
  });

  it('rejects choose with nothing open and fire of an unknown id', () => {
    const sim = storySim(ev);
    pick(sim, 'pay');
    sim.enqueue({ type: 'story.fire', event: 'zzz' });
    run(sim);
    expect(drain(sim).filter((e) => e.type === 'command.rejected')).toHaveLength(2);
  });
});

describe('item stock is the player ship only', () => {
  it('ignores items on enemy ships for requirements and costs, and never spends them', () => {
    const sim = storySim({ e: decision([{ id: 'pay', label: 'pay', cost: [{ item: 'item.scrap', count: 5 }], outcome: {} }]) });
    spawnShip(sim, { name: 'H', rows: ['#####', '#___#', '#####'], modules: [{ def: 'module.crate', x: 1, y: 1, rot: 0 }] }, { faction: 'hostile', x: 30, y: 30 });
    const enemyCrate = sim.world.query(StorageC, ModuleC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === shipIds(sim)[1] as number) as number;
    storageAdd(sim, enemyCrate, 'item.scrap', 50);
    expect(meets(sim, { kind: 'item', item: 'item.scrap', count: 1 })).toBe(false);
    fire(sim, 'e');
    pick(sim, 'pay');
    expect(sim.story.active?.event).toBe('e');
    give(sim, 'item.scrap', 5);
    pick(sim, 'pay');
    expect(sim.story.active).toBeNull();
    expect(storageCount(sim, enemyCrate, 'item.scrap')).toBe(50);
  });
});

describe('effects', () => {
  const hp = (sim: ReturnType<typeof storySim>, i: number): number => sim.world.get(playerCrew(sim)[i] as number, HealthC)?.hp as number;
  const apply = (effects: NonNullable<EventDef['choices']>[number]['outcome'], roles?: string[]) => {
    const sim = storySim({ e: decision([{ id: 'go', label: 'go', outcome: effects }]) }, roles);
    fire(sim, 'e');
    pick(sim, 'go');
    return sim;
  };

  it('items gives to storage and takes from it; taking more than held takes what exists', () => {
    const sim = storySim({ e: decision([{ id: 'go', label: 'go', outcome: { effects: [{ type: 'items', item: 'item.metal', count: 30 }, { type: 'items', item: 'item.scrap', count: -50 }] } }]) });
    give(sim, 'item.scrap', 20);
    fire(sim, 'e');
    pick(sim, 'go');
    expect(playerStock(sim, 'item.metal')).toBe(30);
    expect(playerStock(sim, 'item.scrap')).toBe(0);
    expect(sim.story.last?.lines).toEqual(['+30x Metal', '-20x Scrap']);
  });

  it('crewDamage and crewHeal on all, actor, random', () => {
    const sim = apply({ effects: [{ type: 'crewDamage', amount: 30, who: 'all' }] });
    expect(hp(sim, 0)).toBeCloseTo(70, 0);
    expect(hp(sim, 1)).toBeCloseTo(70, 0);
    const h = storySim({ e: decision([{ id: 'go', label: 'go', outcome: { effects: [{ type: 'crewHeal', amount: 50, who: 'all' }] } }]) });
    for (const id of playerCrew(h)) (h.world.get(id, HealthC) as { hp: number }).hp = 10;
    fire(h, 'e');
    pick(h, 'go');
    expect(hp(h, 0)).toBeCloseTo(60, 0);
    expect(hp(h, 1)).toBeCloseTo(60, 0);
    const r = apply({ effects: [{ type: 'crewDamage', amount: 5 }] });
    expect(hp(r, 0) + hp(r, 1)).toBeCloseTo(195, 0);
  });

  it('actor effects land on the skill check roller', () => {
    const sim = storySim({
      e: decision([{ id: 'go', label: 'go', check: { skill: 'repair', difficulty: 99 }, success: {}, failure: { effects: [{ type: 'crewDamage', amount: 40, who: 'actor' }] } }]),
    });
    fire(sim, 'e');
    pick(sim, 'go');
    expect(hp(sim, 0)).toBeCloseTo(60, 0);
    expect(hp(sim, 1)).toBeCloseTo(100, 0);
  });

  it('skillXp adds levels through the stat resolver', () => {
    const sim = apply({ effects: [{ type: 'skillXp', skill: 'repair', amount: 250, who: 'all' }] });
    const id = playerCrew(sim)[1] as number;
    expect(sim.world.get(id, SkillXpC)?.xp['repair']).toBe(250);
    expect(skillOf(sim, id, 'repair')).toBe(1 + levelsFor(250)); // role.rookie's 1 plus the XP levels
  });

  it('reputation, flags (set, add, clear)', () => {
    const sim = apply({ effects: [{ type: 'reputation', faction: 'corp', delta: -2 }, { type: 'reputation', faction: 'corp', delta: 5 }, { type: 'flag', flag: 'a' }, { type: 'flag', flag: 'n', op: 'add', value: 2 }, { type: 'flag', flag: 'n', op: 'add' }, { type: 'flag', flag: 'gone', value: 3 }, { type: 'flag', flag: 'gone', op: 'clear' }] });
    expect(sim.story.reputation['corp']).toBe(3);
    expect(sim.story.flags).toEqual({ a: 1, n: 3 });
  });

  it('physical outcomes are recorded for the sector layer', () => {
    const sim = apply({ effects: [{ type: 'physical', outcome: { kind: 'derelict', template: 'ship.d' } }, { type: 'physical', outcome: { kind: 'fire', where: 'reactor' } }] });
    expect(sim.story.physical.map((p) => p.outcome.kind)).toEqual(['derelict', 'fire']);
    expect(sim.story.physical[0]).toMatchObject({ event: 'e' });
  });

  it('emits story.effect for every effect', () => {
    const sim = storySim({ e: decision([{ id: 'go', label: 'go', outcome: { effects: [{ type: 'flag', flag: 'a' }, { type: 'reputation', faction: 'x', delta: 1 }] } }]) });
    fire(sim, 'e');
    drain(sim);
    pick(sim, 'go');
    expect(drain(sim).filter((e) => e.type === 'story.effect').map((e) => (e as { effect: string }).effect)).toEqual(['flag', 'reputation']);
  });
});

describe('chaining and arcs', () => {
  const ev: Record<string, EventDef> = {
    a: decision([{ id: 'go', label: 'go', outcome: { effects: [{ type: 'chain', event: 'b' }] } }, { id: 'later', label: 'later', outcome: { effects: [{ type: 'chain', event: 'b', delaySec: 5 }] } }]),
    b: decision([{ id: 'done', label: 'done', outcome: { effects: [{ type: 'flag', flag: 'finished' }] } }]),
    note: { title: 'N', text: 'n', mode: 'notice', triggers: [{ kind: 'chain' }] },
  };

  it('a chained decision opens as the next one, same tick', () => {
    const sim = storySim(ev);
    fire(sim, 'a');
    pick(sim, 'go');
    expect(sim.story.active?.event).toBe('b');
    pick(sim, 'done');
    expect(sim.story.flags['finished']).toBe(1);
  });

  it('a delayed chain waits for its time', () => {
    const sim = storySim(ev);
    fire(sim, 'a');
    pick(sim, 'later');
    expect(sim.story.active).toBeNull();
    run(sim, 5 * TICK_HZ);
    expect(sim.story.active?.event).toBe('b');
  });

  it('a decision fired while one is open waits; notices still arrive', () => {
    const sim = storySim(ev);
    fire(sim, 'a');
    fire(sim, 'b');
    expect(sim.story.active?.event).toBe('a');
    expect(sim.story.queue).toHaveLength(1);
    drain(sim);
    fire(sim, 'note');
    expect(drain(sim).some((e) => e.type === 'story.started' && e.mode === 'notice')).toBe(true);
    pick(sim, 'go');
    expect(sim.story.active?.event).toBe('b');
  });

  it('a flag trigger starts the arc part later, only while eligible and once', () => {
    const arc: Record<string, EventDef> = {
      first: decision([{ id: 'spare', label: 'spare', outcome: { effects: [{ type: 'flag', flag: 'spared' }] } }, { id: 'kill', label: 'kill', outcome: {} }]),
      back: decision([{ id: 'hi', label: 'hi', outcome: {} }], { triggers: [{ kind: 'flag', flag: 'spared', delaySec: 10 }], eligible: [{ kind: 'flag', flag: 'spared' }], once: true }),
    };
    const sim = storySim(arc);
    fire(sim, 'first');
    pick(sim, 'kill');
    run(sim, 20 * TICK_HZ);
    expect(sim.story.active).toBeNull();
    fire(sim, 'first');
    pick(sim, 'spare');
    run(sim, 9 * TICK_HZ);
    expect(sim.story.active).toBeNull();
    run(sim, 2 * TICK_HZ);
    expect(sim.story.active).toBeNull(); // due, but a flag-queued decision opens only in transit
    sim.sector.state = 'hyperspace';
    pump(sim);
    expect(sim.story.active?.event).toBe('back');
  });
});

describe('persistence', () => {
  it('flags, reputation, the open decision, queue and story rng survive a save round trip', () => {
    const ev: Record<string, EventDef> = {
      e: decision([{ id: 'go', label: 'go', check: { skill: 'repair', difficulty: 6 }, success: {}, failure: {} }]),
      q: decision([{ id: 'go', label: 'go', outcome: {} }]),
    };
    const sim = storySim(ev);
    sim.story.flags['spared_pirate'] = 1;
    sim.story.reputation['corp'] = -3;
    fire(sim, 'e');
    sim.story.queue.push({ event: 'q', due: 9999 });
    const copy = deserialize(serialize(sim), sim.content);
    expect(copy.story).toEqual(sim.story);
    // The loaded game rolls the same dice as the original from here on.
    for (const s of [sim, copy]) pick(s, 'go');
    expect(copy.story.last).toEqual(sim.story.last);
    expect(copy.story.rng).toBe(sim.story.rng);
  });

  it('a save without story state loads with a fresh one', () => {
    const sim = storySim({});
    const data = JSON.parse(serialize(sim)) as Record<string, unknown>;
    delete data['story'];
    const copy = deserialize(JSON.stringify(data), baseContent({}));
    expect(copy.story.flags).toEqual({});
  });

  it('crew names stay readable after load', () => {
    const sim = storySim({});
    const copy = deserialize(serialize(sim), sim.content);
    expect(copy.world.get(playerCrew(copy)[0] as number, CrewC)?.name).toBe('Mara');
  });
});
