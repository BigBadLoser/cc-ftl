import { describe, expect, it } from 'vitest';
import { onCommand, onEvent, when } from './conditions';
import { LessonEngine, type Speed } from './engine';
import { createLessonPrefs } from './prefs';
import type { LessonCtx, LessonDef, LessonSignal } from './types';

const ctx = (over: Partial<LessonCtx> & { fight?: boolean } = {}): LessonCtx => ({
  combat: { inCombat: !!over.fight, player: null, enemies: [] },
  aiming: null,
  busy: false,
  ...over,
});
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const clock = (start: Speed = 1) => {
  const c = { s: start as Speed, calls: [] as Speed[], speed: () => c.s, setSpeed: (s: Speed) => { c.s = s; c.calls.push(s); } };
  return c;
};
const vent: LessonSignal = { kind: 'command', command: { type: 'combat.vent', ship: 1 } };
const started: LessonSignal = { kind: 'event', event: { type: 'combat.started' } as never };

const fight: LessonDef = {
  id: 'lesson.fight',
  title: 'Fight',
  trigger: when((c) => c.combat.inCombat),
  while: when((c) => c.combat.inCombat),
  steps: [
    { title: 'Vent', text: 'Press [G]', advance: onCommand('combat.vent') },
    { title: 'Read', text: 'ok', advance: 'gotIt' },
  ],
};
const evented: LessonDef = { id: 'lesson.ev', title: 'Ev', trigger: onEvent('combat.started'), steps: [{ title: 'a', text: 'a', advance: 'gotIt' }] };

const setup = (defs: LessonDef[], speed: Speed = 1) => {
  const prefs = createLessonPrefs(memory);
  const c = clock(speed);
  return { prefs, c, e: new LessonEngine(defs, c, prefs, 1000) };
};

describe('LessonEngine', () => {
  it('triggers on a state and on an event signal', () => {
    const { e } = setup([fight, evented]);
    e.update(ctx(), 0);
    expect(e.current).toBeNull();
    e.update(ctx(), 0, [started]);
    expect(e.current?.lesson.id).toBe('lesson.ev');
  });

  it('advances a do-step on its command and a gotIt step on Got it, then marks it seen', () => {
    const { e, prefs } = setup([fight]);
    e.update(ctx({ fight: true }), 0);
    expect(e.current?.index).toBe(0);
    e.update(ctx({ fight: true }), 1);
    expect(e.current?.index).toBe(0);
    e.update(ctx({ fight: true }), 2, [vent]);
    expect(e.current?.index).toBe(1);
    e.update(ctx({ fight: true }), 3);
    expect(e.current?.index).toBe(1); // waits for Got it
    e.gotIt();
    expect(e.current).toBeNull();
    expect(prefs.isSeen('lesson.fight')).toBe(true);
    e.update(ctx({ fight: true }), 5000);
    expect(e.current).toBeNull(); // seen: never again
  });

  it('queues lessons that trigger together, one at a time after the cooldown', () => {
    const other: LessonDef = { ...evented, id: 'lesson.other', trigger: when((c) => c.combat.inCombat) };
    const { e } = setup([fight, other]);
    e.update(ctx({ fight: true }), 0);
    expect(e.current?.lesson.id).toBe('lesson.fight');
    e.dismiss();
    e.update(ctx({ fight: true }), 500);
    expect(e.current).toBeNull(); // cooldown
    e.update(ctx({ fight: true }), 1500);
    expect(e.current?.lesson.id).toBe('lesson.other');
  });

  it('waits while something urgent is up', () => {
    const { e } = setup([fight]);
    e.update(ctx({ fight: true, busy: true }), 0);
    expect(e.current).toBeNull();
    e.update(ctx({ fight: true }), 1);
    expect(e.current?.lesson.id).toBe('lesson.fight');
  });

  it('drops or closes a lesson whose situation passed, unseen', () => {
    const { e, prefs } = setup([fight]);
    e.update(ctx({ fight: true }), 0);
    e.update(ctx(), 1);
    expect(e.current).toBeNull();
    expect(prefs.isSeen('lesson.fight')).toBe(false);
  });

  it('pauses through the clock and restores the speed', () => {
    const { e, c } = setup([fight], 2);
    e.update(ctx({ fight: true }), 0);
    expect(c.s).toBe(0);
    e.dismiss();
    expect(c.s).toBe(2);
  });

  it('never unpauses a game the player had paused', () => {
    const { e, c } = setup([fight], 0);
    e.update(ctx({ fight: true }), 0);
    e.dismiss();
    expect(c.calls).toEqual([]);
  });

  it('runs time during a run step at the player speed', () => {
    const run: LessonDef = { ...evented, trigger: when(() => true), steps: [{ title: 'a', text: 'a', advance: 'gotIt' }, { title: 'b', text: 'b', advance: 'gotIt', run: true }, { title: 'c', text: 'c', advance: 'gotIt' }] };
    const { e, c } = setup([run], 3);
    e.update(ctx(), 0);
    expect(c.s).toBe(0);
    e.gotIt();
    expect(c.s).toBe(3);
    e.gotIt();
    expect(c.s).toBe(0);
    e.gotIt();
    expect(c.s).toBe(3);
  });

  it('shows nothing while lessons are off, and replays a seen lesson on request', () => {
    const { e, prefs } = setup([evented]);
    prefs.setEnabled(false);
    e.update(ctx(), 0, [started]);
    expect(e.current).toBeNull();
    prefs.setEnabled(true);
    prefs.markSeen('lesson.ev');
    e.replay('lesson.ev');
    e.update(ctx(), 0);
    expect(e.current?.lesson.id).toBe('lesson.ev');
  });
});
