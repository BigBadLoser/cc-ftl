import { describe, expect, it } from 'vitest';
import { World, defineComponent } from './ecs';

const Pos = defineComponent<{ x: number; y: number }>('pos');
const Hp = defineComponent<{ hp: number }>('hp');

describe('World', () => {
  it('creates ids incrementally and never reuses them', () => {
    const w = new World();
    const a = w.createEntity();
    const b = w.createEntity();
    expect(b).toBe(a + 1);
    w.destroyEntity(b);
    expect(w.createEntity()).toBe(b + 1);
    expect(w.isAlive(b)).toBe(false);
  });

  it('adds, gets, removes components', () => {
    const w = new World();
    const e = w.createEntity();
    w.add(e, Pos, { x: 1, y: 2 });
    expect(w.get(e, Pos)).toEqual({ x: 1, y: 2 });
    expect(w.has(e, Pos)).toBe(true);
    expect(w.remove(e, Pos)).toBe(true);
    expect(w.has(e, Pos)).toBe(false);
    expect(() => w.add(999, Pos, { x: 0, y: 0 })).toThrow();
  });

  it('destroy removes from all stores', () => {
    const w = new World();
    const e = w.createEntity();
    w.add(e, Pos, { x: 0, y: 0 });
    w.add(e, Hp, { hp: 1 });
    w.destroyEntity(e);
    expect(w.query(Pos)).toEqual([]);
    expect(w.query(Hp)).toEqual([]);
  });

  it('queries in ascending id order with all components', () => {
    const w = new World();
    const ids = [w.createEntity(), w.createEntity(), w.createEntity(), w.createEntity()];
    // add in scrambled order
    for (const i of [3, 1, 2, 0]) w.add(ids[i] as number, Pos, { x: i, y: 0 });
    w.add(ids[2] as number, Hp, { hp: 5 });
    w.add(ids[0] as number, Hp, { hp: 5 });
    expect(w.query(Pos)).toEqual(ids);
    expect(w.query(Pos, Hp)).toEqual([ids[0], ids[2]]);
  });

  it('caches queries and invalidates on change', () => {
    const w = new World();
    const a = w.createEntity();
    const b = w.createEntity();
    w.add(a, Pos, { x: 0, y: 0 });
    const first = w.query(Pos);
    expect(w.query(Pos)).toBe(first);
    w.add(a, Pos, { x: 5, y: 5 }); // overwrite: membership unchanged
    expect(w.query(Pos)).toBe(first);
    w.add(b, Pos, { x: 1, y: 1 });
    expect(w.query(Pos)).toEqual([a, b]);
    w.remove(a, Pos);
    expect(w.query(Pos)).toEqual([b]);
    w.destroyEntity(b);
    expect(w.query(Pos)).toEqual([]);
  });

  it('round-trips through serialize', () => {
    const w = new World();
    const a = w.createEntity();
    w.createEntity(); // component-less entity stays alive
    w.add(a, Pos, { x: 3, y: 4 });
    const data = JSON.parse(JSON.stringify(w.serialize()));
    const w2 = World.deserialize(data);
    expect(w2.serialize()).toEqual(w.serialize());
    expect(w2.query(Pos)).toEqual([a]);
    expect(w2.isAlive(a + 1)).toBe(true);
    expect(w2.createEntity()).toBe(a + 2);
  });
});

describe('World.detach / restore', () => {
  it('detaches an entity with its components and restores it under the same id', () => {
    const w = new World();
    const A = defineComponent<{ v: number }>('detachA');
    const B = defineComponent<{ s: string }>('detachB');
    const a = w.createEntity();
    const b = w.createEntity();
    w.add(a, A, { v: 1 });
    w.add(a, B, { s: 'x' });
    w.add(b, A, { v: 2 });
    const data = w.detach(a);
    expect(data).toEqual({ detachA: { v: 1 }, detachB: { s: 'x' } });
    expect(w.isAlive(a)).toBe(false);
    expect(w.query(A)).toEqual([b]);
    w.restore(a, data);
    expect(w.query(A, B)).toEqual([a]);
    expect(w.ids()).toEqual([a, b]);
    expect(() => w.restore(a, {})).toThrow();
    expect(() => w.restore(99, {})).toThrow();
    expect(w.createEntity()).toBe(3);
  });
});
