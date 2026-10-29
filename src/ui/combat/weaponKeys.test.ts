import { describe, expect, it } from 'vitest';
import { weaponForKey } from './weaponKeys';

describe('weaponForKey', () => {
  const three = ['a', 'b', 'c'];
  it('maps Q W E R to slots 1-4', () => {
    expect(weaponForKey('q', three)).toBe('a');
    expect(weaponForKey('W', three)).toBe('b');
    expect(weaponForKey('e', three)).toBe('c');
    expect(weaponForKey('r', [...three, 'd'])).toBe('d');
  });
  it('lets R fall through to draft when there is no fourth weapon', () => {
    expect(weaponForKey('r', three)).toBeNull();
  });
  it('ignores other keys', () => {
    expect(weaponForKey('1', three)).toBeNull();
    expect(weaponForKey('Enter', three)).toBeNull();
  });
});
