/** Starmap level 1 labels (sector names, exits, node names, job marks): laid out in map units, pinned inside the view. */
import type { UiStarNode } from '../../ui/starmapApi';
import { boxAt, placeLabels, type Box, type LabelItem } from './labels';
import type { Cam, Ctx, Scene, View } from './kit';
import type { LabelPool } from './text';

/** A node shows its name only when it matters: yours, the picked one, the one under the cursor. */
export const named = (n: UiStarNode, sc: Scene): boolean => n.known && (n.current || sc.selected === n.id || sc.hover === n.id);

/** Lay the labels out for the camera and scene. `v` is the visible map rectangle. */
export function layoutLevel1(ctx: Ctx, labels: LabelPool, sc: Scene, cam: Cam, v: View, ship: boolean): void {
  const { pal } = ctx;
  const map = sc.map;
  const k = 1 / cam.s;
  const px = (n: number) => n * k;
  const inset = px(sc.inset);
  const clampX = (x: number, m: number) => Math.max(v.x0 + px(m), Math.min(v.x1 - inset - px(m), x));
  const clampY = (y: number, top: number, bottom: number) => Math.max(v.y0 + px(top), Math.min(v.y1 - px(bottom), y));
  const inView = (x: number, y: number) => x > v.x0 && x < v.x1 && y > v.y0 && y < v.y1;
  labels.begin();

  // Exits grouped by the sector they lead to (one label each), at the far gateway pinned into the view; labels that would overlap
  // another label or a sector name step up or down, and are left out when nothing is free.
  const by = new Map<string, (typeof map.exits)[number]>();
  for (const e of map.exits) if (!by.has(e.to)) by.set(e.to, e);
  const obstacles: Box[] = map.sectors.filter((x) => x.known && inView(x.x, x.y)).map((x) => boxAt(clampX(x.x, 80), clampY(x.top - px(24), 24, 50) - 15 * k, 200 * k, 34 * k));
  for (const n of map.nodes) if (named(n, sc) && inView(n.x, n.y)) obstacles.push(boxAt(n.x, n.y + 7 * k, (n.name.length * 7.6 + 10) * k, 18 * k));
  // The legend (bottom left), the level tabs (top left) and the zoom tools (top right) sit over the map.
  obstacles.push({ x0: v.x0, y0: v.y1 - 96 * k, x1: v.x0 + 210 * k, y1: v.y1 });
  obstacles.push({ x0: v.x0, y0: v.y0, x1: v.x0 + 296 * k, y1: v.y0 + 46 * k }, { x0: v.x1 - (sc.inset + 64) * k, y0: v.y0, x1: v.x1, y1: v.y0 + 196 * k });
  const items = [...by.values()].map((e): LabelItem => {
    const w = (`To ${e.name ?? 'uncharted space'}`.length * 9.4 + 16) * k;
    const x = clampX(e.bx, Math.min(w / 2 / k + 8, 150));
    const y = clampY(e.by - px(24), 70, 40) - 15 * k;
    return { key: e.to, cands: [0, 34, -34, 68, -68].map((dy) => boxAt(x, y + dy * k, w, 32 * k)) };
  });
  const placed = placeLabels(items, obstacles);
  for (const e of by.values()) {
    const b = placed.get(e.to);
    if (!b) continue;
    const x = (b.x0 + b.x1) / 2;
    const y = b.y0 + 15 * k;
    labels.put(`To ${e.name ?? 'uncharted space'}`, { font: 'pixel', size: 12, fill: e.name ? pal.text : pal.dim, halo: 2, spacing: 0.04, upper: true }, x, y, k);
    labels.put(`danger ${e.danger}${e.kind === 'gate' ? ' · gate' : e.kind === 'rift' ? ' · rift' : ''} · ${e.fuel} fuel`, { font: 'head', size: 12, fill: pal.dim, halo: 3 }, x, y + px(15), k);
  }

  for (const sec of map.sectors) {
    if (!sec.known || !inView(sec.x, sec.y)) continue;
    const lx = clampX(sec.x, 80);
    const ly = clampY(sec.top - px(24), 24, 50);
    const cur = sec.id === map.currentSector;
    labels.put(sec.name, { font: 'pixel', size: 14, fill: cur ? pal.cyan : pal.text, fillAlpha: cur ? 1 : 0.85, halo: 2, spacing: 0.06, upper: true }, lx, ly, k);
    labels.put(`Danger ${sec.danger}`, { font: 'head', size: 12, fill: pal.danger(sec.danger), halo: 3, spacing: 0.05 }, lx, ly + px(15), k);
  }
  for (const n of map.nodes) {
    if (!n.known || !inView(n.x, n.y)) continue;
    if (n.jobs?.length) labels.put('!', { font: 'pixel', size: 15, fill: n.jobs.some((j) => j.kind === 'bounty') ? pal.red : pal.amber, halo: 3 }, n.x - px(14), n.y + px(5), k);
    if (named(n, sc)) labels.put(n.name, { font: 'head', size: 13, fill: n.current ? pal.cyan : pal.text, halo: 3, spacing: 0.04 }, n.x, n.y + px(20), k);
  }
  void ship;
  labels.end();
}
