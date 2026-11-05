import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { ago, folded, signed, toggleSection } from './socialFormat';

describe('social formatting', () => {
  it('words the age of a reason', () => {
    expect([5, 720, 7300, 200000].map(ago)).toEqual(['just now', '12 m ago', '2 h ago', '2 d ago']);
  });
  it('signs numbers with a real minus', () => {
    expect([62, -4, 0].map(signed)).toEqual(['+62', '−4', '0']);
  });
  it('folds a section and keeps the others', () => {
    toggleSection('friends');
    expect(get(folded)).toMatchObject({ friends: true, rivals: false });
    toggleSection('friends');
  });
});
