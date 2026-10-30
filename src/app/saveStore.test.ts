import { describe, expect, it } from 'vitest';
import { createLocalSaveStore } from './saveStore';

const memory = (fail = { on: false }) => {
  const m = new Map<string, string>();
  return {
    m,
    s: {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (fail.on) throw new DOMException('full', 'QuotaExceededError');
        m.set(k, v);
      },
      removeItem: (k: string) => void m.delete(k),
    },
  };
};
const meta = (id: string, name = id) => ({ id, name, savedAt: 1, turn: 2, node: 'Ixion' });

describe('save store', () => {
  it('lists the autosave and the written slots with their labels, reads and removes them', () => {
    const { m, s } = memory();
    const st = createLocalSaveStore(() => s);
    expect(st.list()).toEqual([]);
    expect(st.write(meta('auto', 'Autosave'), '{"a":1}')).toBe(true);
    expect(st.write(meta('slot2', 'Before the jump'), '{"b":2}')).toBe(true);
    expect(m.get('cc.save')).toBe('{"a":1}'); // the autosave keeps its old key
    expect(st.list().map((x) => [x.id, x.name])).toEqual([['auto', 'Autosave'], ['slot2', 'Before the jump']]);
    expect(st.read('slot2')).toBe('{"b":2}');
    expect(st.remove('slot2')).toBe(true);
    expect(st.list().map((x) => x.id)).toEqual(['auto']);
  });

  it('a refused write leaves the slot as it was', () => {
    const fail = { on: false };
    const { s } = memory(fail);
    const st = createLocalSaveStore(() => s);
    st.write(meta('slot1'), 'old');
    fail.on = true;
    expect(st.write(meta('slot1'), 'new')).toBe(false);
    expect(st.read('slot1')).toBe('old');
  });

  it('a save from before the index still lists', () => {
    const { m, s } = memory();
    m.set('cc.save', '{}');
    expect(createLocalSaveStore(() => s).list()).toEqual([{ id: 'auto', name: 'Autosave', savedAt: 0, turn: 0, node: '' }]);
  });
});
