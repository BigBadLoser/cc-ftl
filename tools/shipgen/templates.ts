/**
 * Contact sheets of hand-drawn ship templates (dev tool, not shipped): the starter ships and their layout variants, side by
 * side, in the detail, structure, silhouette and iso views. The iso view approximates the in-game camera (x runs down-right,
 * y down-left, engines toward the viewer): hull slab, floors, walls and modules as blocks of their rough height.
 *   node tools/shipgen/cli.js --templates tools/shipgen/starters/prospector.ts --views detail,structure,silhouette,iso --out <dir>
 * The module exports `variants: { name: string; note?: string; template: ShipTemplate }[]`.
 */
import { content } from '../../src/content';
import { footprintTiles, openTilesOf, validateTemplate, type GenResult, type ModuleDef, type RoomRole, type ShipTemplate } from '../../src/sim';
import { Raster, drawShip } from './draw';
import { drawSilhouette, drawStructure } from './views';

type RGB = [number, number, number];
export interface Variant {
  name: string;
  note?: string;
  /** Shown in the label: the current favourite, a riff on it, or a new concept. */
  kind?: 'favourite' | 'riff' | 'new' | 'shipped';
  template: ShipTemplate;
}
export type TemplateView = 'detail' | 'structure' | 'silhouette' | 'iso';

const defs = content.modules as Record<string, ModuleDef>;

/** A role for a room from what stands in it (the detail and structure views tint by role; empty rooms are corridors). */
function roleOf(ids: string[]): RoomRole {
  const has = (p: (d: ModuleDef, id: string) => boolean): boolean => ids.some((id) => defs[id] && p(defs[id] as ModuleDef, id));
  if (has((d) => !!d.engine)) return 'engine';
  if (has((d) => d.console === 'helm')) return 'bridge';
  if (has((d) => !!d.weapon)) return 'weapons';
  if (has((_, id) => id.includes('refinery') || id.includes('pod_bay'))) return 'industry';
  if (has((d) => !!d.bed)) return 'quarters';
  if (has((d) => !!d.galley)) return 'support';
  if (has((d) => d.power > 0)) return 'reactor';
  if (has((d) => !!d.vehicleBay)) return 'hangar';
  if (has((d) => !!d.storage)) return 'cargo';
  if (has((d) => !!d.airlock)) return 'dock';
  return ids.some((id) => id !== 'module.light') ? 'support' : 'hall';
}

/** A GenResult wrapper for a hand-drawn template: rooms by flood fill over floor (walls and doors split them). */
export function templateResult(name: string, t: ShipTemplate): GenResult {
  const height = t.rows.length;
  const width = Math.max(...t.rows.map((r) => r.length));
  const at = (x: number, y: number): string => t.rows[y]?.[x] ?? '.';
  const roomOf = new Int16Array(width * height).fill(-1);
  const rooms: GenResult['rooms'] = [];
  const modsAt = new Map<number, string[]>();
  for (const m of t.modules ?? []) {
    const d = defs[m.def];
    if (!d) continue;
    for (const tile of footprintTiles(d, m.x, m.y, m.rot)) {
      const k = tile.y * width + tile.x;
      modsAt.set(k, [...(modsAt.get(k) ?? []), m.def]);
    }
  }
  for (let s = 0; s < width * height; s++) {
    if (roomOf[s] !== -1 || at(s % width, Math.floor(s / width)) !== '_') continue;
    const idx = rooms.length;
    const stack = [s];
    roomOf[s] = idx;
    const ids: string[] = [];
    let n = 0;
    while (stack.length) {
      const i = stack.pop() as number;
      n++;
      ids.push(...(modsAt.get(i) ?? []));
      const x = i % width; const y = Math.floor(i / width);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        const j = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || roomOf[j] !== -1 || at(nx, ny) !== '_') continue;
        roomOf[j] = idx;
        stack.push(j);
      }
    }
    rooms.push({ role: roleOf(ids), tiles: n } as unknown as GenResult['rooms'][number]);
  }
  return {
    template: t, rooms, roomOf, width, height, role: name, archetype: 'starter' as GenResult['archetype'], topology: '', attempts: 1,
    problems: validateTemplate(t, defs), failures: [],
  };
}

/**
 * Walkable tiles (floor or door, not under a solid module) that a crew member cannot reach from the largest walkable
 * region: the coordinates behind validateTemplate's "unreachable: N walkable tiles" problem.
 */
