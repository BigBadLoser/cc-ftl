/** Starmap level 1 nodes: each node's marks (diamond, rings) as a piece drawn when in view, the pulse of your node, and the orbiting structure icons. */
import { Container, Graphics } from 'pixi.js';
import type { UiStarmap, UiStarNode } from '../../ui/starmapApi';
import { strHash } from './artIds';
import { fillOps, HALF_BELOW, iconSize, piece, spriteAt, syncPieces, type Cam, type Ctx, type Piece, type Scene, type View } from './kit';
import { newOps, pixelDiamond, pixelDiamondRing } from './pixel';

/** Structure icons orbit their node: one lap a minute, each node from its own starting angle; still with reduced motion. */
const ORBIT_SEC = 60;
const PULSE_MS = 2200;
/** The orbiting icons glide between device pixels (not snapped), so their motion is smooth; the art stays nearest-scaled. */
const SMOOTH = true;
const still = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface Orbit {
  node: UiStarNode;
  box: Container;
  kids: Container[];
  a0: number;
}

export interface NodeLayer {
  camera(sc: Scene, cam: Cam, v: View, g: number, ship: boolean, zoomed: boolean): void;
  stale(): void;
  /** 'fast': orbits are on screen, draw at the display rate; true: only the pulse. */
  tick(now: number): boolean | 'fast';
  destroy(): void;
}

export function createNodeLayer(ctx: Ctx, root: Container, map: UiStarmap): NodeLayer {
  const { pal, art, dpr } = ctx;
  const marks = root.addChild(new Container());
  const orbitBox = root.addChild(new Container());
  const pulseBox = root.addChild(new Container());
  for (const c of [marks, orbitBox, pulseBox]) c.eventMode = 'none';
  let st = { sc: null as Scene | null, ship: false, k: 1 };
  const pieces: Piece[] = map.nodes.map((n) => {
    const p = piece(marks, [n.x, n.y, n.x, n.y], (gf, g) => {
      const k = st.k;
      const o = (fn: (o: ReturnType<typeof newOps>) => void, color: number, alpha = 1) => {
        const ops = newOps();
        fn(ops);
        fillOps(gf, ops, color, alpha);
      };
      if (!n.known) {
        o((x) => pixelDiamond(x, n.x, n.y, 5 * k, g), pal.bg);
        o((x) => pixelDiamondRing(x, n.x, n.y, 5 * k, g), pal.dim, 0.85);
        return;
      }
      if (n.hostiles) {
        o((x) => pixelDiamond(x, n.x, n.y, 9 * k, g), pal.red, 0.25);
        o((x) => pixelDiamondRing(x, n.x, n.y, 9 * k, g), pal.red);
      }
      o((x) => pixelDiamond(x, n.x, n.y, (n.current ? 6 : 5) * k, g), n.current ? pal.cyan : n.visited ? pal.text : pal.dim);
      if (n.reachable && !st.ship) o((x) => pixelDiamondRing(x, n.x, n.y, 10 * k, g), pal.green);
      if (n.current && !st.ship) o((x) => pixelDiamondRing(x, n.x, n.y, 13 * k, g), pal.cyan);
    });
    return p;
  });
  const structFrame = art?.art.frames['starmap.struct.den']?.w ?? 48;
  let orbits = new Map<string, Orbit>();
  let pulse: { gfx: Graphics; x: number; y: number } | null = null;
  let live: Orbit[] = [];
  let last: { sc: Scene; cam: Cam; v: View; g: number } | null = null;

  const dropOrbits = () => {
    orbitBox.removeChildren().forEach((c) => c.destroy({ children: true }));
    orbits = new Map();
  };
  const place = (o: Orbit, now: number) => {
    const k = 1 / (last?.cam.s ?? 1);
    const r = 40 * k;
    const th = ((o.a0 + (still ? 0 : (360 * now) / 1000 / ORBIT_SEC)) * Math.PI) / 180;
    o.kids.forEach((c, i) => {
      const t = (i / o.kids.length) * Math.PI * 2 + th;
      c.position.set(o.node.x + Math.cos(t) * r, o.node.y + Math.sin(t) * r);
    });
  };

  return {
    camera(sc, cam, v, g, ship, zoomed) {
      st = { sc, ship, k: 1 / cam.s };
      last = { sc, cam, v, g };
      for (const p of pieces) p.gfx.alpha = 1;
      syncPieces(pieces, v, g, 100 / cam.s);
      if (zoomed) dropOrbits();
      const m = 100 / cam.s;
      live = [];
      if (art && cam.s > 0.7) {
        const size = iconSize(structFrame, cam.s, dpr) / cam.s;
        const half = cam.s < HALF_BELOW;
        for (const n of map.nodes) {
          if (!n.known || !n.icons.length) continue;
          const inView = n.x > v.x0 - m && n.x < v.x1 + m && n.y > v.y0 - m && n.y < v.y1 + m;
          let o = orbits.get(n.id);
          if (!o && inView) {
            const box = orbitBox.addChild(new Container());
            const kids = n.icons.map((ic) => spriteAt(ctx, ic.sprite, 0, 0, size, ic.tone, half, SMOOTH)).filter((c): c is Container => !!c);
            kids.forEach((c) => box.addChild(c));
            o = { node: n, box, kids, a0: strHash(n.id) % 360 };
            orbits.set(n.id, o);
          }
          if (o) {
            o.box.visible = inView;
            if (inView) {
              live.push(o);
              place(o, performance.now());
            }
          }
        }
      }
      // The pulse of your node.
      pulse?.gfx.destroy();
      pulse = null;
      const cur = sc.current;
      if (cur && !ship && !still) {
        const gfx = pulseBox.addChild(new Graphics({ roundPixels: true }));
        const ops = newOps();
        pixelDiamondRing(ops, 0, 0, 13 / cam.s, g);
        fillOps(gfx, ops, pal.cyan, 1);
        pulse = { gfx, x: Math.round(cur.x / g) * g, y: Math.round(cur.y / g) * g };
        gfx.position.set(pulse.x, pulse.y);
      }
    },
    stale() {
      for (const p of pieces) p.at = Number.NaN;
    },
    tick(now) {
      for (const o of live) if (!still) place(o, now);
      if (pulse) {
        const t = (now % PULSE_MS) / PULSE_MS;
        const e = 1 - (1 - t) * (1 - t);
        pulse.gfx.scale.set(1 + 1.2 * e);
        pulse.gfx.alpha = 0.7 * (1 - e);
      }
      return live.length > 0 && !still ? 'fast' : !!pulse;
    },
    destroy() {
      dropOrbits();
      pulse = null;
    },
  };
}
