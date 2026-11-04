import { Container, Graphics } from 'pixi.js';
import { BodyC, isAirborne } from '../sim/body';
import { TICK_HZ } from '../sim/time';
import type { World } from '../sim/ecs';
import { DroneC } from '../sim/drones/components';
import type { DroneDef } from '../sim/drones/types';
import { ModuleC } from '../sim/modules/components';
import { footprintTiles } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { Z_PX } from './heights';
import { ART_SCALE as S, TILE_H, TILE_W, iso } from './iso';
import { sectorArt } from './sectorPos';
import type { Atlas } from './assets/loader';
import { applyDroneArt, createDroneArtSprites, droneArtIds, type DroneArtSprites } from './droneArt';

/**
 * PLACEHOLDER drones and drone-bay pads, drawn in code until their pipeline art exists (CLAUDE.md: placeholders while art is pending).
 * A drone (DroneC on a BodyC) is a small disc in its type's tint with four rotor rings and a type mark, hovering at its body's altitude
 * with a shadow on the deck, a status light (green, amber when low, red when flat) and, while it works, a beam onto the target. Knocked
 * out it lies dark on the deck (ion: blue crackle). The bay's two pads are rings on its footprint, glowing while a docked drone charges.
 * Everything sorts in the sector `low` layer by depth, with the ships' tiles. Reads the sim only.
 */
export interface DroneView {
  update(dt: number): void;
  dispose(): void;
}

export interface DroneHost {
  /** The shared depth layer (inside ships, sorted with their tiles). */
  layer: Container;
  /** The air layer, over every tile and roof: drones above roof height (in space, or high in the hatch). Sorts by zIndex = sector depth. */
  air?: Container;
  drones: Readonly<Record<string, DroneDef>>;
  modules: Readonly<Record<string, ModuleDef>>;
  /** Pipeline art (#324): used when the manifest has it, else the code placeholder. */
  atlas?: Pick<Atlas, 'stat'>;
}

interface Track {
  root: Container;
  shadow: Graphics;
  beam: Graphics;
  body: Graphics;
  def: string;
  art?: DroneArtSprites;
}

/** Ticks after a shot a defence drone shows its firing frames. */
const FIRE_POSE_TICKS = 5;

/** Height of the bay's plate in tiles of height, and half a tile's art size. */
const PLATE_Z = 0.3;
const HW = TILE_W / 2, HH = TILE_H / 2;

const MARK: Record<string, 'cross' | 'wrench' | 'gun'> = { firstAid: 'cross', repair: 'wrench', extinguish: 'wrench', intercept: 'gun' };
const BEAM: Record<string, number> = { firstAid: 0x8affc0, repair: 0xffc070, extinguish: 0x9ae0ff, intercept: 0xfff0a0 };

/** How one drone looks this frame (from its sim state): what paintDrone draws. */
export interface DroneLook {
  tint: number;
  /** The job kind of its first job (sets the mark on its back). */
  kind: string;
  /** Altitude in tiles of height (BodyC.alt). */
  alt: number;
  /** Knocked out (no core, ion): dark, no rotor blur. */
  down: boolean;
  stunned: boolean;
  /** Status light: 'ok', 'low' (heading home), 'flat'. */
  battery: 'ok' | 'low' | 'flat';
  /** The job kind it is working on now, or null. */
  working: string | null;
  /** Hovering (bobs): not docked and not down. */
  hover: boolean;
}

/** Placeholder size: radius of the hull in art px (at ART_SCALE). */
const R = 9 * S;

