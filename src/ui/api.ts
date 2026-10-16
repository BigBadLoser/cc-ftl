import type { Command, WorkCategory } from '../sim';

/** Minimal store contract (Svelte-compatible) so ui need not import app internals. */
export interface Subscribable<T> {
  subscribe(run: (value: T) => void): () => void;
}

export interface UiSnapshot {
  tick: number;
  speed: 0 | 1 | 2 | 3;
  paused: boolean;
  entityCount: number;
  fps: number;
  frameMs: number;
  tickMs: number;
  seed: number;
  drawCalls: number;
  triangles: number;
}

export interface UiInspect {
  gridId: number;
  x: number;
  y: number;
  structName: string;
  room: number;
  fields: { name: string; value: number }[];
  selected: boolean;
}

export interface UiCrew {
  id: number;
  name: string;
  role: string;
  activity: string;
  /** 0..100, 100 = fully rested. */
  rest: number;
  drafted: boolean;
  /** Human-readable current job, or null. */
  job: string | null;
  priorities: Record<WorkCategory, number>;
  /** The role's default priorities (for "differs from role" marks and reset). */
  defaults: Record<WorkCategory, number>;
}

export type UiTool = 'select' | 'build' | 'deconstruct' | 'cancel';
export type UiBuildKind = 'wall' | 'floor' | 'door';
export interface UiToolState {
  tool: UiTool;
  build: UiBuildKind;
}

export type UiCutaway = 'auto' | 'up' | 'down';

export interface UiError {
  message: string;
  stack: string;
  time: number;
}

/** Everything the UI may call or observe; built in main.ts. */
export interface UiApi {
  snapshot: Subscribable<UiSnapshot>;
  errors: Subscribable<UiError[]>;
  inspect: Subscribable<UiInspect | null>;
  crew: Subscribable<UiCrew[]>;
  /** Selected crew id, or null (tile selection is reported through `inspect`). */
  selectedCrew: Subscribable<number | null>;
  tool: Subscribable<UiToolState>;
  /** Brief message (e.g. a rejected command), or null. */
  toast: Subscribable<string | null>;
  setTool(state: Partial<UiToolState>): void;
  /** Select a crew member (null clears) and optionally center the camera on them. */
  selectCrew(id: number | null, focus?: boolean): void;
  setCutaway(mode: UiCutaway): void;
  setOverlay(field: string | null): void;
  dispatch(cmd: Command): void;
  setSpeed(speed: 0 | 1 | 2 | 3): void;
  togglePause(): void;
  clearErrors(): void;
  buildRepro(): string;
  /** Called once with the game canvas so the app layer can attach the renderer. */
  attachCanvas(canvas: HTMLCanvasElement): void;
  throwTestError(): void;
}
