/*
 * PLACEHOLDER ART. This whole file is a temporary stand-in for the shuttle sprite: a drawn grey box with a nose and an
 * engine glow. The real shuttle art will come from the Blender sprite pipeline (asset id `vehicle.shuttle`, see
 * VehicleDef.asset); when it lands, replace this view with a sprite view and delete this file.
 */
import { Container, Graphics } from 'pixi.js';
import type { World } from '../sim/ecs';
import { VehicleC, type Vehicle } from '../sim/vehicles/components';
import { Z_PX } from './heights';
import { iso, type Pt } from './iso';

/** Shuttle size in tiles: hull length (rear to shoulder), nose length beyond it, width and height. */
const BODY = 2.6;
const NOSE = 0.9;
const WIDTH = 1.4;
const HEIGHT = 0.75;

type P2 = readonly [number, number];
/** Base outline in local (along heading, across) tile coordinates, clockwise seen from above. */
const OUTLINE: readonly P2[] = [
  [-BODY / 2, -WIDTH / 2], [BODY / 2, -WIDTH / 2], [BODY / 2 + NOSE, 0], [BODY / 2, WIDTH / 2], [-BODY / 2, WIDTH / 2],
];

const HULL = 0x9aa8bb;
const HULL_DARK = 0x56647a;
const TOP = 0xc4cfde;
const ACCENT = 0xe6a23c;
const GLASS = 0x37d3ef;
const LINE = 0x151c28;

export interface ShuttleViewHost {
  /** Where the shuttles are drawn. The container must sort by zIndex if `depth` is used. */
  layer: Container;
  /** Sector position (tiles) to art px in this layer's frame. */
  project(sx: number, sy: number): Pt;
  /** Which vehicles this view draws. */
  include(v: Vehicle): boolean;
  /** Heading to draw a vehicle with (default: its own). */
  heading?(v: Vehicle): number;
  /** zIndex for a vehicle (default 0). */
  depth?(v: Vehicle): number;
}

export interface ShuttleView {
  /** Per frame: follow the sim (smoothly), create and remove drawings. Reads the sim only. */
  update(dt: number): void;
  dispose(): void;
}

interface Drawn {
  root: Container;
  body: Graphics;
  glow: Graphics;
  key: string;
  x: number;
  y: number;
  heading: number;
}

/** Paint one shuttle at the origin of `body` (and its engine glow into `glow`). `heading` is in sector space (radians). */
function paintShuttle(body: Graphics, glow: Graphics, heading: number, thrust: number): void {
  body.clear();
  glow.clear();
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  // Local (u along heading, v across, z up in tiles) -> art px around the shuttle centre.
  const at = (u: number, v: number, z: number): Pt => {
    const p = iso(u * c - v * s, u * s + v * c);
    return { x: p.x, y: p.y - z * Z_PX };
  };
  const flat = (pts: Pt[]) => pts.flatMap((p) => [p.x, p.y]);
  // Side walls facing the camera (outward normal pointing screen-down: nx + ny > 0), far to near.
  const sides = OUTLINE.map((a, i) => {
    const b = OUTLINE[(i + 1) % OUTLINE.length] as P2;
    const du = b[0] - a[0];
    const dv = b[1] - a[1];
    const len = Math.hypot(du, dv) || 1;
    const nu = dv / len; // outward normal of a clockwise outline, local
    const nv = -du / len;
    const nx = nu * c - nv * s;
    const ny = nu * s + nv * c;
    const mid = iso((a[0] + b[0]) / 2 * c - (a[1] + b[1]) / 2 * s, (a[0] + b[0]) / 2 * s + (a[1] + b[1]) / 2 * c);
    return { a, b, nx, ny, depth: mid.y };
  })
    .filter((f) => f.nx + f.ny > 0.001)
    .sort((p, q) => p.depth - q.depth);
  for (const f of sides) {
    const lit = Math.max(0, Math.min(1, 0.5 + (f.nx - f.ny) * 0.35));
    const shade = lit > 0.6 ? HULL : HULL_DARK;
    body.poly(flat([at(f.a[0], f.a[1], 0), at(f.b[0], f.b[1], 0), at(f.b[0], f.b[1], HEIGHT), at(f.a[0], f.a[1], HEIGHT)])).fill(shade).stroke({ width: 1, color: LINE });
    // Accent stripe along the side.
    body.poly(flat([at(f.a[0], f.a[1], HEIGHT * 0.35), at(f.b[0], f.b[1], HEIGHT * 0.35), at(f.b[0], f.b[1], HEIGHT * 0.5), at(f.a[0], f.a[1], HEIGHT * 0.5)])).fill(ACCENT);
  }
  // Roof, then a cockpit window near the nose and a centre spine.
  body.poly(flat(OUTLINE.map(([u, v]) => at(u, v, HEIGHT)))).fill(TOP).stroke({ width: 1, color: LINE });
  const wu = BODY / 2 - 0.15;
  body.poly(flat([at(wu - 0.1, -0.42, HEIGHT), at(wu + NOSE * 0.7, -0.12, HEIGHT), at(wu + NOSE * 0.7, 0.12, HEIGHT), at(wu - 0.1, 0.42, HEIGHT)])).fill(GLASS).stroke({ width: 1, color: LINE });
  body.poly(flat([at(-BODY / 2 + 0.2, -0.1, HEIGHT), at(wu - 0.3, -0.1, HEIGHT), at(wu - 0.3, 0.1, HEIGHT), at(-BODY / 2 + 0.2, 0.1, HEIGHT)])).fill(HULL_DARK);
  // Engine glow at the rear: two nozzles, brighter while thrusting.
  for (const v of [-0.42, 0.42]) {
    const p = at(-BODY / 2 - 0.05, v, HEIGHT * 0.45);
    const r = 5 + thrust * 5;
    glow.ellipse(p.x, p.y, r * 1.3, r * 0.8).fill({ color: 0xff8a3a, alpha: 0.35 + thrust * 0.4 });
    glow.ellipse(p.x, p.y, r * 0.6, r * 0.4).fill({ color: 0xfff1c8, alpha: 0.6 + thrust * 0.4 });
    if (thrust > 0.5) {
      const tail = at(-BODY / 2 - 0.9, v, HEIGHT * 0.45);
      glow.poly([p.x, p.y - 3, tail.x, tail.y, p.x, p.y + 3]).fill({ color: 0xffb25a, alpha: 0.5 });
    }
  }
}

