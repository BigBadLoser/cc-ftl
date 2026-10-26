import { describe, expect, it } from 'vitest';
import { isPinned, writeWindow } from './floatingWindow';
import { closeOutside, isOutsideTarget, outsideTap, type ClosablePanel } from './outsideClick';

const panel = (id: string, sticky: boolean, open = true): ClosablePanel & { open: boolean } => {
  const p = { id, sticky, open, isOpen: () => p.open, close: () => { p.open = false; } };
  return p;
};

describe('isOutsideTarget', () => {
  it('counts the canvas, the page and a backdrop, not panels', () => {
    expect(isOutsideTarget({ tagName: 'CANVAS' })).toBe(true);
    expect(isOutsideTarget({ tagName: 'BODY' })).toBe(true);
    expect(isOutsideTarget({ tagName: 'DIV', hasAttribute: (n) => n === 'data-backdrop' })).toBe(true);
    expect(isOutsideTarget({ tagName: 'DIV', hasAttribute: () => false })).toBe(false);
    expect(isOutsideTarget({ tagName: 'BUTTON' })).toBe(false);
  });
});

describe('closeOutside', () => {
  it('closes open panels except sticky ones', () => {
    const jobs = panel('jobs', false);
    const stock = panel('stock', false, false);
    const combat = panel('combat', true);
    expect(closeOutside([jobs, stock, combat])).toEqual(['jobs']);
    expect(jobs.open).toBe(false);
    expect(combat.open).toBe(true);
  });
});

describe('closeOutside with pinned windows', () => {
  it('leaves a pinned panel open and closes it once unpinned', () => {
    let pinned = true;
    const jobs = { ...panel('jobs', false), pinned: () => pinned };
    const stock = panel('stock', false);
    expect(closeOutside([jobs, stock])).toEqual(['stock']);
    expect(jobs.open).toBe(true);
    pinned = false;
    expect(closeOutside([jobs])).toEqual(['jobs']);
  });
  it('reads the pin from the window memory', () => {
    const s = { m: new Map<string, string>(), getItem(k: string) { return this.m.get(k) ?? null; }, setItem(k: string, v: string) { this.m.set(k, v); } };
    writeWindow('jobs', { rect: null, pinned: true }, () => s);
    const jobs = { ...panel('jobs', false), pinned: () => isPinned('jobs', () => s) };
    expect(closeOutside([jobs])).toEqual([]);
    writeWindow('jobs', { rect: null, pinned: false }, () => s);
    expect(closeOutside([jobs])).toEqual(['jobs']);
  });
});

describe('outsideTap', () => {
  const mk = () => { let n = 0; return { t: outsideTap(() => n++), count: () => n }; };
  it('fires on an outside click, not on a drag or a click on a panel', () => {
    const { t, count } = mk();
    t.onDown({ pointerId: 1, clientX: 10, clientY: 10, target: { tagName: 'CANVAS' } });
    t.onUp({ pointerId: 1, clientX: 12, clientY: 11 });
    expect(count()).toBe(1);
    t.onDown({ pointerId: 1, clientX: 10, clientY: 10, target: { tagName: 'CANVAS' } });
    t.onUp({ pointerId: 1, clientX: 90, clientY: 10 });
    expect(count()).toBe(1);
    t.onDown({ pointerId: 1, clientX: 10, clientY: 10, target: { tagName: 'DIV', hasAttribute: () => false } });
    t.onUp({ pointerId: 1, clientX: 10, clientY: 10 });
    expect(count()).toBe(1);
  });
  it('ignores a right click', () => {
    const { t, count } = mk();
    t.onDown({ pointerId: 1, clientX: 0, clientY: 0, button: 2, target: { tagName: 'CANVAS' } });
    t.onUp({ pointerId: 1, clientX: 0, clientY: 0 });
    expect(count()).toBe(0);
  });
  it('a pinch is never a tap, even when one finger stays down and the other lifts last', () => {
    const { t, count } = mk();
    const c = { tagName: 'CANVAS' };
    t.onDown({ pointerId: 1, clientX: 10, clientY: 10, target: c });
    t.onDown({ pointerId: 2, clientX: 50, clientY: 50, target: c });
    t.onUp({ pointerId: 2, clientX: 50, clientY: 50 });
    t.onUp({ pointerId: 1, clientX: 10, clientY: 10 });
    expect(count()).toBe(0);
    // the next single tap works again
    t.onDown({ pointerId: 3, clientX: 10, clientY: 10, target: c });
    t.onUp({ pointerId: 3, clientX: 10, clientY: 10 });
    expect(count()).toBe(1);
  });
  it('a cancelled pointer ends the gesture', () => {
    const { t, count } = mk();
    const c = { tagName: 'CANVAS' };
    t.onDown({ pointerId: 1, clientX: 10, clientY: 10, target: c });
    t.onCancel({ pointerId: 1 });
    t.onUp({ pointerId: 1, clientX: 10, clientY: 10 });
    expect(count()).toBe(0);
  });
});
