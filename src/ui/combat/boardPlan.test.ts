import { describe, expect, it } from 'vitest';
import type { UiShuttles } from '../api';
import { boardPlan } from './boardPlan';

const shuttle = (over = {}) => ({ id: 9, name: 'Shuttle', state: 'stowed', capacity: 3, pilot: null, passengers: [], ...over }) as unknown as UiShuttles['shuttles'][number];
const crew = (id: number, over = {}) => ({ id, name: `C${id}`, role: 'Pilot', boarding: 0, ship: 1, hp: 1, down: false, ...over });
const lock = (id: number, over = {}) => ({ id, shipId: 2, ship: 'Raider', working: true, busy: false, x: 1, y: 1, ...over });
const data = (over: Partial<UiShuttles> = {}): UiShuttles => ({
  shuttles: [shuttle()], airlocks: [lock(5)], targets: [], roster: [crew(1), crew(2)], bays: [], regions: [], transfers: [], ferryReady: false, ...over,
});

describe('boardPlan', () => {
  it('opens with a stowed shuttle, a free enemy airlock and two able crew', () => {
    const p = boardPlan(data(), 2, 1);
    expect(p.blocker).toBeNull();
    expect(p.shuttles[0]).toMatchObject({ seats: 4, reason: null });
  });
  it('says why it cannot', () => {
    expect(boardPlan(data({ shuttles: [] }), 2, 1).blocker).toBe('No shuttle');
    expect(boardPlan(data({ shuttles: [shuttle({ state: 'flying' })] }), 2, 1).blocker).toBe('No shuttle in the bay');
    expect(boardPlan(data({ airlocks: [lock(5, { busy: true }), lock(6, { working: false }), lock(7, { shipId: 3 })] }), 2, 1).blocker).toBe('No reachable airlock');
    expect(boardPlan(data({ roster: [crew(1, { down: true }), crew(2, { down: true })] }), 2, 1).blocker).toBe('No crew free to go');
  });
  it('lists only the home ship crew, with busy ones disabled', () => {
    const p = boardPlan(data({ roster: [crew(1), crew(2, { boarding: 9 }), crew(3, { ship: 2 })] }), 2, 1);
    expect(p.crew.map((c) => [c.id, c.reason])).toEqual([[1, null], [2, 'Heading to a shuttle']]);
  });
});