/**
 * Draws shuttles (VehicleC entities) as placeholder boxes. One instance per layer: the sector layer shows flying and
 * docked shuttles, a ship's own layer shows the one parked in its bay. Renderer only; it never writes the sim.
 */
export function createShuttleView(world: World, host: ShuttleViewHost): ShuttleView {
  const drawn = new Map<number, Drawn>();

  function drop(id: number): void {
    const d = drawn.get(id);
    if (!d) return;
    d.root.destroy({ children: true });
    drawn.delete(id);
  }

  return {
    update(dt) {
      const seen = new Set<number>();
      for (const id of world.query(VehicleC)) {
        const v = world.get(id, VehicleC);
        if (!v || !host.include(v)) continue;
        seen.add(id);
        let d = drawn.get(id);
        const heading = host.heading ? host.heading(v) : v.heading;
        if (!d) {
          const root = new Container();
          const body = new Graphics();
          const glow = new Graphics();
          glow.blendMode = 'add';
          root.addChild(body, glow);
          host.layer.addChild(root);
          d = { root, body, glow, key: '', x: v.x, y: v.y, heading };
          drawn.set(id, d);
        }
        // Follow the sim position smoothly; snap on a big jump (launch, stowing).
        const k = 1 - Math.exp(-dt * 14);
        if (Math.hypot(v.x - d.x, v.y - d.y) > 3) [d.x, d.y] = [v.x, v.y];
        else [d.x, d.y] = [d.x + (v.x - d.x) * k, d.y + (v.y - d.y) * k];
        let dh = heading - d.heading;
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        d.heading = v.state === 'stowed' ? heading : d.heading + dh * (1 - Math.exp(-dt * 10));
        const thrust = v.state === 'flying' && v.dest ? 1 : v.state === 'flying' ? 0.35 : 0.1;
        const key = `${d.heading.toFixed(2)}|${thrust}`;
        if (key !== d.key) {
          d.key = key;
          paintShuttle(d.body, d.glow, d.heading, thrust);
        }
        const p = host.project(d.x, d.y);
        d.root.position.set(Math.round(p.x), Math.round(p.y));
        d.root.zIndex = host.depth ? host.depth(v) : 0;
      }
      for (const id of [...drawn.keys()]) if (!seen.has(id)) drop(id);
    },
    dispose() {
      for (const id of [...drawn.keys()]) drop(id);
    },
  };
}