/** Draw a drone into its three graphics (shadow on the deck at (0, 0), beam, body over it), `clock` seconds and a per-drone `seed` for the bob. */
export function paintDrone(g: { shadow: Graphics; beam: Graphics; body: Graphics }, look: DroneLook, clock: number, seed: number): void {
  const lift = look.alt * Z_PX + (look.hover ? Math.sin(clock * 3 + seed) * 1.2 * S : 0);
  drawBody(g.body, look, clock * 20);
  g.body.position.set(0, -lift);
  g.shadow.clear();
  if (look.alt > 0.05) g.shadow.ellipse(0, 0, R * 1.1, R * 0.55).fill({ color: 0x000000, alpha: 0.3 });
  g.beam.clear();
  if (look.working && look.working !== 'intercept') {
    const col = BEAM[look.working] ?? 0xffffff;
    const flick = 0.5 + 0.5 * Math.sin(clock * 30 + seed);
    g.beam.moveTo(0, -lift + 3 * S).lineTo(0, -2 * S).stroke({ color: col, width: 3 * S, alpha: 0.55 + 0.35 * flick });
    g.beam.ellipse(0, 0, 11 * S, 5.5 * S).fill({ color: col, alpha: 0.25 + 0.2 * flick });
    if (look.working !== 'firstAid') {
      // Sparks (repair) or spray (extinguish) off the spot it works on.
      for (let i = 0; i < 5; i++) {
        const a = clock * 7 + i * 1.3 + seed;
        const r = ((clock * 3 + i * 0.37) % 1) * 12 * S;
        g.beam.circle(Math.cos(a) * r, -Math.abs(Math.sin(a)) * r * 0.6 - 1 * S, 1 * S).fill({ color: col, alpha: 0.9 });
      }
    }
  }
  if (look.stunned) {
    const k = Math.floor(clock * 12) % 3;
    g.beam.moveTo(-7 * S, -lift - 3 * S).lineTo(-1 * S, -lift - (7 + k) * S).lineTo(3 * S, -lift - 2 * S).lineTo(8 * S, -lift - (6 - k) * S)
      .stroke({ color: 0x80c8ff, width: 1.4 * S, alpha: 0.95 });
  }
}

/** One drone's body, centred on its hub (0, 0), in art px. */
function drawBody(g: Graphics, look: DroneLook, spin: number): void {
  g.clear();
  const dark = look.down;
  const body = dark ? 0x3a4048 : look.tint;
  // Rotor arms and rings (iso-flattened), the rings blurred by spin.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const ax = Math.cos(a) * R * 1.35, ay = Math.sin(a) * R * 0.68;
    g.moveTo(0, 0).lineTo(ax, ay).stroke({ color: 0x20262c, width: 1.8 * S });
    g.ellipse(ax, ay, 5.5 * S, 2.7 * S).fill({ color: 0xd8e4ee, alpha: dark ? 0.12 : 0.25 + 0.1 * Math.sin(spin + i) });
    g.ellipse(ax, ay, 5.5 * S, 2.7 * S).stroke({ color: dark ? 0x505860 : 0xc8d4de, width: 0.8 * S, alpha: 0.9 });
  }
  // Hull: a squat disc with a darker rim.
  g.ellipse(0, 2 * S, R, R * 0.55).fill(0x1a1f24);
  g.ellipse(0, 0, R, R * 0.55).fill(body);
  g.ellipse(0, 0, R, R * 0.55).stroke({ color: 0x14181c, width: 1 * S });
  g.ellipse(-2 * S, -1.5 * S, R * 0.45, R * 0.22).fill({ color: 0xffffff, alpha: dark ? 0.05 : 0.25 });
  // Type mark on top.
  const c = dark ? 0x6a7078 : 0xffffff;
  if (MARK[look.kind] === 'cross') {
    g.rect(-1.2 * S, -3.2 * S, 2.4 * S, 6.4 * S).fill(c);
    g.rect(-3.6 * S, -1.2 * S, 7.2 * S, 2.4 * S).fill(c);
  } else {
    g.moveTo(-3.6 * S, 2.4 * S).lineTo(2.4 * S, -1.8 * S).stroke({ color: c, width: 2 * S });
    g.circle(3.1 * S, -2.3 * S, 1.7 * S).stroke({ color: c, width: 1.4 * S });
  }
  // Status light on the rim.
  const light = dark ? 0x303030 : look.battery === 'flat' ? 0xff4040 : look.battery === 'low' ? 0xffb040 : 0x60ff90;
  g.circle(R * 0.8, 1 * S, 1.6 * S).fill(light);
}