export function unreachableTiles(t: ShipTemplate): string[] {
  const h = t.rows.length; const w = Math.max(...t.rows.map((r) => r.length));
  const solid = new Uint8Array(w * h);
  for (const m of t.modules ?? []) {
    const d = defs[m.def];
    if (!d?.solid) continue;
    const open = openTilesOf(d, m.x, m.y, m.rot);
    for (const tile of footprintTiles(d, m.x, m.y, m.rot)) if (!open.some((o) => o.x === tile.x && o.y === tile.y)) solid[tile.y * w + tile.x] = 1;
  }
  const walk = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && '_D'.includes(t.rows[y]?.[x] ?? '.') && !solid[y * w + x];
  const region = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (region[s] !== -1 || !walk(s % w, Math.floor(s / w))) continue;
    const id = sizes.length; let n = 0; const st = [s]; region[s] = id;
    while (st.length) {
      const i = st.pop() as number; n++;
      const x = i % w; const y = Math.floor(i / w);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        const j = ny * w + nx;
        if (walk(nx, ny) && region[j] === -1) { region[j] = id; st.push(j); }
      }
    }
    sizes.push(n);
  }
  const main = sizes.indexOf(Math.max(...sizes));
  const out: string[] = [];
  for (let i = 0; i < w * h; i++) if (region[i] >= 0 && region[i] !== main) out.push(`${i % w},${Math.floor(i / w)}`);
  return out;
}

// --- iso view ---------------------------------------------------------------------------------------------------------

function fillPoly(r: Raster, pts: [number, number][], c: RGB): void {
  const ys = pts.map((p) => p[1]);
  const y0 = Math.max(0, Math.floor(Math.min(...ys))); const y1 = Math.min(r.height - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i] as [number, number]; const [bx, by] = pts[(i + 1) % pts.length] as [number, number];
      if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) r.rect(Math.round(xs[k] as number), y, Math.round(xs[k + 1] as number) - Math.round(xs[k] as number), 1, c);
  }
}

/** Height (in tile widths) and colour of a module block in the iso view. */
function isoStyle(id: string, d: ModuleDef): { h: number; c: RGB } | null {
  if (id === 'module.light' || id === 'module.chair') return null;
  if (d.engine) return { h: 1.5, c: [235, 120, 50] };
  if (d.container) return { h: 1.6, c: [214, 128, 54] };
  if (d.power > 0) return { h: 1.3, c: [225, 205, 70] };
  if (d.weapon) return { h: 1.25, c: [235, 70, 130] };
  if (d.shieldGen) return { h: 1.15, c: [60, 215, 215] };
  if (d.airlock) return { h: 1.2, c: [225, 225, 230] };
  if (d.vehicleBay) return { h: 0.9, c: [170, 175, 200] };
  if (id.includes('refinery')) return { h: 1.4, c: [240, 150, 60] };
  if (id.includes('pod_bay')) return { h: 0.9, c: [200, 185, 90] };
  if ((d.o2PerSec ?? 0) > 0) return { h: 1.0, c: [100, 215, 150] };
  if (d.console) return { h: 0.6, c: [90, 160, 245] };
  if (d.bed) return { h: 0.3, c: [150, 200, 120] };
  if (d.storage) return { h: id.includes('ore') ? 0.8 : id.includes('cargo_container') ? 1.1 : 0.7, c: id.includes('ore') ? [190, 160, 70] : [185, 150, 100] };
  return { h: 0.6, c: [170, 170, 185] };
}

