import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '../content';
import { TICK_HZ, homeShip, newGame } from '../sim';
import { ensureAround } from '../sim/galaxy/state';
import { createBridge } from './bridge';
import { createController } from './controller';
import { createLoop } from './loop';
import { agentWanted, installPlayHook, LOG_CAP, MAX_STEP_SEC } from './playHook';

type Play = {
  help(): string; pause(): { paused: boolean }; resume(): { paused: boolean }; isPaused(): boolean; setSpeed(s: 1 | 2 | 3): { speed: number };
  step(s: number): Record<string, unknown> & { t: number; paused: boolean; stepped: number; tick: number };
  state(): Record<string, unknown> & { t: number; tick: number; paused: boolean; speed: number; screen: string };
  describe(): string; elements(): unknown[]; log(since?: number): { id: number; t: number; text: string }[];
};
const played = () => (globalThis as unknown as { __play?: Play }).__play;

/** A game wired as main.ts does: bridge, controller, loop and the playtest hook fed by the loop's events. */
function setup(search: string) {
  vi.stubGlobal('window', globalThis);
  const sim = newGame(3, content);
  ensureAround(sim, sim.galaxy.current);
  const bridge = createBridge(sim);
  const controller = createController(sim, bridge);
  const wired: { hook?: ReturnType<typeof installPlayHook> } = {};
  const loop = createLoop({ sim, render: () => undefined, onFrame: () => undefined, onEvents: (es) => { controller.onEvents(es); wired.hook?.onEvents(es); } });
  bridge.attachLoop(loop);
  bridge.setSpeed(1);
  const api = {
    snapshot: bridge.snapshot, crew: bridge.crew, hostiles: bridge.hostiles, modules: bridge.modules, stock: bridge.stock, stats: bridge.stats, combat: bridge.combat,
    ftl: bridge.ftl, story: bridge.story, trade: bridge.trade, alerts: controller.alerts.list, goals: bridge.goals, deploy: bridge.deploy, starmap: bridge.starmap,
    setSpeed: bridge.setSpeed, togglePause: bridge.togglePause, moduleScreenRect: () => null, shipScreen: () => null,
  };
  const hook = installPlayHook({ sim, loop, api, refresh: () => bridge.refresh(), starmapOpen: () => false, lost: () => null }, search);
  wired.hook = hook;
  return { sim, bridge, hook };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as unknown as { __play?: unknown }).__play;
});

describe('agentWanted', () => {
  it('reads the flag among other params, with or without a value', () => {
    expect(agentWanted('?agent')).toBe(true);
    expect(agentWanted('?agent=1')).toBe(true);
    expect(agentWanted('?seed=4&agent=1&hook')).toBe(true);
    expect(agentWanted('')).toBe(false);
    expect(agentWanted('?hook&seed=4')).toBe(false);
    expect(agentWanted('?agents=1')).toBe(false);
  });
});

