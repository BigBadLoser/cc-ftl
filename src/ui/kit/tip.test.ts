import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { cleanTip, tip, tipState, type TipSpec } from './tip';

/** A stand-in element: just the bits the action touches. */
function fakeNode() {
  const on = new Map<string, () => void>();
  const node = {
    addEventListener: (t: string, f: () => void) => on.set(t, f),
    removeEventListener: (t: string) => on.delete(t),
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }) as DOMRect,
    matches: () => true,
    getAttribute: () => null, setAttribute: () => {}, removeAttribute: () => {},
  } as unknown as Element;
  return { node, fire: (t: string) => on.get(t)?.() };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('tip', () => {
  it('shows after the delay and hides on leave', async () => {
    const { node, fire } = fakeNode();
    const a = tip(node, { text: 'Hi' });
    fire('pointerenter');
    expect(get(tipState)).toBeNull();
    await wait(300);
    expect(get(tipState)?.spec.text).toBe('Hi');
    fire('pointerleave');
    expect(get(tipState)).toBeNull();
    a.destroy();
  });

  it('updates the shown tip in place while hovered, and drops it when the text goes empty', async () => {
    const { node, fire } = fakeNode();
    const a = tip(node, { text: 'Charge 10%' });
    fire('pointerenter');
    await wait(300);
    a.update({ text: 'Charge 20%' });
    expect(get(tipState)?.spec.text).toBe('Charge 20%');
    a.update({ text: '' });
    expect(get(tipState)).toBeNull();
    a.update({ text: 'Back' });
    expect(get(tipState)?.spec.text).toBe('Back');
    fire('pointerleave');
    a.destroy();
  });

  it('a spec that changes before the delay still shows the newest text', async () => {
    const { node, fire } = fakeNode();
    const a = tip(node, { text: 'old' });
    fire('pointerenter');
    a.update({ text: 'new' });
    await wait(300);
    expect(get(tipState)?.spec.text).toBe('new');
    fire('pointerleave');
    a.destroy();
  });

  it('keeps showing while focused after the pointer leaves', async () => {
    const { node, fire } = fakeNode();
    const a = tip(node, { text: 'Hi' });
    fire('focus');
    fire('pointerenter');
    fire('pointerleave');
    expect(get(tipState)?.spec.text).toBe('Hi');
    fire('blur');
    expect(get(tipState)).toBeNull();
    a.destroy();
  });
});

describe('cleanTip', () => {
  it('drops a trailing key suffix that the badge already shows', () => {
    expect(cleanTip({ text: 'Back to ship (Esc)', key: 'Esc' } as TipSpec).text).toBe('Back to ship');
    expect(cleanTip({ text: 'Starmap (M)', key: 'view.starmap' }).text).toBe('Starmap');
  });
  it('leaves other parentheses and key-less tips alone', () => {
    expect(cleanTip({ text: 'Walls (auto)', key: 'view.starmap' }).text).toBe('Walls (auto)');
    expect(cleanTip({ text: 'Ship (M)' }).text).toBe('Ship (M)');
  });
});

describe('tip focus', () => {
  it('makes a non-interactive trigger a tab stop when asked, and leaves one with its own tabindex alone', () => {
    const attrs = new Map<string, string>();
    const node = { addEventListener: () => {}, removeEventListener: () => {}, hasAttribute: (k: string) => attrs.has(k), setAttribute: (k: string, v: string) => attrs.set(k, v) } as unknown as Element;
    tip(node, { text: 'Hidden traits' });
    expect(attrs.has('tabindex')).toBe(false);
    tip(node, { text: 'Hidden traits', focus: true });
    expect(attrs.get('tabindex')).toBe('0');
    attrs.set('tabindex', '-1');
    tip(node, { text: 'x', focus: true });
    expect(attrs.get('tabindex')).toBe('-1');
  });
});

describe('nested tips', () => {
  it('leaving an inner trigger hands the tooltip back to the one around it', async () => {
    const outer = fakeNode();
    const inner = fakeNode();
    const a = tip(outer.node, { text: 'Row' });
    const b = tip(inner.node, { text: 'Turns left' });
    outer.fire('pointerenter');
    await wait(300);
    inner.fire('pointerenter');
    await wait(300);
    expect(get(tipState)?.spec.text).toBe('Turns left');
    inner.fire('pointerleave');
    expect(get(tipState)?.spec.text).toBe('Row');
    outer.fire('pointerleave');
    expect(get(tipState)).toBeNull();
    a.destroy();
    b.destroy();
  });
});

describe('tip a11y', () => {
  it('points the trigger at the host while shown, keeping its own description', async () => {
    const attrs = new Map<string, string>([['aria-describedby', 'own']]);
    const on = new Map<string, () => void>();
    const node = {
      addEventListener: (t: string, f: () => void) => on.set(t, f), removeEventListener: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 1, bottom: 1, width: 1, height: 1 }) as DOMRect, matches: () => true,
      hasAttribute: (k: string) => attrs.has(k), getAttribute: (k: string) => attrs.get(k) ?? null,
      setAttribute: (k: string, v: string) => attrs.set(k, v), removeAttribute: (k: string) => attrs.delete(k),
    } as unknown as Element;
    const a = tip(node, { text: 'Hi' });
    on.get('pointerenter')?.();
    await wait(300);
    expect(attrs.get('aria-describedby')).toBe('own game-tip');
    on.get('pointerleave')?.();
    expect(attrs.get('aria-describedby')).toBe('own');
    a.destroy();
  });
});
