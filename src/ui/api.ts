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

/** A loose stack on a floor tile. */
export interface UiStack {
  item: string;
  name: string;
  count: number;
}

export interface UiInspect {
  gridId: number;
  x: number;
  y: number;
  /** The loose item stack on the tile, or null. */
  stack: UiStack | null;
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
  /** Holds items (has a storage panel). */
  storage: boolean;
  /** Crafts recipes (has a production panel). */
  crafting: boolean;
}

/** An item amount with its display name. */
export interface UiCost {
  item: string;
  name: string;
  count: number;
}

export interface UiItemDef {
  id: string;
  name: string;
  stackSize: number;
}

export interface UiRecipe {
  id: string;
  name: string;
  /** Module def id of the station. */
  station: string;
  inputs: UiCost[];
  outputs: UiCost[];
  /** Seconds of work at work speed 1. */
  seconds: number;
}

/** Where an item sprite sits in a sheet, for CSS icons. */
export interface UiIcon {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sheetW: number;
  sheetH: number;
}

/** Ship-wide totals of one item. */
export interface UiStock {
  item: string;
  name: string;
  floor: number;
  stored: number;
  carried: number;
}

export interface UiStorage {
  id: number;
  capacity: number;
  /** Accepted item ids, or null for everything. */
  filter: string[] | null;
  stacks: { item: string; count: number }[];
}

export interface UiOrder {
  recipe: string;
  name: string;
  mode: 'count' | 'keep';
  target: number;
  done: number;
  /** 'keep' orders: units in stock of the first output. */
  have: number;
  /** The order the station is working on now. */
  active: boolean;
}

export interface UiFab {
  id: number;
  orders: UiOrder[];
  /** Craft job now, or null. */
  job: { name: string; progress: number; phase: 'materials' | 'power' | 'crafting' | 'ready' } | null;
}

/** A module the build menu offers. */
export interface UiModuleDef {
  id: string;
  name: string;
  w: number;
  h: number;
  power: number;
  cost: UiCost[];
}

export interface UiStats {
  supply: number;
  demand: number;
  /** Average O2 (kPa) of rooms with crew in them, or null when nobody is inside one. */
  o2: number | null;
}

export type UiAlertKind =
  | 'fire.started' | 'hull.breach' | 'power.shortage' | 'o2.low' | 'crew.downed' | 'crew.died' | 'crew.rescued'
  | 'job.missingMaterials' | 'storage.full' | 'production.done';

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
  items: UiItemDef[];
  recipes: UiRecipe[];
  /** Build cost per struct kind ('floor', 'wall', 'door'). */
  structCosts: Record<string, UiCost[]>;
  /** Icon frames by item id; fills in once the asset manifest is loaded. */
  itemIcons: Subscribable<Record<string, UiIcon>>;
  stock: Subscribable<UiStock[]>;
  storages: Subscribable<UiStorage[]>;
  fabs: Subscribable<UiFab[]>;
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
