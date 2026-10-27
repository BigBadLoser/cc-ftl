/**
 * Starmap zoom level 2 in Pixi, for planning: sectors are solid patches in their cluster's colour (uncharted ones as fog), each with its
 * body, name, danger and known services, joined by connectors that show in the gaps between them, with the plotted route on top.
 * Labels are placed so they never overlap. Patches and outlines are pieces; a state change recolours them without rebuilding.
 */
import { Container, Graphics } from 'pixi.js';
import { fillArea } from './area';
import { bodyVariant } from './artIds';
import { boxAt, placeLabels, type Box, type LabelItem } from './labels';
import { boxOf, crispPx, drawOps, fillOps, piece, spriteAt, syncPieces, viewOf, type Cam, type Ctx, type Level, type Piece, type Scene } from './kit';
import { createLabelPool } from './text';
import { loopsOf, newOps, pixelLine, pixelOutline, pixelPolyline, pixelSquare, rectBorder } from './pixel';

export function createLevel2(ctx: Ctx, sc0: Scene, cam0: Cam): Level {
  const { pal, art, dpr } = ctx;
  const map = sc0.map;
  let sc = sc0;
  let cam = cam0;
  let g = 2 / cam.s;
  let zoomKey = '';
  const root = new Container();
  const clusterBox = root.addChild(new Container());
  const linkBox = root.addChild(new Container());
  const sectorBox = root.addChild(new Container());
  const minis = root.addChild(new Container());
  const dyn = root.addChild(new Graphics({ roundPixels: true }));
  const labels = createLabelPool(root, pal.bg);
  for (const c of [root, clusterBox, linkBox, sectorBox, minis, dyn]) c.eventMode = 'none';

  const tintOf = new Map(map.clusters.map((r) => [r.id, r.revealed ? pal.tone(r.tone) : pal.dim]));
  const geom: Piece[] = [];
  const clusterPieces: Piece[] = [];
  for (const r of map.clusters) {
    const c = r.revealed ? pal.tone(r.tone) : pal.dim;
    const box = boxOf(loopsOf(r.outline).flat());
    const a = piece(clusterBox, box, (gf) => fillArea(gf, r.outline), true);
    a.gfx.tint = c;
    a.gfx.alpha = r.known ? 0.05 : r.revealed ? 0.03 : 0.02;
    const l = piece(clusterBox, box, (gf, gr) => drawOps(gf, pixelOutline(r.outline, gr, r.known ? 2 : 1)));
    l.gfx.tint = c;
    l.gfx.alpha = r.known ? 0.8 : r.revealed ? 0.5 : 0.3;
    clusterPieces.push(a, l);
  }
  for (const l of map.sectorLinks) {
    const p = piece(linkBox, boxOf([l.ax, l.ay, l.bx, l.by]), (gf, gr) => {
      const o = newOps();
      pixelLine(o, l.ax, l.ay, l.bx, l.by, gr, { w: l.kind === 'gate' ? 3 : 2, dash: l.kind === 'rift' ? [2, 3] : undefined });
      drawOps(gf, o);
    });
    p.gfx.tint = l.mine ? pal.green : l.kind === 'gate' ? pal.cyan : l.kind === 'rift' ? pal.text : pal.dim;
    p.gfx.alpha = l.kind === 'rift' ? 0.5 : 0.8;
    geom.push(p);
  }
  interface Sec {
    id: string;
    patch: Piece;
    line: Piece;
    strong: boolean;
  }
  const secs: Sec[] = map.sectors.map((sec) => {
    const box = boxOf(loopsOf(sec.outline).flat());
    const holder = sectorBox.addChild(new Container());
    const base = piece(holder, box, (gf) => fillArea(gf, sec.outline), true);
    base.gfx.tint = pal.bg;
    const patch = piece(holder, box, (gf) => fillArea(gf, sec.outline), true);
    const s: Sec = { id: sec.id, patch, line: null as unknown as Piece, strong: false };
    s.line = piece(holder, box, (gf, gr) => drawOps(gf, pixelOutline(sec.outline, gr, s.strong ? 2 : 1)));
    geom.push(base, patch, s.line);
    return s;
  });
  /** Recolour the patches and outlines for the scene (the fills never change shape; an outline thickens when it is strong). */
  function restyle(): void {
    map.sectors.forEach((sec, i) => {
      const s = secs[i]!;
      const cur = sec.id === map.currentSector;
      const onroute = sc.routeSectors.has(sec.id);
      const picked = sec.id === sc.picked;
      const hov = sec.id === sc.hover;
      const c = sec.known ? (tintOf.get(sec.cluster ?? '') ?? pal.dim) : pal.dim;
      s.patch.gfx.tint = sec.known ? c : pal.panel3;
      s.patch.gfx.alpha = hov ? 0.42 : cur ? 0.45 : sec.known ? 0.3 : 0.55;
      s.line.gfx.tint = picked ? pal.amber : hov ? pal.text : cur ? pal.cyan : onroute ? pal.amber : sec.known ? c : pal.dim;
      s.line.gfx.alpha = picked || hov || cur || onroute ? 1 : sec.known ? 0.85 : 0.5;
      const strong = cur || picked || onroute;
      if (strong !== s.strong) {
        s.strong = strong;
        s.line.at = Number.NaN;
      }
    });
  }

  // Mini bodies: made once, resized with the zoom.
  const services = (() => {
    const by = new Map<string, string[]>();
    for (const n of map.nodes) for (const b of n.badges) if (b !== 'A') by.set(n.sector, [...new Set([...(by.get(n.sector) ?? []), b])]);
    return by;
  })();
  const bodies = art
    ? map.sectors.flatMap((sec) => {
        if (!sec.known) return [];
        const id = bodyVariant(art.art, 'mini', sec.body?.kind ?? 'star', sec.id);
        const f = id ? art.art.frames[id] : null;
        const box = id && f ? spriteAt(ctx, id, sec.x, sec.y, f.w) : null;
        if (!box || !f) return [];
        minis.addChild(box);
        return [{ box, w: f.w, r: sec.hub ? 7 : 5.5 }];
      })
    : [];

  function layout(): void {
    const k = 1 / cam.s;
    const px = (n: number) => n * k;
    for (const b of bodies) b.box.scale.set((crispPx(b.w, b.r * 3.2, dpr) * k) / b.w);
    const cur = map.sectors.find((x) => x.id === map.currentSector);
    const obstacles: Box[] = [];
    const items: { rank: number; d: number; item: LabelItem }[] = [];
    for (const sec of map.sectors) {
      if (!sec.known) continue;
      const mine = sec.id === map.currentSector;
      const r = (mine ? 14 : 8) * k;
      obstacles.push({ x0: sec.x - r, y0: sec.y - r, x1: sec.x + r, y1: sec.y + r });
      const icons = services.get(sec.id)?.length ?? 0;
      const w = Math.max(sec.name.length * 6.4 + 8, icons * 12 + 8, 56) * k;
      const h = (23 + (icons ? 13 : 0)) * k;
      const gap = (mine ? 15 : 10) * k;
      const rank = mine ? 0 : sec.id === sc.picked ? 1 : sc.routeSectors.has(sec.id) ? 2 : 4;
      items.push({ rank, d: cur ? Math.hypot(sec.x - cur.x, sec.y - cur.y) : 0, item: { key: sec.id, must: rank < 2, cands: [boxAt(sec.x, sec.y + gap, w, h), boxAt(sec.x, sec.y - gap - h, w, h)] } });
    }
    for (const r of map.clusters) {
      if (!r.revealed) continue;
      const w = (r.name.length * 12 + 12) * k;
      const h = 30 * k;
      items.push({ rank: 3, d: cur ? Math.hypot(r.x - cur.x, r.y - cur.y) : 0, item: { key: `r:${r.id}`, cands: [-56, 56, -104, 104].map((dy) => boxAt(r.x, r.y + dy * k - h / 2, w, h)) } });
    }
    items.sort((a, b) => a.rank - b.rank || a.d - b.d);
    const placed = placeLabels(items.map((i) => i.item), obstacles);
    dyn.clear();
    if (sc.routePts.length >= 4) {
      const o = newOps();
      pixelPolyline(o, sc.routePts, g, { w: 2 });
      fillOps(dyn, o, pal.amber);
    }
    const chips = new Map<number, ReturnType<typeof newOps>>();
    labels.begin();
    for (const sec of map.sectors) {
      if (!sec.known) {
        labels.put('?', { font: 'pixel', size: 10, fill: pal.dim, fillAlpha: 0.6, halo: 3 }, sec.x, sec.y + px(4), k);
        continue;
      }
      const b = placed.get(sec.id);
      if (!b) continue;
      const mid = (b.x0 + b.x1) / 2;
      const cl = sec.id === map.currentSector;
      labels.put(sec.name, { font: 'head', size: 13, fill: cl ? pal.cyan : pal.text, halo: 3, spacing: 0.04 }, mid, b.y0 + px(10), k);
      labels.put(`danger ${sec.danger}`, { font: 'head', size: 9, fill: pal.danger(sec.danger), halo: 3, spacing: 0.05 }, mid, b.y0 + px(21), k);
      const icons = services.get(sec.id) ?? [];
      icons.forEach((s, i) => {
        const o = chips.get(pal.badge(s)) ?? newOps();
        chips.set(pal.badge(s), o);
        o.r.push(mid + px(-icons.length * 6 + i * 12 + 1), b.y0 + px(24), px(10), px(10));
        labels.put(s, { font: 'head', size: 8, fill: pal.bg, bold: true }, mid + px(-icons.length * 6 + i * 12 + 6), b.y0 + px(31.8), k);
      });
    }
    for (const [c, o] of chips) fillOps(dyn, o, c);
    for (const r of map.clusters) {
      const b = placed.get(`r:${r.id}`);
      if (!b) continue;
      labels.put(r.name, { font: 'pixel', size: 15, fill: pal.tone(r.tone), halo: 3, spacing: 0.08, upper: true }, r.x, b.y0 + px(14), k);
      labels.put(r.typeLabel, { font: 'head', size: 11, fill: pal.dim, halo: 3, spacing: 0.04 }, r.x, b.y0 + px(27), k);
    }
    labels.end();
    const here = map.sectors.find((x) => x.id === map.currentSector);
    if (here) {
      const q = pixelSquare(here.x, here.y, px(12), g);
      const o = newOps();
      rectBorder(o, q.x, q.y, q.width, q.height, g);
      fillOps(dyn, o, pal.cyan);
    }
  }

  function camera(c: Cam): void {
    cam = c;
    g = 2 / c.s;
    const key = g.toFixed(6);
    const zoomed = key !== zoomKey;
    zoomKey = key;
    const v = viewOf(c);
    syncPieces(clusterPieces, v, g, 4 / c.s);
    syncPieces(geom, v, g, 4 / c.s);
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
