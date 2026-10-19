import { Container, Sprite, Texture } from 'pixi.js';
import type { World } from '../sim/ecs';
import { CarriedC, CrewC, DeadC, DownedC, DraftedC, HealthC, PositionC } from '../sim/crew/components';
import { facingOf } from '../sim/crew/helpers';
import { CrossingC, PortalC, SuitC } from '../sim/portals/components';
import { CarryingC } from '../sim/items/components';
import { BLEED_OUT_SECONDS } from '../sim/tuning';
import type { ModuleDef } from '../sim/registry';
import type { Module } from '../sim/modules/components';
import { accessTile, footprintTiles, openTilesOf } from '../sim/modules/footprint';
import { moduleKey } from './moduleView';
import { SEAT_DZ } from './moduleArt';
import type { Atlas, LayerSprite } from './assets/loader';
import { createCrewFilter, crewPalette, setFilterTint, setFilterZoom } from './assets/palette';
import type { Filter } from 'pixi.js';
import { diamondTextures } from './diamonds';
import { heldAssets } from './itemView';
import { lightTint, mulColor, pulsePhase } from './lightTint';
import { depthKey, iso } from './iso';
import type { Layers } from './layers';
import { clipFor, crewLoadout } from './loadout';

export interface CrewViewHost {
  /** True when the ship has no running power source (emergency lighting). */
  emergency?(): boolean;
  /** Light field of the shown grid, with its width, or null. */
  light?(): { data: ArrayLike<number>; width: number } | null;
  /** Id of the grid being shown, or null when nothing is shown. */
  target(): { gridId: number } | null;
  /** The module covering tile (x, y) of the shown grid, if any (to sort crew on a console's chair tile against its sprite). */
  moduleAt?(x: number, y: number): { m: Module; def: ModuleDef } | null;
  /** Sector position (tiles) of any grid's top-left tile, to place a crew member crossing open space between two ships. */
  shipPos?(gridId: number): { x: number; y: number } | null;
  /** Seconds of air in a full suit tank (scales the air bar). */
  suitAirSec?(): number;
}

export interface CrewView {
  update(): void;
  setSelectedCrew(id: number | null): void;
  /** Crew entity under an art-px point, or null. */
  pick(ax: number, ay: number): number | null;
  count(): number;
  dispose(): void;
}

interface Slot {
  root: Container;
  parts: { layer: LayerSprite; sprite: Sprite }[];
  glows: { layer: LayerSprite; sprite: Sprite; halo: Sprite | null }[];
  ring: Sprite;
  shadow: Sprite;
  filter: Filter;
  /** The item held in the hands while hauling: one sprite drawn over the body, one under it (when facing away). */
  carry: Sprite;
  carryBack: Sprite;
  barBg: Sprite;
  barFill: Sprite;
  x: number;
  y: number;
  placed: boolean;
  clip: string;
  t: number;
  /** Art-px height used for picking, and whether the figure is lying down. */
  height: number;
  lying: boolean;
  /** Which loadout the sprites were made for (a crew member putting a suit on or off gets new layers). */
  suited: boolean;
  airBg: Sprite;
  airFill: Sprite;
}

const RED = 0xff3b3b;
const CYAN = 0x22d3ee;
const SMOOTH = 14;
/** Screen offset (art px, from the feet) of the hands for each facing 0..7 (SE, S, SW, W, NW, N, NE, E), and their height. */
const HAND: readonly (readonly [number, number])[] = [[7, 3], [0, 5], [-7, 3], [-8, 0], [-7, -3], [0, -4], [7, -3], [8, 0]];
const HAND_Y = -19;
/** Seated operator direction per console rotation (faces the desk: r0 -y, r1 +x, r2 +y, r3 -x; consoles.py SEAT_DIR). */
const SEAT_DIR = [6, 0, 2, 4];
/** A robot docked in a bay cradle faces away from the tower (robot_bay.py: r0 6, r1 0, r2 2, r3 4): same table. */

