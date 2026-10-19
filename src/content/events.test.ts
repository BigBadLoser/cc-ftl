import { describe, expect, it } from 'vitest';
import { content } from '.';
import { newGame, unmetReasons, type EventDef, type EventEffect, type Outcome, type Requirement } from '../sim';

const defs = Object.entries<EventDef>(content.events);
const outcomes = (): Outcome[] => defs.flatMap(([, d]) => (d.choices ?? []).flatMap((c) => [c.outcome, c.success, c.failure].filter((o): o is Outcome => !!o)));
const effects = (): EventEffect[] => [...outcomes().flatMap((o) => o.effects ?? []), ...defs.flatMap(([, d]) => d.effects ?? [])];
const requirements = (): Requirement[] => defs.flatMap(([, d]) => [...(d.eligible ?? []), ...(d.choices ?? []).flatMap((c) => c.requires ?? [])]);

describe('event content', () => {
  it('has the starter set covering the mechanics', () => {
    expect(defs.length).toBeGreaterThanOrEqual(10);
    expect(defs.some(([, d]) => d.choices?.some((c) => c.check))).toBe(true);
    expect(defs.some(([, d]) => d.choices?.some((c) => c.cost?.length))).toBe(true);
    expect(requirements().some((r) => r.kind === 'species')).toBe(true);
    expect(effects().some((e) => e.type === 'physical')).toBe(true);
    expect(defs.some(([, d]) => d.mode === 'notice')).toBe(true);
  });

  it('references only content that exists', () => {
    const ids = new Set(Object.keys(content.events));
    for (const e of effects()) {
      if (e.type === 'chain') expect(ids.has(e.event), e.event).toBe(true);
      if (e.type === 'items') expect(content.items[e.item as keyof typeof content.items], e.item).toBeDefined();
    }
    for (const [id, d] of defs) {
      if (d.lead) expect(ids.has(d.lead), `${id} lead`).toBe(true);
      for (const c of d.choices ?? []) for (const q of c.cost ?? []) expect(content.items[q.item as keyof typeof content.items], q.item).toBeDefined();
    }
    for (const r of requirements()) {
      if (r.kind === 'species') expect(content.species[r.species as keyof typeof content.species], r.species).toBeDefined();
      if (r.kind === 'module') expect(content.modules[r.def as keyof typeof content.modules], r.def).toBeDefined();
      if (r.kind === 'item') expect(content.items[r.item as keyof typeof content.items], r.item).toBeDefined();
    }
  });

  it('is well formed: decisions have unique choices, notices have none, every event is reachable', () => {
    const chained = new Set<string>([...effects().flatMap((e) => (e.type === 'chain' ? [e.event] : [])), ...defs.flatMap(([, d]) => (d.lead ? [d.lead] : []))]);
    for (const [id, d] of defs) {
      if (d.mode === 'decision') {
        expect(d.choices?.length, id).toBeGreaterThan(0);
        expect(new Set(d.choices?.map((c) => c.id)).size, id).toBe(d.choices?.length);
        for (const c of d.choices ?? []) expect(!!c.outcome !== !!c.check, `${id}/${c.id}: outcome xor check`).toBe(true);
      } else expect(d.choices, id).toBeUndefined();
      expect(d.triggers.some((t) => t.kind !== 'chain') || chained.has(id), `${id} unreachable`).toBe(true);
    }
  });

  it('every flag an event waits on is set by some effect', () => {
    const set = new Set(effects().flatMap((e) => (e.type === 'flag' ? [e.flag] : [])));
    for (const [id, d] of defs) for (const t of d.triggers) if (t.kind === 'flag') expect(set.has(t.flag), `${id}: ${t.flag}`).toBe(true);
  });

  it('every choice resolves cleanly on a real game', () => {
    for (const [id, d] of defs.filter(([, d]) => d.mode === 'decision')) {
      for (const choice of d.choices ?? []) {
        const sim = newGame(3, content);
        sim.enqueue({ type: 'story.fire', event: id });
        sim.step();
        expect(sim.story.active?.event).toBe(id);
        if (unmetReasons(sim, choice).length) continue; // gated or costs items the starter lacks
        sim.enqueue({ type: 'story.choose', choice: choice.id });
        sim.step();
        expect(sim.story.last?.choice, `${id}/${choice.id}`).toBe(choice.id);
      }
    }
  });

  it('the pirate arc comes back after the spared flag', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'story.fire', event: 'event.pirate_captive' });
    sim.step();
    sim.enqueue({ type: 'story.choose', choice: 'spare' });
    sim.step();
    for (let i = 0; i < 245 * 20; i++) sim.step();
    expect(sim.story.active?.event).toBe('event.pirate_returns');
  });
});
