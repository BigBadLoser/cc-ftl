import { PositionC, TICK_HZ, type Sim, type SimEvent } from '../sim';
import { shipIdOf } from '../sim/regions';
import type { Loop } from './loop';
import { createDescriber } from './logText';
import { rejectionMessage } from './messages';
import { describeState } from './playDescribe';
import { domElements, openDialog, type PlayElement } from './playElements';
import { buildState, read, type PlaySources, type PlayState } from './playState';

/** What the playtest API needs from the app. The UI stores are read; `setSpeed` and `togglePause` are the player's own controls. */
export interface PlayDeps {
  sim: Sim;
  loop: Loop;
  api: PlaySources & {
    setSpeed(speed: 0 | 1 | 2 | 3): void;
    togglePause(): void;
    moduleScreenRect(id: number): { x0: number; y0: number; x1: number; y1: number } | null;
    shipScreen(id: number): { x: number; y: number } | null;
  };
  /** Rebuild the UI's snapshots now (after stepping a paused sim, the next frame would otherwise be the first to show it). */
  refresh(): void;
  starmapOpen(): boolean;
  /** Why the game is lost, or null while it goes on. */
  lost(): string | null;
  /** Viewport position of a tile (the renderer); absent in a headless test. */
  screenOf?(shipId: number, x: number, y: number): { x: number; y: number };
}

/** The most game time one `step()` advances, in seconds. */
export const MAX_STEP_SEC = 10;
/** Ticks run between event drains while stepping: what a real frame at top speed runs, so the UI sees events as in play. */
const DRAIN_EVERY = 5;
export const LOG_CAP = 300;

export interface PlayLogEntry {
  id: number;
  /** Game time in seconds. */
  t: number;
  text: string;
}

/** True when the URL asks for the playtest API: `?agent`, with or without a value, among any other params. */
export function agentWanted(search: string): boolean {
  return new URLSearchParams(search).has('agent');
}

const HELP = `window.__play: playtest API. Every method returns plain JSON.
Time:    pause() resume() isPaused() setSpeed(1|2|3)   same as Space and the speed buttons.
         step(seconds)  while paused, advance the game (max ${MAX_STEP_SEC}s), then return state(). Pauses first if needed.
Read:    state()        JSON snapshot: screen, time, ship, modules, weapons, crew, enemies, decision, alerts.
         describe()     the same as a few lines of plain text.
         elements()     clickable controls now: [{label, kind, enabled, box:{x,y,w,h}, at:{x,y}}]; click 'at' (CSS pixels of the page).
                        Ship modules, crew and hostile ships on the canvas are listed too (kind module, crew, ship).
         log(sinceId?)  events since that id: [{id, t, text}] (last ${LOG_CAP} kept). Pass the last id you saw.
Loop:    pause(), read state()/describe(), act with clicks or keys, step(2), read log(). Time only moves when you step or resume().
Keys:    Space pause, 1 2 3 speed, Esc menu.`;

/**
 * Playtest API, only installed with `?agent` in the URL: lets an AI model play from a headless browser, which cannot think in real time and may not see
 * the screen. Time control goes through the player's own pause and speed controls; everything else reads the UI's stores. It has no cheats and never
 * writes to the sim (`?hook` is the developer tool, and stays separate).
 */
