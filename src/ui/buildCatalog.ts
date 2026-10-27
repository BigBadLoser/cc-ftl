import type { UiApi, UiBuildKind, UiCost, UiModuleDef, UiToolState } from './api';
/** Icons of the tool cards (all in Icon.svelte). */
type IconName = 'wall' | 'floor' | 'door' | 'pick' | 'flag';

/** Catalog tabs in their fixed order. `mining` has only rock tools and shows only when the node has asteroids or pods. */
export const CATEGORIES = [
  { id: 'structure', label: 'Structure' },
  { id: 'power', label: 'Power' },
  { id: 'systems', label: 'Systems' },
  { id: 'life', label: 'Life support' },
  { id: 'production', label: 'Production' },
  { id: 'storage', label: 'Storage' },
  { id: 'defence', label: 'Defence' },
  { id: 'utility', label: 'Utility' },
  { id: 'mining', label: 'Mining' },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]['id'];

/** One card: a module to place, or a drag tool (structure, rock). */
export interface Entry {
  key: string;
  kind: 'module' | 'tool';
  id: string;
  name: string;
  category: CategoryId;
  cost: UiCost[];
  description: string;
  icon?: IconName;
  def?: UiModuleDef;
  locked?: boolean;
}

const TOOLS: { id: UiBuildKind; name: string; category: CategoryId; icon: IconName; description: string }[] = [
  { id: 'wall', name: 'Wall', category: 'structure', icon: 'wall', description: 'Drag a line of wall. Walls hold air and block movement.' },
  { id: 'floor', name: 'Floor', category: 'structure', icon: 'floor', description: 'Drag out deck plating. Rooms need floor before they hold air.' },
  { id: 'door', name: 'Door', category: 'structure', icon: 'door', description: 'A door in a wall. Crew pass through, air does not while it is shut.' },
  { id: 'hull', name: 'Hull plan', category: 'structure', icon: 'wall', description: 'Drag a rectangle to plan the ship\'s outer hull, free and any time. A shipyard builds it; interior walls and doors are your own builds.' },
  { id: 'dig', name: 'Dig rock', category: 'mining', icon: 'pick', description: 'Drag over asteroid rock to dig it out to floor.' },
  { id: 'level', name: 'Level rock', category: 'mining', icon: 'floor', description: 'Drag over rock to level it to ground.' },
  { id: 'finish', name: 'Finish rock', category: 'mining', icon: 'wall', description: 'Drag over rock to cut it into a finished rock wall.' },
  { id: 'mine', name: 'Mine ore', category: 'mining', icon: 'pick', description: 'Drag a rectangle over ore. Mining pods cut the ore tiles in it.' },
  { id: 'claim', name: 'Claim asteroid', category: 'mining', icon: 'flag', description: 'Drag a rectangle on an asteroid to start a base there.' },
];

export function buildEntries(api: UiApi, defs: UiModuleDef[]): Entry[] {
  const tools: Entry[] = TOOLS.map((t) => ({ key: `tool:${t.id}`, kind: 'tool', id: t.id, name: t.name, category: t.category, cost: api.structCosts[t.id] ?? [], description: t.description, icon: t.icon }));
  const mods: Entry[] = defs.map((d) => ({ key: d.id, kind: 'module', id: d.id, name: d.name, category: d.category, cost: d.cost, description: d.description, def: d, locked: d.locked }));
  return [...tools, ...mods];
}

/** Visible tabs: non-empty ones in the stable order (`mining` only when relevant). */
export function visibleCategories(entries: Entry[], miningRelevant: boolean): { id: CategoryId; label: string; count: number }[] {
  return CATEGORIES.map((c) => ({ ...c, count: entries.filter((e) => e.category === c.id).length })).filter((c) => c.count > 0 && (c.id !== 'mining' || miningRelevant));
}

/** A search across every category (name, then description), else the cards of the tab. */
export function filterEntries(entries: Entry[], cat: CategoryId, query: string, miningRelevant: boolean): Entry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries.filter((e) => e.category === cat);
  return entries.filter((e) => (e.category !== 'mining' || miningRelevant) && (e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)));
}

export const isSelected = (e: Entry, st: UiToolState): boolean => st.tool === 'build' && (e.kind === 'module' ? st.build === 'module' && st.moduleDef === e.id : st.build === e.id);

