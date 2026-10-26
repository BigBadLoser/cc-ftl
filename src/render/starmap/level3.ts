/**
 * Starmap zoom level 3 in Pixi: clusters as solid patches in their colour (uncharted ones as fog), joined by their gates and by routes
 * through unclaimed space, which show in the gaps between them. Your ship is marked where it is. Labels are placed so they never overlap.
 */
import { Container, Graphics } from 'pixi.js';
import { fillArea } from './area';
import { boxAt, placeLabels, type LabelItem } from './labels';
import { boxOf, drawOps, fillOps, piece, syncPieces, viewOf, type Cam, type Ctx, type Level, type Piece, type Scene } from './kit';
import { createLabelPool } from './text';
import { loopsOf, newOps, pixelLine, pixelOutline, pixelSquare, rectBorder } from './pixel';

export function createLevel3(ctx: Ctx, sc0: Scene, cam0: Cam): Level {
  const { pal } = ctx;
  const map = sc0.map;
  let sc = sc0;
  let cam = cam0;
  let g = 2 / cam.s;
  let zoomKey = '';
  const root = new Container();
  const linkBox = root.addChild(new Container());
  const clusterBox = root.addChild(new Container());
  const dyn = root.addChild(new Graphics());
  const labels = createLabelPool(root, pal.bg);
  for (const c of [root, linkBox, clusterBox, dyn]) c.eventMode = 'none';

  const geom: Piece[] = [];
  for (const l of map.clusterLinks) {
    const p = piece(linkBox, boxOf([l.ax, l.ay, l.bx, l.by]), (gf, gr) => {
      const o = newOps();
      pixelLine(o, l.ax, l.ay, l.bx, l.by, gr, {
        w: l.kind === 'gate' ? 1 + Math.min(2, Math.ceil(l.count / 2)) : 1,
        dash: l.kind === 'rift' ? [2, 3] : l.kind === 'through' ? [4, 3] : undefined,
      });
      drawOps(gf, o);
    });
    p.gfx.tint = l.mine ? pal.green : l.kind === 'gate' ? pal.cyan : l.kind === 'rift' ? pal.text : pal.dim;
    p.gfx.alpha = l.kind === 'gate' ? 0.95 : l.kind === 'rift' ? 0.5 : l.kind === 'through' ? 0.6 : 0.7;
    geom.push(p);
  }
  interface Cl {
    patch: Piece;
    line: Piece;
    strong: boolean;
  }
  const cls: Cl[] = map.clusters.map((r) => {
    const box = boxOf(loopsOf(r.outline).flat());
    const holder = clusterBox.addChild(new Container());
    const base = piece(holder, box, (gf) => fillArea(gf, r.outline), true);
    base.gfx.tint = pal.bg;
    const patch = piece(holder, box, (gf) => fillArea(gf, r.outline), true);
    const c: Cl = { patch, line: null as unknown as Piece, strong: false };
    c.line = piece(holder, box, (gf, gr) => drawOps(gf, pixelOutline(r.outline, gr, c.strong ? 2 : 1)));
    geom.push(base, patch, c.line);
    return c;
  });
  function restyle(): void {
    map.clusters.forEach((r, i) => {
      const c = cls[i]!;
      const col = pal.tone(r.tone);
      const hov = r.id === sc.hover;
      const picked = r.id === sc.picked;
      c.patch.gfx.tint = r.revealed ? col : pal.panel3;
      c.patch.gfx.alpha = hov ? 0.4 : r.known ? 0.32 : r.revealed ? 0.18 : 0.5;
      c.line.gfx.tint = picked ? pal.amber : hov ? pal.text : r.current ? pal.cyan : r.revealed ? col : pal.dim;
      c.line.gfx.alpha = picked || hov || r.current ? 1 : r.known ? 0.95 : r.revealed ? 0.7 : 0.5;
      const strong = r.current || picked;
      if (strong !== c.strong) {
        c.strong = strong;
        c.line.at = Number.NaN;
      }
    });
  }

  function layout(): void {
    const k = 1 / cam.s;
    const px = (n: number) => n * k;
    const here = map.sectors.find((x) => x.id === map.currentSector) ?? null;
    const order = [...map.clusters].sort((a, b) => Number(b.current) - Number(a.current) || Number(b.known) - Number(a.known) || b.sectors - a.sectors);
    const items: LabelItem[] = order.map((r) => {
      const name = r.revealed ? r.name : 'Uncharted';
      const w = (name.length * 9 + 12) * k;
      const h = (r.revealed ? 26 : 14) * k;
      return { key: r.id, must: r.current, cands: [0, -30, 30].map((dy) => boxAt(r.x, r.y + dy * k - h / 2, w, h)) };
    });
    const ship = here ? [{ x0: here.x - 9 * k, y0: here.y - 9 * k, x1: here.x + 9 * k, y1: here.y + 9 * k }] : [];
    const placed = placeLabels(items, ship);
    dyn.clear();
    if (here) {
      const a = pixelSquare(here.x, here.y, px(3), g);
      const o = newOps();
      o.r.push(a.x, a.y, a.width, a.height);
      fillOps(dyn, o, pal.cyan);
      const b = pixelSquare(here.x, here.y, px(8), g);
      const ring = newOps();
      rectBorder(ring, b.x, b.y, b.width, b.height, g);
      fillOps(dyn, ring, pal.cyan);
    }
    labels.begin();
    for (const r of map.clusters) {
      const b = placed.get(r.id);
      if (!b) continue;
      const col = r.revealed ? pal.tone(r.tone) : pal.dim;
      labels.put(r.revealed ? r.name : 'Uncharted', { font: 'pixel', size: r.revealed ? 14 : 11, fill: col, fillAlpha: r.revealed ? 1 : 0.7, halo: 3, spacing: 0.08, upper: true }, r.x, b.y0 + px(11), k);
      if (r.revealed) labels.put(`${r.typeLabel} · ${r.sectors} ${r.sectors === 1 ? 'sector' : 'sectors'}`, { font: 'head', size: 11, fill: pal.dim, halo: 3, spacing: 0.04 }, r.x, b.y0 + px(23), k);
    }
    labels.end();
  }

  function camera(c: Cam): void {
    cam = c;
    g = 2 / c.s;
    const key = g.toFixed(6);
    const zoomed = key !== zoomKey;
    zoomKey = key;
    syncPieces(geom, viewOf(c), g, 4 / c.s);
    if (zoomed) layout();
  }
  restyle();
  camera(cam0);

  return {
    root,
    scene(next) {
      sc = next;
      restyle();
      camera(cam);
      layout();
    },
    camera,
    glide() {},
    tick: () => false,
    tip: () => null,
    destroy() {
      labels.destroy();
      root.destroy({ children: true });
    },
  };
}