export function installPlayHook(deps: PlayDeps, search: string): { onEvents(events: SimEvent[]): void } | undefined {
  if (!agentWanted(search)) return undefined;
  const { sim, loop, api } = deps;
  const describe = createDescriber(sim);
  const ring: PlayLogEntry[] = [];
  let nextId = 1;

  const paused = () => read(api.snapshot).paused;
  const timeState = () => {
    const s = read(api.snapshot);
    return { paused: s.paused, speed: s.speed, t: Math.round((sim.tick / TICK_HZ) * 10) / 10 };
  };
  const state = (): PlayState => buildState({ src: api, tick: sim.tick, starmapOpen: deps.starmapOpen(), lost: deps.lost(), dialog: typeof document === 'undefined' ? undefined : openDialog() });

  const canvasElements = (): PlayElement[] => {
    const out: PlayElement[] = [];
    const dom = typeof document !== 'undefined';
    const vw = dom ? innerWidth : Infinity, vh = dom ? innerHeight : Infinity;
    const add = (label: string, kind: string, x: number, y: number, w: number, h: number): void => {
      if (x + w < 0 || y + h < 0 || x > vw || y > vh) return;
      const cx = Math.min(Math.max(x + w / 2, 0), vw), cy = Math.min(Math.max(y + h / 2, 0), vh);
      out.push({ label, kind, enabled: true, box: { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }, at: { x: Math.round(cx), y: Math.round(cy) } });
    };
    // Only what is drawn and clickable in the world: the covering DOM is tested separately, so a panel over a module hides nothing here
    // (the model gets both and picks by label).
    for (const m of read(api.modules)) {
      const r = api.moduleScreenRect(m.id);
      if (r) add(m.name, 'module', r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    }
    const pitch = 30;
    if (deps.screenOf) {
      for (const c of [...read(api.crew), ...read(api.hostiles)]) {
        const p = sim.world.get(c.id, PositionC);
        if (!p || c.dead) continue;
        const s = deps.screenOf(shipIdOf(sim, p), p.x, p.y);
        add(c.name, c.side === 'enemy' ? 'enemy crew' : 'crew', s.x - pitch / 2, s.y - pitch * 1.5, pitch, pitch * 1.5);
      }
    }
    for (const e of read(api.combat).enemies) {
      const s = api.shipScreen(e.ship);
      if (s) add(e.name, 'ship', s.x - 40, s.y - 40, 80, 80);
    }
    return out;
  };

  const play = {
    help: () => HELP,
    pause() {
      if (!paused()) api.togglePause();
      return timeState();
    },
    resume() {
      if (paused()) api.togglePause();
      return timeState();
    },
    isPaused: () => paused(),
    setSpeed(speed: 1 | 2 | 3) {
      if (speed === 1 || speed === 2 || speed === 3) api.setSpeed(speed);
      return timeState();
    },
    step(seconds: number) {
      if (!paused()) api.togglePause();
      const want = Number.isFinite(seconds) ? Math.max(0, Math.min(seconds, MAX_STEP_SEC)) : 0;
      const ticks = Math.round(want * TICK_HZ);
      const start = sim.tick;
      let stopped: string | undefined;
      loop.flush(); // clicks made while paused are applied first, as in play
      for (let i = 0; i < ticks; i++) {
        // The game pauses itself on an open decision and when it is lost; stepping stops there as play would.
        if (sim.story.active) { stopped = 'a decision is open: answer it first'; break; }
        if (i % DRAIN_EVERY === 0) {
          const lost = deps.lost();
          if (lost) { stopped = `game over: ${lost}`; break; }
        }
        sim.step();
        if ((i + 1) % DRAIN_EVERY === 0) loop.drain();
      }
      loop.drain();
      deps.refresh();
      return { ...state(), stepped: Math.round(((sim.tick - start) / TICK_HZ) * 100) / 100, ...(stopped ? { stopped } : {}) };
    },
    state,
    describe: () => describeState(state()),
    elements(): PlayElement[] {
      return [...(typeof document === 'undefined' ? [] : domElements()), ...canvasElements()];
    },
    log(sinceId = 0): PlayLogEntry[] {
      return ring.filter((e) => e.id > sinceId);
    },
  };
  (window as unknown as { __play: unknown }).__play = play;

  return {
    onEvents(events) {
      for (const e of events) {
        const text = e.type === 'command.rejected' ? `Refused: ${rejectionMessage(e.reason)}` : describe(e)?.text;
        if (!text) continue;
        ring.push({ id: nextId++, t: Math.round((sim.events.tickOf(e, sim.tick) / TICK_HZ) * 10) / 10, text });
      }
      if (ring.length > LOG_CAP) ring.splice(0, ring.length - LOG_CAP);
    },
  };
}