/** Items the stock is short of for a cost list. */
export const shortOf = (cost: UiCost[], have: (item: string) => number): UiCost[] => cost.filter((c) => have(c.item) < c.count);

/** An access offset (rotation 0, from the footprint's top-left) rotated clockwise `rot` quarter turns, in a w x h footprint. */
export function rotateAccess(w: number, h: number, rot: number, dx: number, dy: number): { x: number; y: number } {
  let [x, y, ww, hh] = [dx, dy, w, h];
  for (let i = 0; i < rot; i++) {
    [x, y] = [hh - 1 - y, x];
    [ww, hh] = [hh, ww];
  }
  return { x, y };
}

const HW = 64; // half a tile's width in world px
const HH = 32;
const iso = (x: number, y: number) => ({ x: (x - y) * HW, y: (x + y) * HH });

export interface PreviewGeometry {
  /** Diamond corner points (SVG `points`) of each footprint tile, grid tiles around it, and the access tile. */
  foot: string[];
  grid: string[];
  access: string | null;
  accessLabel: { x: number; y: number } | null;
  /** The sprite's CSS box inside the preview. */
  sprite: { left: number; top: number; width: number; height: number } | null;
}

const diamond = (x: number, y: number, s: number, ox: number, oy: number) => {
  const c = iso(x, y);
  const px = (dx: number, dy: number) => `${(ox + (c.x + dx) * s).toFixed(1)},${(oy + (c.y + dy) * s).toFixed(1)}`;
  return `${px(0, -HH)} ${px(HW, 0)} ${px(0, HH)} ${px(-HW, 0)}`;
};

/** Lay the isometric preview out in a box: footprint tiles, the access tile, a grid around them and the sprite (anchored at the front tile centre), scaled to fit. */
export function previewGeometry(w: number, h: number, access: { x: number; y: number } | null, thumb: { w: number; h: number; ax: number; ay: number } | null, box: { w: number; h: number }): PreviewGeometry {
  const front = iso(w - 1, h - 1);
  const tiles: { x: number; y: number }[] = [];
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) tiles.push({ x, y });
  if (access) tiles.push(access);
  // Scale by the content (footprint, access, sprite); the grid ring around it just frames it.
  let cx0 = Infinity, cy0 = Infinity, cx1 = -Infinity, cy1 = -Infinity;
  const own = [...Array.from({ length: w * h }, (_, i) => ({ x: i % w, y: Math.floor(i / w) })), ...(access ? [access] : [])];
  for (const t of own) { const c = iso(t.x, t.y); cx0 = Math.min(cx0, c.x - HW); cy0 = Math.min(cy0, c.y - HH); cx1 = Math.max(cx1, c.x + HW); cy1 = Math.max(cy1, c.y + HH); }
  if (thumb) { cx0 = Math.min(cx0, front.x - thumb.ax); cy0 = Math.min(cy0, front.y - thumb.ay); cx1 = Math.max(cx1, front.x - thumb.ax + thumb.w); cy1 = Math.max(cy1, front.y - thumb.ay + thumb.h); }
  const pad = 22;
  const s = Math.min(0.8, (box.w - pad * 2) / (cx1 - cx0), (box.h - pad * 2) / (cy1 - cy0));
  const ox = box.w / 2 - ((cx0 + cx1) / 2) * s;
  const oy = box.h / 2 - ((cy0 + cy1) / 2) * s;
  const isFoot = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const isAcc = (x: number, y: number) => !!access && access.x === x && access.y === y;
  const ac = access ? iso(access.x, access.y) : null;
  return {
    grid: tiles.filter((t) => !isFoot(t.x, t.y) && !isAcc(t.x, t.y)).map((t) => diamond(t.x, t.y, s, ox, oy)),
    foot: tiles.filter((t) => isFoot(t.x, t.y)).map((t) => diamond(t.x, t.y, s, ox, oy)),
    access: access ? diamond(access.x, access.y, s, ox, oy) : null,
    accessLabel: ac ? { x: ox + ac.x * s, y: oy + ac.y * s + 4 } : null,
    sprite: thumb ? { left: ox + (front.x - thumb.ax) * s, top: oy + (front.y - thumb.ay) * s, width: thumb.w * s, height: thumb.h * s } : null,
  };
}