describe('window.__play', () => {
  it('is not installed without ?agent', () => {
    const { hook } = setup('?seed=3&hook');
    expect(hook).toBeUndefined();
    expect(played()).toBeUndefined();
  });

  it('is installed with ?agent and exposes the documented methods', () => {
    setup('?seed=3&agent=1');
    const p = played()!;
    for (const m of ['help', 'pause', 'resume', 'isPaused', 'setSpeed', 'step', 'state', 'describe', 'elements', 'log'] as const) expect(typeof p[m]).toBe('function');
    expect(p.help()).toContain('step(seconds)');
  });

  it('pause, resume and setSpeed use the game controls and show in the UI snapshot', () => {
    const { bridge } = setup('?agent');
    const p = played()!;
    expect(p.pause().paused).toBe(true);
    let snap: { paused: boolean; speed: number } | undefined;
    bridge.snapshot.subscribe((s) => (snap = s))();
    expect(snap).toMatchObject({ paused: true, speed: 0 });
    expect(p.isPaused()).toBe(true);
    expect(p.setSpeed(3).speed).toBe(3);
    expect(p.isPaused()).toBe(false);
    p.pause();
    expect(p.resume()).toMatchObject({ paused: false, speed: 3 }); // back to the speed it was on, as Space does
  });

  it('step() advances game time by the requested seconds, tick by tick, and stays paused', () => {
    const { sim } = setup('?agent');
    const p = played()!;
    p.pause();
    const t0 = sim.tick;
    const s = p.step(2);
    expect(sim.tick - t0).toBe(2 * TICK_HZ);
    expect(s.stepped).toBe(2);
    expect(s.paused).toBe(true);
    expect(s.tick).toBe(sim.tick);
    expect(p.isPaused()).toBe(true);
    expect(sim.tick).toBe(t0 + 2 * TICK_HZ); // nothing else advances it
  });

  it('step() pauses a running game first, caps long steps and ignores bad input', () => {
    const { sim } = setup('?agent');
    const p = played()!;
    const t0 = sim.tick;
    expect(p.step(10_000).stepped).toBe(MAX_STEP_SEC);
    expect(p.isPaused()).toBe(true);
    expect(sim.tick - t0).toBe(MAX_STEP_SEC * TICK_HZ);
    const t1 = sim.tick;
    for (const bad of [-3, NaN, Infinity * -1]) p.step(bad);
    expect(sim.tick).toBe(t1);
  });

  it('is deterministic: the same steps give the same state', () => {
    const run = () => {
      setup('?agent');
      const p = played()!;
      p.pause();
      p.step(3);
      return JSON.stringify(p.step(2));
    };
    const a = run();
    const b = run();
    expect(a).toBe(b);
  });

  it('state() is JSON-serializable, compact and has the main fields', () => {
    setup('?agent');
    const p = played()!;
    p.pause();
    p.step(1);
    const st = p.state();
    const json = JSON.stringify(st);
    expect(JSON.parse(json)).toEqual(st);
    expect(json.length).toBeLessThan(4096);
    expect(st).toMatchObject({ screen: 'game', paused: true, speed: 0, decision: null });
    for (const k of ['t', 'tick', 'ship', 'modules', 'modulesOk', 'weapons', 'crew', 'enemies', 'alerts', 'nearby']) expect(st).toHaveProperty(k);
    expect(st.t).toBeCloseTo(st.tick / TICK_HZ, 1);
    const ship = st.ship as { hull: number; credits: number; stock: unknown[] };
    expect(ship.hull).toBeGreaterThan(0);
    expect(ship.stock.length).toBeGreaterThan(0);
    expect((st.crew as unknown[]).length).toBeGreaterThan(0);
  });

  it('describe() is a few plain lines and elements() works without a page', () => {
    setup('?agent');
    const p = played()!;
    p.pause();
    const d = p.describe();
    expect(d.split('\n').length).toBeLessThan(14);
    expect(d).toContain('paused');
    expect(d).toContain('Crew:');
    expect(Array.isArray(p.elements())).toBe(true);
  });

  it('log() returns the events after an id, in order, and drops nothing it should keep', () => {
    const { sim } = setup('?agent');
    const p = played()!;
    p.pause();
    expect(p.log()).toEqual([]);
    // A fire and a breach on the player's ship are what a player reads in the ship's log.
    const ship = homeShip(sim);
    sim.events.emit({ type: 'fire.started', ship, room: 1, x: 1, y: 1 });
    sim.events.emit({ type: 'hull.breach', ship, room: 1 });
    p.step(0.5);
    const all = p.log(0);
    expect(all.map((e) => e.text)).toEqual(['Fire broke out', 'Hull breached']);
    expect(all.map((e) => e.id)).toEqual([1, 2]);
    expect(p.log(1).map((e) => e.text)).toEqual(['Hull breached']);
    expect(p.log(2)).toEqual([]);
    for (const e of all) expect(e.t).toBeGreaterThanOrEqual(0);
  });

  it('keeps a bounded log', () => {
    const { sim } = setup('?agent');
    const p = played()!;
    const ship = homeShip(sim);
    for (let i = 0; i < LOG_CAP + 50; i++) sim.events.emit({ type: 'hull.breach', ship, room: i });
    p.step(0.1);
    const all = p.log(0);
    expect(all).toHaveLength(LOG_CAP);
    expect(all[all.length - 1]!.id).toBe(LOG_CAP + 50);
    expect(all[0]!.id).toBe(51);
  });
});
