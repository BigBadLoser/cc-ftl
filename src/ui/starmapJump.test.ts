import { describe, expect, it } from 'vitest';
import { jumpCommand, toggleTake } from './starmapJump';

describe('jump confirm', () => {
  it('toggles fill withDocked, and it is left out when nothing is taken', () => {
    let taking: number[] = [];
    taking = toggleTake(taking, 7);
    taking = toggleTake(taking, 9);
    expect(jumpCommand(1, ['a', 'b', 'c'], taking)).toEqual({ type: 'galaxy.jump', ship: 1, route: ['b', 'c'], withDocked: [7, 9] });
    taking = toggleTake(taking, 7);
    expect(jumpCommand(1, ['a', 'b'], taking)).toMatchObject({ withDocked: [9] });
    taking = toggleTake(taking, 9);
    expect(jumpCommand(1, ['a', 'b'], taking)).toEqual({ type: 'galaxy.jump', ship: 1, route: ['b'] });
  });
});
