/**
 * The layout lab's docking state: where each panel sits (docked left, right or bottom, or floating over the grid), whether it is
 * collapsed (a title bar, or a rail button when docked) and how big each dock is. A plain reducer, so it is testable and the
 * arrangement persists as JSON (localStorage, per viewer).
 */
export type PanelId = 'palette' | 'layers' | 'preview';
export type Dock = 'left' | 'right' | 'bottom';
export interface Rect { x: number; y: number; w: number; h: number }
export interface PanelState {
  place: Dock | 'float';
  collapsed: boolean;
  /** The floating window, in css px from the grid area's top-left (kept while docked, for the way back). */
  rect: Rect;
}
export interface DockState {
  panels: Record<PanelId, PanelState>;
  /** Dock sizes in percent of the work area (left, right: of its width; bottom: of its height). */
  sizes: Record<Dock, number>;
  /** Which palette groups are open. */
  groups: Record<Group, boolean>;
}
export type Group = 'modules' | 'rooms';
export type DockAction =
  | { type: 'dock'; id: PanelId; dock: Dock }
  | { type: 'float'; id: PanelId; rect?: Rect }
  | { type: 'rect'; id: PanelId; rect: Rect }
  | { type: 'collapse'; id: PanelId; collapsed?: boolean }
  | { type: 'size'; dock: Dock; size: number }
  | { type: 'group'; group: Group; open: boolean }
  | { type: 'reset' };

export const PANELS: readonly PanelId[] = ['palette', 'layers', 'preview'];
export const TITLES: Record<PanelId, string> = { palette: 'Palette', layers: 'Layers and key', preview: 'Preview' };
export const MIN_RECT = { w: 220, h: 140 };
const MIN_SIZE = 12, MAX_SIZE = 60;

export const DEFAULT_DOCK: DockState = {
  panels: {
    palette: { place: 'left', collapsed: false, rect: { x: 16, y: 16, w: 260, h: 420 } },
    layers: { place: 'right', collapsed: false, rect: { x: 16, y: 16, w: 260, h: 420 } },
    preview: { place: 'bottom', collapsed: false, rect: { x: 560, y: 380, w: 520, h: 300 } },
  },
  sizes: { left: 17, right: 17, bottom: 35 },
  groups: { modules: true, rooms: true },
};

const clone = (s: DockState): DockState => JSON.parse(JSON.stringify(s)) as DockState; // plain data (a Svelte state proxy cannot be structuredClone-d)
const clampSize = (n: number): number => Math.max(MIN_SIZE, Math.min(MAX_SIZE, n));

/** A window rect kept at least minimum size and on the positive side of the area's origin. */
export function clampRect(r: Rect): Rect {
  return { x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)), w: Math.max(MIN_RECT.w, Math.round(r.w)), h: Math.max(MIN_RECT.h, Math.round(r.h)) };
}

export function dockReducer(state: DockState, a: DockAction): DockState {
  if (a.type === 'reset') return clone(DEFAULT_DOCK);
  const s = clone(state);
  if (a.type === 'size') {
    s.sizes[a.dock] = clampSize(a.size);
    return s;
  }
  if (a.type === 'group') {
    s.groups[a.group] = a.open;
    return s;
  }
  const p = s.panels[a.id];
  if (a.type === 'dock') { p.place = a.dock; p.collapsed = false; }
  else if (a.type === 'float') { p.place = 'float'; p.collapsed = false; if (a.rect) p.rect = clampRect(a.rect); }
  else if (a.type === 'rect') p.rect = clampRect(a.rect);
  else p.collapsed = a.collapsed ?? !p.collapsed;
  return s;
}

/** The panels in a dock, in panel order. */
export const panelsIn = (s: DockState, dock: Dock): PanelId[] => PANELS.filter((id) => s.panels[id].place === dock);
/** The floating panels. */
export const floating = (s: DockState): PanelId[] => PANELS.filter((id) => s.panels[id].place === 'float');
/** A dock is open (a resizable pane) while at least one of its panels is expanded; otherwise its panels show as rail buttons. */
export const dockOpen = (s: DockState, dock: Dock): boolean => panelsIn(s, dock).some((id) => !s.panels[id].collapsed);

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isRect = (r: unknown): r is Rect => !!r && typeof r === 'object' && ['x', 'y', 'w', 'h'].every((k) => isNum((r as Record<string, unknown>)[k]));

/** A saved arrangement back into a state: anything malformed falls back to the default for that part. */
export function parseDock(json: string | null): DockState {
  const out = clone(DEFAULT_DOCK);
  if (!json) return out;
  try {
    const raw = JSON.parse(json) as { panels?: Record<string, Partial<PanelState>>; sizes?: Record<string, unknown>; groups?: Record<string, unknown> };
    for (const id of PANELS) {
      const r = raw.panels?.[id];
      if (!r) continue;
      if (r.place === 'left' || r.place === 'right' || r.place === 'bottom' || r.place === 'float') out.panels[id].place = r.place;
      if (typeof r.collapsed === 'boolean') out.panels[id].collapsed = r.collapsed;
      if (isRect(r.rect)) out.panels[id].rect = clampRect(r.rect);
    }
    for (const d of ['left', 'right', 'bottom'] as const) {
      const n = raw.sizes?.[d];
      if (isNum(n)) out.sizes[d] = clampSize(n);
    }
    for (const g of ['modules', 'rooms'] as const) {
      const b = raw.groups?.[g];
      if (typeof b === 'boolean') out.groups[g] = b;
    }
  } catch { /* a corrupt save: the default */ }
  return out;
}

const KEY = 'cc-ftl.layoutLab.dock';
export function loadDock(): DockState {
  try { return parseDock(localStorage.getItem(KEY)); } catch { return clone(DEFAULT_DOCK); }
}
export function saveDock(s: DockState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: the arrangement lasts the session */ }
}
