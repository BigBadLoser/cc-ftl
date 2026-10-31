import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createIdbSaveStore } from './saveStore';

const meta = (id: string, name = id) => ({ id, name, savedAt: 1, turn: 2, node: 'Ixion' });
const open = async (idb = new IDBFactory()) => {
  const st = createIdbSaveStore(() => idb, () => null);
  await st.ready();
  return { st, idb };
};

describe('save store', () => {
  it('lists the autosave and the written slots with their labels, reads and removes them', async () => {
    const { st } = await open();
    expect(st.list()).toEqual([]);
    expect(await st.write(meta('auto', 'Autosave'), '{"a":1}')).toBe(true);
    expect(await st.write(meta('slot2', 'Before the jump'), '{"b":2}')).toBe(true);
    expect(st.list().map((x) => [x.id, x.name])).toEqual([['auto', 'Autosave'], ['slot2', 'Before the jump']]);
    expect(await st.read('slot2')).toBe('{"b":2}');
    expect(await st.remove('slot2')).toBe(true);
    expect(st.list().map((x) => x.id)).toEqual(['auto']);
    expect(await st.read('slot2')).toBeNull();
  });

  it('keeps what it stored across a reopen (the labels come back from the database)', async () => {
    const { st, idb } = await open();
    await st.write(meta('slot1', 'Kept'), 'x'.repeat(2_000_000));
    const again = await open(idb);
    expect(again.st.list().map((x) => x.name)).toEqual(['Kept']);
    expect((await again.st.read('slot1'))?.length).toBe(2_000_000);
  });

  it('holds more than seven megabyte-sized saves (localStorage could not)', async () => {
    const { st } = await open();
    for (const id of ['auto', 'auto2', 'auto3', 'precombat', 'slot1', 'slot2', 'slot3']) expect(await st.write(meta(id), 'y'.repeat(1_300_000))).toBe(true);
    expect(st.list()).toHaveLength(7);
  });

  it('shifts a chain in one write: the old entries move down and the last drops off', async () => {
    const { st } = await open();
    const chain = ['auto', 'auto2', 'auto3'];
    for (const [i, v] of ['one', 'two', 'three', 'four'].entries()) await st.write({ ...meta('auto'), savedAt: i + 1 }, v, chain);
    expect(await Promise.all(chain.map((id) => st.read(id)))).toEqual(['four', 'three', 'two']);
    expect(st.list().map((m) => [m.id, m.savedAt])).toEqual([['auto', 4], ['auto2', 3], ['auto3', 2]]);
  });

  it('without IndexedDB it lists nothing and refuses writes', async () => {
    const st = createIdbSaveStore(() => null, () => null);
    await st.ready();
    expect(st.list()).toEqual([]);
    expect(await st.write(meta('auto'), '{}')).toBe(false);
    expect(await st.read('auto')).toBeNull();
  });

  it('rotates from what the transaction reads, not from a stale cache (two tabs on one database)', async () => {
    const idb = new IDBFactory();
    const a = createIdbSaveStore(() => idb, () => null);
    const b = createIdbSaveStore(() => idb, () => null);
    await a.ready();
    const chain = ['auto', 'auto2', 'auto3'];
    await a.write({ ...meta('auto'), savedAt: 1, campaign: 1 }, 'A-data');
    await b.ready();
    await b.write({ ...meta('auto'), savedAt: 2, campaign: 2 }, 'B-data'); // another tab: A's cache still says campaign 1
    const seen: Array<number | undefined> = [];
    await a.write({ ...meta('auto'), savedAt: 3, campaign: 1 }, 'A-data-2', chain, (cur) => { seen.push(cur?.campaign); return true; });
    expect(seen).toEqual([2]); // the decision saw what is stored
    expect(await a.read('auto2')).toBe('B-data');
    expect(a.list().map((m) => [m.id, m.campaign])).toEqual([['auto', 1], ['auto2', 2]]); // the label matches its data
    const again = createIdbSaveStore(() => idb, () => null);
    await again.ready();
    expect(again.list().map((m) => [m.id, m.campaign])).toEqual([['auto', 1], ['auto2', 2]]);
  });
});
