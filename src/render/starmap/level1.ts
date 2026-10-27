/**
 * Starmap zoom level 1 in Pixi: sector outlines, central bodies, lanes, nodes, the planned route, jumps reachable now, fleets, the exits
 * from your sector, and the labels. The static geometry (areas, outlines, lanes, nodes) is split into pieces that are built when they
 * come into view and again when the zoom changes the pixel grid; a pan only moves the camera. Sizes follow the old SVG level: the grid is
 * two screen px, icons are a whole number of device px per art px.
 */
import { Container, Graphics } from 'pixi.js';
import type { UiStarNode } from '../../ui/starmapApi';
import { fillArea } from './area';
import { bodyVariant } from './artIds';
import { createLaneMask } from './laneMask';
import { drawOps, fillOps, HALF_BELOW, iconSize, piece, spriteAt, syncPieces, viewOf, boxOf, type Cam, type Ctx, type Glide, type Level, type Piece, type Scene } from './kit';
import { layoutLevel1 } from './level1Labels';
import { createLabelPool } from './text';
import { createNodeLayer } from './level1Nodes';
import { loopsOf, newOps, pixelArrow, pixelDiamondRing, pixelLine, pixelOutline, pixelPolyline, rectBorder } from './pixel';

const dirOf = (deg: number) => ((Math.round(deg / 45) % 8) + 8) % 8;

