import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import type { RoomSpec } from './plan';
import { swapRoles } from './roleSwap';
import type { RoomRole } from './types';

/** Six 3x2 rooms side by side, each with a door onto a long corridor (room 6) below them. */
const rows = ['#########################', '#___#___#___#___#___#___#', '#___#___#___#___#___#___#', '##D###D###D###D###D###D##', '#_______________________#', '#########################'];
const W = rows[0]!.length;
const roomOf = Int16Array.from({ length: W * rows.length }, (_, i) => {
  const x = i % W, y = Math.floor(i / W);
  if (rows[y]?.[x] !== '_') return -1;
  return y === 4 ? 6 : Math.floor((x - 1) / 4);
});
const spec = (role: RoomRole): RoomSpec => ({ role, mods: [], w: 3, h: 2 }) as RoomSpec;

describe('role swap', () => {
  it('brings the quarters and the mess together by trading places with store rooms, and keeps the corridor', () => {
    const roles: RoomRole[] = ['quarters', 'cargo', 'cargo', 'cargo', 'cargo', 'support', 'hall'];
    const out = swapRoles(new Rng(3), rows, roomOf, roles, [...roles.slice(0, 6).map(spec), undefined]);
    expect(out.after).toBeGreaterThan(out.before);
    expect(Math.abs(out.roles.indexOf('support') - out.roles.indexOf('quarters'))).toBeLessThanOrEqual(2);
    expect(out.roles[6]).toBe('hall');
    expect(out.specs[out.roles.indexOf('support')]?.role).toBe('support'); // plans travel with their roles
  });
});