/** Draw the template in iso at (ox, oy); `a` is half a tile's screen width. Returns the drawing's size. */
export function drawIso(r: Raster, t: ShipTemplate, ox: number, oy: number, a: number, dryRun = false): { w: number; h: number } {
  const H = t.rows.length; const W = Math.max(...t.rows.map((x) => x.length));
  const b = a / 2; // half tile height
  const z = a; // one unit of height in px
  const SLAB = 0.45; const WALL = 0.8;
  const sx = (x: number, y: number): number => (x - y) * a;
  const sy = (x: number, y: number, h: number): number => (x + y) * b - h * z;
  const minX = sx(0, H); const maxX = sx(W, 0);
  const minY = sy(0, 0, WALL + 1.6); const maxY = sy(W, H, -SLAB);
  if (dryRun) return { w: Math.ceil(maxX - minX), h: Math.ceil(maxY - minY) };
  const X = (x: number, y: number): number => ox + sx(x, y) - minX;
  const Y = (x: number, y: number, h: number): number => oy + sy(x, y, h) - minY;
  const at = (x: number, y: number): string => t.rows[y]?.[x] ?? '.';
  // Per-cell columns: [from, to, colour]; drawn back to front.
  const cols = new Map<number, { lo: number; hi: number; c: RGB; top?: RGB }[]>();
  const add = (x: number, y: number, lo: number, hi: number, c: RGB, top?: RGB): void => {
    const k = y * W + x;
    cols.set(k, [...(cols.get(k) ?? []), { lo, hi, c, ...(top ? { top } : {}) }]);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = at(x, y);
      if (c === '.') continue;
      if (c === '=') { add(x, y, -0.15, 0.05, [150, 70, 150]); continue; }
      add(x, y, -SLAB, 0, [52, 66, 82], c === 'D' ? [200, 140, 50] : c === '#' ? [70, 84, 100] : [96, 104, 118]);
      if (c === '#') add(x, y, 0, WALL, [62, 96, 120], [110, 150, 175]);
    }
  }
  for (const m of t.modules ?? []) {
    const d = defs[m.def];
    if (!d) continue;
    const st = isoStyle(m.def, d);
    if (!st) continue;
    for (const tile of footprintTiles(d, m.x, m.y, m.rot)) add(tile.x, tile.y, 0, st.h, st.c);
  }
  const order = [...cols.keys()].sort((p, q) => ((p % W) + Math.floor(p / W)) - ((q % W) + Math.floor(q / W)) || (p % W) - (q % W));
  const shade = (c: RGB, k: number): RGB => c.map((v) => Math.min(255, v * k)) as RGB;
  for (const k of order) {
    const x = k % W; const y = Math.floor(k / W);
    for (const col of (cols.get(k) ?? []).sort((p, q) => p.lo - q.lo)) {
      // Left face (south side, facing down-left) and right face (east side, facing down-right), then the top.
      fillPoly(r, [[X(x, y + 1), Y(x, y + 1, col.hi)], [X(x + 1, y + 1), Y(x + 1, y + 1, col.hi)], [X(x + 1, y + 1), Y(x + 1, y + 1, col.lo)], [X(x, y + 1), Y(x, y + 1, col.lo)]], shade(col.c, 0.75));
      fillPoly(r, [[X(x + 1, y + 1), Y(x + 1, y + 1, col.hi)], [X(x + 1, y), Y(x + 1, y, col.hi)], [X(x + 1, y), Y(x + 1, y, col.lo)], [X(x + 1, y + 1), Y(x + 1, y + 1, col.lo)]], shade(col.c, 0.55));
      fillPoly(r, [[X(x, y), Y(x, y, col.hi)], [X(x + 1, y), Y(x + 1, y, col.hi)], [X(x + 1, y + 1), Y(x + 1, y + 1, col.hi)], [X(x, y + 1), Y(x, y + 1, col.hi)]], col.top ?? shade(col.c, 1.1));
    }
  }
  return { w: Math.ceil(maxX - minX), h: Math.ceil(maxY - minY) };
}

/** A sheet of variants in one view, `s` px per tile (iso: half a tile is s px wide). */
export function templateSheet(title: string, variants: Variant[], view: TemplateView, s = 12, maxWidth = 2600): { raster: Raster; text: string } {
  const gs = variants.map((v) => templateResult(v.name, v.template));
  const size = (g: GenResult): { w: number; h: number } =>
    view === 'iso' ? drawIso(new Raster(1, 1), g.template, 0, 0, s, true) : { w: g.width * s, h: g.height * s };
  const sizes = gs.map(size);
  const cellW = Math.max(...sizes.map((z) => z.w)) + 24;
  const perLine = Math.max(10, Math.floor((cellW - 24) / 8));
  const wrap = (t: string): string[] => t.split(' ').reduce<string[]>((ls, w) => {
    const last = ls[ls.length - 1];
    if (last !== undefined && (last + ' ' + w).length <= perLine) ls[ls.length - 1] = `${last} ${w}`;
    else ls.push(w);
    return ls;
  }, []);
  const noteLines = Math.max(0, ...variants.map((v) => (v.note ? wrap(v.note).length : 0)));
  const cellH = Math.max(...sizes.map((z) => z.h)) + 32 + noteLines * 13;
  const cols = Math.max(1, Math.min(variants.length, Math.floor(maxWidth / cellW)));
  const rowsN = Math.ceil(variants.length / cols);
  const r = new Raster(Math.max(cols * cellW + 16, 600), rowsN * cellH + 40);
  r.text(`${title}  ${view}`, 8, 8, [235, 235, 235], 3);
  const text: string[] = [];
  gs.forEach((g, i) => {
    const v = variants[i] as Variant;
    const ox = 8 + (i % cols) * cellW;
    const oy = 40 + Math.floor(i / cols) * cellH;
    const tiles = v.template.rows.join('').replace(/[.=]/g, '').length;
    r.text(`${v.name}  ${g.width}X${g.height}  ${tiles} TILES${g.problems.length ? '  BAD' : ''}`, ox, oy, g.problems.length ? [255, 90, 90] : [230, 230, 230], 2);
    if (v.note) wrap(v.note).forEach((l, k) => r.text(l, ox, oy + 13 + k * 13, [150, 170, 200], 2));
    const y0 = oy + 20 + noteLines * 13;
    if (view === 'iso') drawIso(r, g.template, ox, y0, s);
    else (view === 'silhouette' ? drawSilhouette : view === 'structure' ? drawStructure : drawShip)(r, g, ox, y0, s);
    const lost = g.problems.some((p) => p.startsWith('unreachable')) ? `\n  unreachable at ${unreachableTiles(v.template).join(' ')}` : '';
    text.push(`${v.name}: ${g.width}x${g.height}, ${tiles} tiles${g.problems.length ? `\n  ${[...new Set(g.problems)].join('\n  ')}` : ''}${lost}`);
  });
  return { raster: r, text: text.join('\n') };
}

