import { describe, expect, it } from 'vitest';
import { isTypingTarget } from './keys';

const el = (tagName: string, attrs: Record<string, string> = {}, isContentEditable = false) =>
  ({ tagName, isContentEditable, getAttribute: (k: string) => attrs[k] ?? null }) as unknown as EventTarget;

describe('isTypingTarget', () => {
  it('is true for text fields, selects and editable regions', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) expect(isTypingTarget({ target: el(tag) })).toBe(true);
    expect(isTypingTarget({ target: el('DIV', { contenteditable: '' }) })).toBe(true);
    expect(isTypingTarget({ target: el('DIV', { contenteditable: 'true' }) })).toBe(true);
    expect(isTypingTarget({ target: el('DIV', {}, true) })).toBe(true);
    expect(isTypingTarget({ target: el('DIV', { role: 'textbox' }) })).toBe(true);
  });
  it('is false for everything else', () => {
    expect(isTypingTarget({ target: el('BUTTON') })).toBe(false);
    expect(isTypingTarget({ target: el('DIV', { contenteditable: 'false' }) })).toBe(false);
    expect(isTypingTarget({ target: null })).toBe(false);
    expect(isTypingTarget({ target: {} as EventTarget })).toBe(false);
  });
});
