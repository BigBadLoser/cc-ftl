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
  zoom: number;
  sprites: number;
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
  hp: number;
  maxHp: number;
  dead: boolean;
  /** Present while downed: seconds until bleed-out and whether stabilized in a bed. */
  downed: { bleed: number; stabilized: boolean } | null;
  /** Name of the crew member carrying this one, or null. */
  carriedBy: string | null;
  carrying: { item: string; count: number } | null;
}

/** A placed module, for the inspector and the debug panel. */
export interface UiModule {
  id: number;
  def: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  priority: number;
  enabled: boolean;
  powered: boolean;
  /** Units per second: positive supplies, negative draws. */
  power: number;
}

/** A module the build menu offers. */
export interface UiModuleDef {
  id: string;
  name: string;
  w: number;
  h: number;
  power: number;
  cost: string;
}

export interface UiStats {
  supply: number;
  demand: number;
  /** Average O2 (kPa) of rooms with crew in them, or null when nobody is inside one. */
  o2: number | null;
}

export type UiAlertKind =
  | 'fire.started' | 'hull.breach' | 'power.shortage' | 'o2.low' | 'crew.downed' | 'crew.died' | 'crew.rescued'
  | 'job.missingMaterials' | 'storage.full';

export interface UiAlert {
  id: number;
  kind: UiAlertKind;
  text: string;
  /** Where the camera goes when tapped, or null if unknown. */
  at: { x: number; y: number } | null;
}

export interface UiLegend {
  label: string;
  minLabel: string;
  maxLabel: string;
  /** CSS colours, low to high. */
  gradient: string[];
}

export type UiTool = 'select' | 'build' | 'deconstruct' | 'cancel';
export type UiBuildKind = 'wall' | 'floor' | 'door' | 'module';
export interface UiToolState {
  tool: UiTool;
  build: UiBuildKind;
  /** Module def chosen in the Modules build tab, or null. */
  moduleDef: string | null;
  /** Quarter turns clockwise for module placement. */
  rot: number;
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
  modules: Subscribable<UiModule[]>;
  moduleDefs: UiModuleDef[];
  selectedModule: Subscribable<number | null>;
  selectModule(id: number | null): void;
  stats: Subscribable<UiStats>;
  alerts: Subscribable<UiAlert[]>;
  /** Overlay ids offered by the picker, in order. */
  overlayList: { id: string; label: string }[];
  overlayLegend(id: string): UiLegend | null;
  dismissAlert(id: number): void;
  /** Move the camera to an alert's location. */
  focusAlert(id: number): void;
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