const VIEW_SCALE: Record<TemplateView, number> = { iso: 9, silhouette: 7, structure: 7, detail: 12 };

/**
 * One board per ship: a column per variant, a row per view (default iso, silhouette, structure, detail), a small label under
 * every cell (name, kind, tile count; red when the template has problems) and the variant's one-line note under its column.
 */
export function templateBoard(title: string, variants: Variant[], views: TemplateView[] = ['iso', 'silhouette', 'structure', 'detail']): { raster: Raster; text: string } {
  const gs = variants.map((v) => templateResult(v.name, v.template));
  const cellSize = (view: TemplateView, g: GenResult): { w: number; h: number } =>
    view === 'iso' ? drawIso(new Raster(1, 1), g.template, 0, 0, VIEW_SCALE.iso, true) : { w: g.width * VIEW_SCALE[view], h: g.height * VIEW_SCALE[view] };
  const LABEL = 22;
  const colW = Math.max(...views.flatMap((v) => gs.map((g) => cellSize(v, g).w))) + 28;
  const rowH = views.map((v) => Math.max(...gs.map((g) => cellSize(v, g).h)) + LABEL + 14);
  const perLine = Math.floor((colW - 20) / 8);
  const wrap = (t: string): string[] => t.split(' ').reduce<string[]>((ls, w) => {
    const last = ls[ls.length - 1];
    if (last !== undefined && `${last} ${w}`.length <= perLine) ls[ls.length - 1] = `${last} ${w}`;
    else ls.push(w);
    return ls;
  }, []);
  const noteH = Math.max(0, ...variants.map((v) => (v.note ? wrap(v.note).length : 0))) * 13 + 10;
  const r = new Raster(variants.length * colW + 16, 44 + rowH.reduce((a, b) => a + b, 0) + noteH);
  r.text(`${title}  ${views.join(' / ')}`, 8, 8, [235, 235, 235], 3);
  const text: string[] = [];
  gs.forEach((g, i) => {
    const v = variants[i] as Variant;
    const ox = 8 + i * colW;
    const tiles = v.template.rows.join('').replace(/[.=]/g, '').length;
    const bad = g.problems.length > 0;
    let oy = 44;
    views.forEach((view, k) => {
      if (view === 'iso') drawIso(r, g.template, ox, oy, VIEW_SCALE.iso);
      else (view === 'silhouette' ? drawSilhouette : view === 'structure' ? drawStructure : drawShip)(r, g, ox, oy, VIEW_SCALE[view]);
      r.text(`${v.name}${v.kind ? `  ${v.kind}` : ''}  ${tiles} TILES${bad ? '  BAD' : ''}`, ox, oy + (rowH[k] as number) - LABEL - 6, bad ? [255, 90, 90] : [225, 225, 225], 2);
      oy += rowH[k] as number;
    });
    if (v.note) wrap(v.note).forEach((l, k) => r.text(l, ox, oy + k * 13, [150, 170, 200], 2));
    const lost = g.problems.some((p) => p.startsWith('unreachable')) ? `\n  unreachable at ${unreachableTiles(v.template).join(' ')}` : '';
    text.push(`${v.name}: ${g.width}x${g.height}, ${tiles} tiles${bad ? `\n  ${[...new Set(g.problems)].join('\n  ')}` : ''}${lost}`);
  });
  return { raster: r, text: text.join('\n') };
}