export function createDroneView(world: World, host: DroneHost): DroneView {
  const tracks = new Map<number, Track>();
  const pads = new Map<number, Graphics>();
  let clock = 0;
  const drop = (id: number): void => {
    const t = tracks.get(id);
    if (t && !t.root.destroyed) t.root.destroy({ children: true });
    tracks.delete(id);
  };
  return {
    update(dt) {
      clock += dt;
      // Bays: a low plate per footprint tile with a landing ring per slot, lit while its drone charges.
      const charging = new Set<string>();
      for (const id of world.query(DroneC)) {
        const d = world.get(id, DroneC);
        if (d && d.state === 'docked' && d.charge < 100 && !d.inert && d.stunUntil === 0) charging.add(`${d.bay}:${d.slot}`);
      }
      const bays = new Set<number>();
      for (const id of world.query(ModuleC)) {
        const m = world.get(id, ModuleC);
        const def = m && host.modules[m.def];
        if (!m || !def?.droneBay || host.atlas?.stat(`${def.asset}.r${m.rot}`)) continue; // with its art the module view draws the bay
        bays.add(id);
        let g = pads.get(id);
        if (!g) {
          g = new Graphics();
          host.layer.addChild(g);
          pads.set(id, g);
        }
        g.clear();
        const tiles = footprintTiles(def, m.x, m.y, m.rot);
        const h = PLATE_Z * Z_PX;
        const wrecked = m.hp <= 0;
        for (const t of tiles) {
          const p = iso(t.x, t.y);
          const top = [p.x, p.y - HH - h, p.x + HW, p.y - h, p.x, p.y + HH - h, p.x - HW, p.y - h];
          g.poly([p.x - HW, p.y - h, p.x, p.y + HH - h, p.x, p.y + HH, p.x - HW, p.y]).fill(0x262e36);
          g.poly([p.x + HW, p.y - h, p.x, p.y + HH - h, p.x, p.y + HH, p.x + HW, p.y]).fill(0x1c2228);
          g.poly(top).fill(wrecked ? 0x2a2a2a : 0x34404c);
          g.poly(top).stroke({ color: 0x55c8ff, width: 1 * S, alpha: 0.35 });
        }
        tiles.slice(0, def.droneBay.slots).forEach((t, slot) => {
          const p = iso(t.x, t.y);
          const lit = charging.has(`${id}:${slot}`) && m.powered;
          g.ellipse(p.x, p.y - h, 24 * S, 12 * S).fill({ color: 0x0c1218, alpha: 0.9 });
          g.ellipse(p.x, p.y - h, 24 * S, 12 * S).stroke({ color: lit ? 0x60ffb0 : 0x4a6a80, width: 1.5 * S, alpha: lit ? 0.6 + 0.4 * Math.sin(clock * 4) : 0.9 });
          g.ellipse(p.x, p.y - h, 15 * S, 7.5 * S).stroke({ color: 0xffc040, width: 1 * S, alpha: 0.7 });
        });
        const front = tiles.reduce((a, t) => (t.x + t.y > a.x + a.y ? t : a));
        g.zIndex = front.x + front.y + 0.3;
      }
      for (const [id, g] of [...pads]) {
        if (bays.has(id)) continue;
        g.destroy();
        pads.delete(id);
      }

      // The front depth of the module under each tile a drone is over (so a hovering drone draws over the whole module).
      const under = new Map<string, number>();
      const wanted = new Set<string>();
      for (const id of world.query(DroneC, BodyC)) {
        const b = world.get(id, BodyC);
        if (b) wanted.add(`${Math.floor(b.x)},${Math.floor(b.y)}`);
      }
      for (const id of world.query(ModuleC)) {
        const m = world.get(id, ModuleC);
        const def = m && host.modules[m.def];
        if (!m || !def) continue;
        const tiles = footprintTiles(def, m.x, m.y, m.rot);
        if (!tiles.some((t) => wanted.has(`${t.x},${t.y}`))) continue;
        const front = tiles.reduce((a, t) => Math.max(a, t.x + t.y), -Infinity) + (def.droneBay ? 0.3 : 0);
        for (const t of tiles) under.set(`${t.x},${t.y}`, Math.max(under.get(`${t.x},${t.y}`) ?? -Infinity, front));
      }
      const seen = new Set<number>();
      for (const id of world.query(DroneC, BodyC)) {
        const d = world.get(id, DroneC);
        const b = world.get(id, BodyC);
        const def = d && host.drones[d.def];
        if (!d || !b || !def) continue;
        seen.add(id);
        let t = tracks.get(id);
        if (!t || t.def !== d.def) {
          drop(id);
          const root = new Container();
          const shadow = new Graphics(), beam = new Graphics(), body = new Graphics();
          root.addChild(shadow, beam, body);
          host.layer.addChild(root);
          t = { root, shadow, beam, body, def: d.def };
          tracks.set(id, t);
        }
        const stunned = d.stunUntil > 0; // the drone system clears it once the stun is over
        const down = d.inert || stunned;
        // In space the work pose is the gun firing: the moment after a shot (a fresh reload).
        const job = d.target && def.jobs.find((j) => j.kind === d.target?.kind);
        const firing = !!job && job.kind === 'intercept' && d.cool > Math.round(job.fireSec * TICK_HZ) - FIRE_POSE_TICKS;
        const working = d.state === 'out' && d.target && !down && (d.space ? firing : d.steps.length === 0) ? d.target.kind : null;
        const look: DroneLook = {
          tint: def.tint, kind: def.jobs[0]?.kind ?? 'repair', alt: b.alt, down, stunned,
          battery: d.charge <= 0 ? 'flat' : d.charge < def.charge.lowBelow ? 'low' : 'ok', working, hover: !down && d.state !== 'docked',
        };
        // The pipeline art when the manifest has it (the stun crackle stays drawn in code), else the placeholder.
        const ids = droneArtIds(d.def, { down, working: !!working, docked: d.state === 'docked' }, b.heading, clock);
        if (host.atlas) t.art ??= createDroneArtSprites(t.root);
        if (host.atlas && t.art && applyDroneArt(host.atlas, t.art, ids, b.alt * Z_PX)) {
          paintDrone(t, { ...look, working: null }, clock, id);
          t.body.clear();
          t.shadow.clear();
        } else paintDrone(t, look, clock, id);
        // Out in space there is no deck under it to cast a shadow on.
        if (d.space) {
          t.shadow.clear();
          if (t.art) t.art.shadow.visible = false;
        }
        const p = sectorArt(b.x, b.y);
        t.root.position.set(Math.round(p.x), Math.round(p.y));
        // Above the roofs (in space, or high in its bay's hatch) it flies in the air layer, sorted by sector depth like a shuttle.
        const parent = host.air && isAirborne(b) ? host.air : host.layer;
        if (t.root.parent !== parent) parent.addChild(t.root);
        // Sector depth (x + y in tiles): over the module it hovers above (its front tile's depth), else over its own tile.
        t.root.zIndex = parent === host.air ? b.x + b.y : Math.max(b.x - 0.5 + b.y - 0.5, under.get(`${Math.floor(b.x)},${Math.floor(b.y)}`) ?? -Infinity) + (b.alt > 0.05 ? 0.9 : 0.4);
      }
      for (const id of [...tracks.keys()]) if (!seen.has(id)) drop(id);
    },
    dispose() {
      for (const id of [...tracks.keys()]) drop(id);
      for (const g of pads.values()) if (!g.destroyed) g.destroy();
      pads.clear();
    },
  };
}