export function createLevel1(ctx: Ctx, sc0: Scene, cam0: Cam): Level {
  const { pal, art, dpr } = ctx;
  const root = new Container();
  root.eventMode = 'none';
  let sc = sc0;
  let cam = cam0;
  let ship: Glide | null = null;
  let hasShip = false;
  let g = 2 / cam.s;
  let zoomKey = '';
  const map = sc.map;
  const add = <T extends Container>(c: T): T => root.addChild(c);
  const areas = add(new Container());
  const outlines = add(new Container());
  const bodies = add(new Container());
  const laneBox = add(new Container());
  const exitIcons = add(new Container());
  const dyn = add(new Graphics({ roundPixels: true }));
  const fleetBox = add(new Container());
  const nodeLayer = createNodeLayer(ctx, root, map);
  const shipBox = add(new Container());
  const top = add(new Graphics({ roundPixels: true }));
  for (const c of [areas, outlines, bodies, laneBox, exitIcons, dyn, fleetBox, shipBox, top]) c.eventMode = 'none';
  const labels = createLabelPool(root, pal.bg);

  // Static pieces.
  const mask = createLaneMask();
  laneBox.addChild(mask.sprite);
  laneBox.mask = mask.sprite;
  const areaPieces: Piece[] = [];
  const outlinePieces: Piece[] = [];
  const lanePieces: Piece[] = [];
  const secBox = (d: string) => boxOf(loopsOf(d).flat());
  for (const sec of map.sectors) {
    const box = secBox(sec.outline);
    const cur = sec.id === map.currentSector;
    const a = piece(areas, box, (gf) => fillArea(gf, sec.outline), true);
    a.gfx.tint = pal.tone(sec.tone);
    a.gfx.alpha = cur ? 0.12 : sec.known ? 0.07 : 0.02;
    areaPieces.push(a);
    const o = piece(outlines, box, (gf, gr) => drawOps(gf, pixelOutline(sec.outline, gr)));
    o.gfx.tint = pal.tone(sec.tone);
    o.gfx.alpha = cur ? 0.85 : sec.known ? 0.5 : 0.22;
    outlinePieces.push(o);
    if (sec.known && sec.body && art) {
      const id = bodyVariant(art.art, 'body', sec.body.kind, sec.id);
      const spr = id ? spriteAt(ctx, id, sec.body.x, sec.body.y, sec.body.r * 0.75 * 3.2) : null;
      if (spr) {
        spr.alpha = cur ? 1 : 0.55;
        bodies.addChild(spr);
      }
    }
  }
  for (const e of map.edges) {
    const gate = e.gate;
    const [color, alpha] = e.kind === 'route' ? [pal.dim, 0.7] : e.rift ? [pal.text, 0.5] : [pal.cyan, gate ? 0.9 : 0.6];
    const p = piece(laneBox, boxOf([e.ax, e.ay, e.bx, e.by]), (gf, gr) => {
      const o = newOps();
      pixelLine(o, e.ax, e.ay, e.bx, e.by, gr, { w: gate ? 2 : 1, dash: e.rift ? [1, 3] : e.anchor ? [4, 2] : undefined });
      drawOps(gf, o);
    });
    p.gfx.tint = color;
    p.gfx.alpha = alpha;
    lanePieces.push(p);
  }
  for (const e of map.exits) {
    const p = piece(laneBox, boxOf([e.ax, e.ay, e.bx, e.by]), (gf, gr) => {
      const o = newOps();
      pixelLine(o, e.ax, e.ay, e.bx, e.by, gr, { w: e.kind === 'gate' ? 2 : 1, dash: e.kind === 'rift' ? [1, 3] : undefined });
      drawOps(gf, o);
    });
    p.gfx.tint = e.kind === 'rift' ? pal.text : pal.cyan;
    p.gfx.alpha = e.kind === 'rift' ? 0.5 : 0.6;
    lanePieces.push(p);
  }
  const linePieces = [...outlinePieces, ...lanePieces];

  /** Fleets: a chevron beside its node (several at one node fan out) pointing along its heading, a dashed line toward the next node. */
  const marks = (() => {
    const count = new Map<string, number>();
    return map.fleets.map((f) => {
      const k = count.get(f.node) ?? 0;
      count.set(f.node, k + 1);
      const side = ([-90, -135, -45, -160, -20][k % 5] as number) * (Math.PI / 180);
      const heading = f.tx !== null && f.ty !== null ? (Math.atan2(f.ty - f.y, f.tx - f.x) * 180) / Math.PI : -90;
      return { f, ox: Math.cos(side), oy: Math.sin(side), heading };
    });
  })();
  const fleetFrame = art?.art.frames['starmap.fleet.patrol.d0']?.w ?? 48;
  const structFrame = art?.art.frames['starmap.struct.den']?.w ?? 48;

  /** Everything drawn at the current grid that is not a piece: reach lines, route, fleets, exit icons, rings, the ship, labels. */
  function redraw(): void {
    const k = 1 / cam.s;
    const half = cam.s < HALF_BELOW;
    const fleetPx = iconSize(fleetFrame, cam.s, dpr) * k;
    const structPx = iconSize(structFrame, cam.s, dpr) * k;
    dyn.clear();
    if (sc.current && !hasShip) {
      const o = newOps();
      for (const n of map.nodes) if (n.reachable && (!sc.only || sc.only.has(n.id))) pixelLine(o, sc.current.x, sc.current.y, n.x, n.y, g);
      fillOps(dyn, o, pal.green, 0.8);
    }
    if (sc.routePts.length >= 4) {
      const o = newOps();
      pixelPolyline(o, sc.routePts, g, { w: 2, dash: sc.route?.blocker ? [4, 3] : undefined });
      fillOps(dyn, o, pal.amber, 1);
    }
    for (const m of marks) {
      if (m.f.tx === null || m.f.ty === null) continue;
      const o = newOps();
      pixelLine(o, m.f.x, m.f.y, m.f.tx, m.f.ty, g, { dash: [2, 2] });
      fillOps(dyn, o, pal.tone(m.f.tone), 0.55);
    }
    exitIcons.removeChildren().forEach((c) => c.destroy({ children: true }));
    for (const e of map.exits) {
      if (e.kind === 'lane') continue;
      // Just out from the gateway, on the lane where it leaves the sector (the far end is usually off the view).
      const len = Math.hypot(e.bx - e.ax, e.by - e.ay) || 1;
      const out = Math.min(len / 2, 48 * k);
      const s = spriteAt(ctx, `starmap.exit.${e.kind}`, e.ax + ((e.bx - e.ax) / len) * out, e.ay + ((e.by - e.ay) / len) * out, structPx * 1.25, null, half);
      if (s) exitIcons.addChild(s);
    }
    fleetBox.removeChildren().forEach((c) => c.destroy({ children: true }));
    const fx = new Graphics({ roundPixels: true });
    fleetBox.addChild(fx);
    for (const m of marks) {
      const x = m.f.x + m.ox * 54 * k;
      const y = m.f.y + m.oy * 54 * k;
      const id = `starmap.fleet.${m.f.kind}.d${dirOf(m.heading)}`;
      const spr = art?.has(`starmap.fleet.${m.f.kind}.d0`) ? spriteAt(ctx, id, x, y, fleetPx, m.f.tone, half) : null;
      if (spr) fleetBox.addChild(spr);
      else {
        const o = newOps();
        pixelArrow(o, m.heading, g, 1.5);
        const gf = new Graphics({ roundPixels: true });
        gf.position.set(x, y);
        fillOps(gf, o, pal.tone(m.f.tone), 1);
        fleetBox.addChild(gf);
      }
      if (m.f.damaged) {
        const o = newOps();
        rectBorder(o, x - 11 * k, y - 11 * k, 22 * k, 22 * k, 1.2 * k, [2, 2]);
        fillOps(fx, o, pal.amber, 1);
      }
    }
    top.clear();
    const ring = (n: UiStarNode, r: number, color: number) => {
      const o = newOps();
      pixelDiamondRing(o, n.x, n.y, r * k, g);
      fillOps(top, o, color, 1);
    };
    for (const n of map.nodes) {
      if (sc.hover === n.id && n.known) ring(n, 15, pal.text);
      if (sc.selected === n.id) ring(n, 17, pal.amber);
    }
    drawShip();
    layoutLevel1(ctx, labels, sc, cam, viewOf(cam), hasShip);
  }

  let shipDir = -1;
  const shipTrail = new Graphics({ roundPixels: true });
  const shipRing = new Graphics({ roundPixels: true });
  let shipSprite: Container | null = null;
  shipBox.addChild(shipTrail, shipRing);
  function drawShip(): void {
    shipTrail.clear();
    shipRing.clear();
    shipSprite?.destroy({ children: true });
    shipSprite = null;
    shipDir = -1;
    if (!ship) return;
    const k = 1 / cam.s;
    const ang = (Math.atan2(ship.ty - ship.fy, ship.tx - ship.fx) * 180) / Math.PI;
    const t = newOps();
    pixelLine(t, ship.fx, ship.fy, ship.x, ship.y, g, { w: 2 });
    fillOps(shipTrail, t, pal.cyan, 0.8);
    const r = newOps();
    pixelDiamondRing(r, ship.x, ship.y, 13 * k, g);
    fillOps(shipRing, r, pal.cyan, 1);
    shipDir = dirOf(ang);
    const size = iconSize(fleetFrame, cam.s, dpr) * k * 1.25;
    shipSprite = art?.has('starmap.fleet.player.d0') ? spriteAt(ctx, `starmap.fleet.player.d${shipDir}`, ship.x, ship.y, size, null, cam.s < HALF_BELOW) : null;
    if (!shipSprite) {
      const o = newOps();
      pixelArrow(o, ang, g, 2);
      const gf = new Graphics({ roundPixels: true });
      gf.position.set(ship.x, ship.y);
      fillOps(gf, o, pal.cyan, 1);
      shipSprite = gf;
    }
    shipBox.addChild(shipSprite);
  }

  function camera(c: Cam): void {
    cam = c;
    const v = viewOf(c);
    const ng = 2 / c.s;
    const key = `${ng.toFixed(6)}|${dpr}`;
    const zoomed = key !== zoomKey;
    zoomKey = key;
    g = ng;
    syncPieces(areaPieces, v, g, 4 / c.s);
    syncPieces(linePieces, v, g, 4 / c.s);
    nodeLayer.camera(sc, c, v, g, hasShip, zoomed);
    mask.fit(v);
    if (zoomed) redraw();
    else layoutLevel1(ctx, labels, sc, cam, v, hasShip);
  }
  function scene(next: Scene): void {
    sc = next;
    nodeLayer.stale();
    camera(cam);
    redraw();
    nodeLayer.camera(sc, cam, viewOf(cam), g, hasShip, true);
  }
  camera(cam0);

  return {
    root,
    scene,
    camera,
    glide(next) {
      const flipped = !!next !== hasShip;
      ship = next;
      hasShip = !!next;
      if (flipped) {
        nodeLayer.stale();
        redraw();
        nodeLayer.camera(sc, cam, viewOf(cam), g, hasShip, true);
      } else {
        drawShip();
      }
    },
    tick: (now) => nodeLayer.tick(now),
    tip(x, y) {
      const k = 1 / cam.s;
      const mx = cam.cx + (x - cam.w / 2) * k;
      const my = cam.cy + (y - cam.h / 2) * k;
      const half = (iconSize(fleetFrame, cam.s, dpr) / 2) * k;
      for (const m of marks) {
        const fx = m.f.x + m.ox * 54 * k;
        const fy = m.f.y + m.oy * 54 * k;
        if (Math.abs(mx - fx) <= half && Math.abs(my - fy) <= half) return `${m.f.faction} ${m.f.role.toLowerCase()}, ${m.f.ships} ship${m.f.ships > 1 ? 's' : ''}. ${m.f.heading}.`;
      }
      for (const n of map.nodes) {
        if (!n.known || !n.jobs?.length) continue;
        if (Math.abs(mx - (n.x - 14 * k)) <= 8 * k && Math.abs(my - (n.y + 5 * k - 6 * k)) <= 9 * k) return n.jobs.map((j) => j.label).join('\n');
      }
      return null;
    },
    destroy() {
      mask.destroy();
      labels.destroy();
      nodeLayer.destroy();
      root.destroy({ children: true });
    },
  };
}