export function createCrewView(world: World, atlas: Atlas, L: Layers, host: CrewViewHost): CrewView {
  const slots = new Map<number, Slot>();
  const tex = diamondTextures();
  let selected: number | null = null;
  let last = performance.now();

  function make(id: number): Slot | null {
    const crew = world.get(id, CrewC);
    if (!crew) return null;
    const suited = world.has(id, SuitC);
    const layers = crewLoadout(atlas, crew, suited);
    const first = layers[0];
    if (!first) return null;
    const root = new Container();
    const shadow = new Sprite(tex.shadow);
    shadow.anchor.set(0.5);
    const ring = new Sprite(tex.ring);
    ring.anchor.set(0.5);
    ring.visible = false;
    const body = new Container();
    const filter = createCrewFilter(atlas.manifest.keyColors, crewPalette(crew.appearanceSeed));
    body.filters = [filter];
    const parts = layers.map((layer) => {
      const sprite = new Sprite();
      sprite.position.set(-layer.def.anchor.x, -layer.def.anchor.y);
      body.addChild(sprite);
      return { layer, sprite };
    });
    const carry = new Sprite();
    const carryBack = new Sprite();
    carry.visible = carryBack.visible = false;
    const barBg = new Sprite(Texture.WHITE);
    barBg.tint = 0x05070a;
    barBg.alpha = 0.8;
    barBg.visible = false;
    const barFill = new Sprite(Texture.WHITE);
    barFill.visible = false;
    const airBg = new Sprite(Texture.WHITE);
    airBg.tint = 0x05070a;
    airBg.alpha = 0.8;
    airBg.visible = false;
    const airFill = new Sprite(Texture.WHITE);
    airFill.visible = false;
    root.addChild(shadow, ring, carryBack, body, carry, barBg, barFill, airBg, airFill);
    const glows = layers
      .filter((l) => l.def.glow)
      .map((layer) => {
        const sprite = new Sprite();
        sprite.blendMode = 'add';
        sprite.position.set(-layer.def.anchor.x, -layer.def.anchor.y);
        root.addChild(sprite);
        let halo: Sprite | null = null;
        if (L.halos && !layer.def.slot.startsWith('arm')) L.halo.addChild((halo = new Sprite())); // cyber arm: no halo
        return { layer, sprite, halo };
      });
    L.sorted.addChild(root);
    return { root, parts, glows, ring, shadow, filter, carry, carryBack, barBg, barFill, x: 0, y: 0, placed: false, clip: '', t: 0, height: Math.max(20, first.def.anchor.y - 6), lying: false, suited, airBg, airFill };
  }

  /**
   * Where a crew member crossing open space is, in this ship's tile frame: along the line from their airlock's outer door
   * to the far ship's, by how much of the crossing is done (the sim keeps their Position on the source end until it ends).
   */
  function floatOf(id: number): { x: number; y: number; facing: number } | null {
    const c = world.get(id, CrossingC);
    const portal = c && world.get(c.portal, PortalC);
    if (!c || !portal || portal.kind !== 'eva') return null;
    const [from, to] = c.from === 'a' ? [portal.a, portal.b] : [portal.b, portal.a];
    const a = host.shipPos?.(from.gridId);
    const b = host.shipPos?.(to.gridId);
    if (!a || !b) return null;
    const k = 1 - c.ticks / Math.max(1, portal.ticks);
    const ex = to.x + (b.x - a.x);
    const ey = to.y + (b.y - a.y);
    return { x: from.x + (ex - from.x) * k, y: from.y + (ey - from.y) * k, facing: facingOf(ex - from.x, ey - from.y) };
  }

  function applyLight(s: Slot, tx: number, ty: number, dead: boolean): void {
    const l = host.light?.();
    let lv = 255;
    if (l) {
      const i = Math.round(ty) * l.width + Math.round(tx);
      lv = (l.data[i] as number | undefined) ?? 0;
    }
    const emergency = host.emergency?.() ?? false;
    let tint = lightTint(Math.max(lv, 60), false, emergency ? pulsePhase(performance.now()) : -1);
    if (dead) tint = mulColor(tint, 0x7c7c7c);
    setFilterTint(s.filter, tint);
    setFilterZoom(s.filter, L.scale);
  }

  /** Put the carried item's sprite at the hands: ahead of the body, over it unless the carrier faces away. */
  function showHeld(s: Slot, item: string | undefined, dir: number, ok: boolean, bob: number): void {
    const held = ok && item ? atlas.firstOf(heldAssets(item)) : undefined;
    s.carry.visible = s.carryBack.visible = false;
    if (!held) return;
    const [ox, oy] = HAND[dir] ?? [0, 0];
    const behind = dir >= 4 && dir <= 6;
    const spr = behind ? s.carryBack : s.carry;
    spr.texture = held.tex;
    spr.position.set(ox - held.ax, HAND_Y + oy - bob - held.ay);
    spr.visible = true;
  }

  function drop(s: Slot): void {
    for (const g of s.glows) g.halo?.destroy();
    s.root.destroy({ children: true });
  }

  function update(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const target = host.target();
    const seen = new Set<number>();
    if (target)
      for (const id of world.query(CrewC, PositionC)) {
        const pos = world.get(id, PositionC);
        const crew = world.get(id, CrewC);
        if (!pos || !crew || pos.gridId !== target.gridId) continue;
        seen.add(id);
        let s = slots.get(id);
        if (s && s.suited !== world.has(id, SuitC)) {
          drop(s); // suit on or off: new layers (the sprite is rebuilt in place on the next line)
          slots.delete(id);
          s = undefined;
        }
        if (!s) {
          const made = make(id);
          if (!made) continue;
          slots.set(id, (s = made));
        }
        let tx = pos.x + (pos.toX - pos.x) * pos.progress;
        let ty = pos.y + (pos.toY - pos.y) * pos.progress;
        const flight = floatOf(id);
        if (flight) {
          tx = flight.x;
          ty = flight.y;
        }
        const dist = Math.hypot(tx - s.x, ty - s.y);
        const k = 1 - Math.exp(-dt * SMOOTH);
        if (!s.placed || dist > 3) {
          s.x = tx;
          s.y = ty;
          s.placed = true;
        } else {
          s.x += (tx - s.x) * k;
          s.y += (ty - s.y) * k;
        }
        const speed = dt > 0 ? (dist * k) / dt : 0;
        const facing = flight ? flight.facing : ((pos.facing % 8) + 8) % 8;
        const dead = world.has(id, DeadC);
        const downed = world.get(id, DownedC);
        const carried = world.get(id, CarriedC);
        const hurtLying = dead || !!downed || !!carried;
        // Crew on a walkable tile inside a module's footprint (a console's chair) draw in front of its sprite; on the
        // chair itself they sit (sit_work while operating), facing the desk, without a floor shadow.
        const mx = Math.round(s.x);
        const my = Math.round(s.y);
        const at = host.moduleAt?.(mx, my) ?? null;
        const onOpen = !!at && openTilesOf(at.def, at.m.x, at.m.y, at.m.rot).some((t) => t.x === mx && t.y === my);
        const chair = at && at.def.console ? accessTile(at.def, at.m.x, at.m.y, at.m.rot) : null;
        const sitting = !!chair && chair.x === mx && chair.y === my && !hurtLying && speed <= 0.3 && s.parts.some((q) => q.layer.def.clips.sit_idle);
        const clipName = hurtLying ? (s.parts.some((q) => q.layer.def.clips.wreck) ? 'wreck' : 'sleep') : sitting ? (crew.activity === 'working' ? 'sit_work' : 'sit_idle') : clipFor(crew.activity, speed > 0.3, !!flight);
        const docked = crew.activity === 'charging' && !!at?.def.robotBay && !hurtLying;
        const dir = (sitting || docked) && at ? (SEAT_DIR[at.m.rot % 4] as number) : facing;
        s.shadow.visible = !sitting;
        if (clipName !== s.clip) {
          s.clip = clipName;
          s.t = 0;
        }
        // Downed, dead and carried crew hold the first frame of the sleep clip (no dedicated lying clip yet).
        if (!hurtLying) s.t += dt;
        s.lying = clipName === 'sleep';
        for (const { layer, sprite } of s.parts) {
          sprite.texture = layer.frame(dir, colOf(layer, clipName, s.t));
          sprite.visible = !(sitting && layer.def.slot === 'gear.back' && s.suited); // the pack would clip through the chair
        }
        for (const g of s.glows) {
          const col = colOf(g.layer, clipName, s.t);
          g.sprite.texture = g.layer.glowFrame(dir, col) ?? g.sprite.texture;
          if (g.halo) {
            g.halo.texture = g.sprite.texture;
            const p = iso(s.x, s.y);
            g.halo.position.set(Math.round(p.x) - g.layer.def.anchor.x, Math.round(p.y) - g.layer.def.anchor.y);
          }
        }
        const p = iso(s.x, s.y);
        // A carried body hangs at the carrier's side, drawn just over them.
        s.root.position.set(Math.round(p.x) + (carried ? 9 : 0), Math.round(p.y) + (carried ? -13 : 0));
        let z = depthKey(s.x, s.y) + (carried ? 0.02 : 0);
        if (at && onOpen) {
          const f = footprintTiles(at.def, at.m.x, at.m.y, at.m.rot).reduce((a, t) => (t.x + t.y > a.x + a.y ? t : a));
          z = Math.max(z, moduleKey(at.def, f.x, f.y) + SEAT_DZ);
        }
        s.root.zIndex = z;
        applyLight(s, pos.x, pos.y, dead);
        const carrying = world.get(id, CarryingC);
        showHeld(s, carrying?.item, dir, !hurtLying, s.clip === 'walk' ? Math.round(Math.abs(Math.sin(s.t * 9))) : 0);
        const hp = world.get(id, HealthC);
        const showBar = !dead && (!!downed || (!!hp && hp.hp < hp.max));
        s.barBg.visible = s.barFill.visible = showBar;
        if (showBar) {
          const frac = downed ? Math.max(0, downed.bleed / BLEED_OUT_SECONDS) : hp ? hp.hp / hp.max : 1;
          const w = 22;
          const by = s.lying ? -34 : -s.height - 10;
          s.barBg.position.set(-w / 2 - 1, by - 1);
          s.barBg.width = w + 2;
          s.barBg.height = 5;
          s.barFill.position.set(-w / 2, by);
          s.barFill.width = Math.max(1, Math.round(w * frac));
          s.barFill.height = 3;
          s.barFill.tint = downed ? (downed.stabilized ? 0x4cc3ff : 0xff2d2d) : frac > 0.5 ? 0x4cd964 : frac > 0.25 ? 0xf0c030 : 0xff5a2d;
        }
        // The suit's tank: a small bar over the head once it is in use (cyan, amber under half, flashing red under a quarter).
        const suit = world.get(id, SuitC);
        const airMax = host.suitAirSec?.() ?? 240;
        const air = suit ? (suit.air ?? airMax) : 0;
        const showAir = !!suit && !dead && (air < airMax - 0.01 || !!flight);
        s.airBg.visible = s.airFill.visible = showAir;
        if (showAir) {
          const frac = Math.max(0, Math.min(1, air / airMax));
          const w = 22;
          const ay = (s.lying ? -34 : -s.height - 10) - (showBar ? 6 : 0);
          s.airBg.position.set(-w / 2 - 1, ay - 1);
          s.airBg.width = w + 2;
          s.airBg.height = 4;
          s.airFill.position.set(-w / 2, ay);
          s.airFill.width = Math.max(frac > 0 ? 1 : 0, Math.round(w * frac));
          s.airFill.height = 2;
          const blink = frac < 0.25 && Math.floor(now / 250) % 2 === 0;
          s.airFill.tint = blink ? 0xffffff : frac > 0.5 ? 0x22d3ee : frac > 0.25 ? 0xf0c030 : 0xff3b3b;
        }
        const drafted = world.has(id, DraftedC) || crew.activity === 'drafted';
        s.ring.visible = drafted || id === selected;
        s.ring.tint = id === selected ? CYAN : RED;
      }
    for (const [id, s] of slots) {
      if (seen.has(id)) continue;
      drop(s);
      slots.delete(id);
    }
  }

  return {
    update,
    setSelectedCrew(id) {
      selected = id;
    },
    pick(ax, ay) {
      let best: number | null = null;
      let bestY = -Infinity;
      for (const [id, s] of slots) {
        const px = s.root.x;
        const py = s.root.y;
        const hw = s.lying ? 24 : 11;
        const h = s.lying ? 22 : s.height;
        if (Math.abs(ax - px) <= hw && ay >= py - h && ay <= py + 4 && py > bestY) {
          bestY = py;
          best = id;
        }
      }
      return best;
    },
    count: () => slots.size,
    dispose() {
      for (const s of slots.values()) drop(s);
      slots.clear();
    },
  };
}

/** Column in the layer's sheet for a clip at time t (falls back to idle if the layer lacks the clip). */
function colOf(layer: LayerSprite, clip: string, t: number): number {
  const c = layer.def.clips[clip] ?? layer.def.clips.idle;
  if (!c) return 0;
  const f = Math.floor(t * c.fps);
  return c.start + (c.loop ? f % c.frames : Math.min(c.frames - 1, f));
}
