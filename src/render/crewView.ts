import { shipIdAtTile } from './regionRules';
import { HALO_PAD, haloTex } from './haloTex';
import { Container, Sprite, Texture } from 'pixi.js';
import type { World } from '../sim/ecs';
import { CarriedC, CrewC, DeadC, DownedC, DraftedC, HealthC, PositionC } from '../sim/crew/components';
import { EvaFloatC } from '../sim/eva/components';
import { FighterC } from '../sim/fight/components';
import { ShipC } from '../sim/combat/components';
import { facingOf } from '../sim/crew/helpers';
import { SuitC } from '../sim/eva/components';
import { CarryingC } from '../sim/items/components';
import { BLEED_OUT_SECONDS } from '../sim/tuning';
import type { ModuleDef } from '../sim/registry';
import type { Module } from '../sim/modules/components';
import { accessTile, footprintTiles, openTilesOf } from '../sim/modules/footprint';
import { moduleKey } from './moduleView';
import { SEAT_DZ } from './moduleArt';
import type { Atlas, LayerSprite } from './assets/loader';
import type { ClipDef } from './assets/manifest';
import { createCrewFilter, crewPalette, setFilterTint, setFilterZoom } from './assets/palette';
import type { Filter } from 'pixi.js';
import { diamondTextures } from './diamonds';
import { heldAssets } from './itemView';
import { lightTint, mulColor, pulsePhase } from './lightTint';
import { depthKey, iso } from './iso';
import type { Layers } from './layers';
import { clipFor, crewLoadout, resolveClip } from './loadout';

export interface CrewViewHost {
  /** True when the ship has no running power source (emergency lighting). */
  emergency?(): boolean;
  /** Light level at a sector tile of the shown grid (0 outside it). */
  light?(x: number, y: number): number;
  /**
   * The grid being shown and the sector top-left (ox, oy) of its region, or null when nothing is shown. Positions are
   * sector tiles; sprites are placed region-local (minus ox, oy) in the region's containers.
   */
  target(): { shipId: number; ox: number; oy: number } | null;
  /** Crew on this tile are not drawn (the interior of a roofed region). */
  hidden?(x: number, y: number): boolean;
  /** The module covering tile (x, y) of the shown grid, if any (to sort crew on a console's chair tile against its sprite). */
  moduleAt?(x: number, y: number): { m: Module; def: ModuleDef } | null;
  /** Seconds of air in a full suit tank (scales the air bar). */
  suitAirSec?(): number;
}

export interface CrewView {
  update(): void;
  setSelectedCrew(id: number | null): void;
  /** Crew entity under an art-px point (the one whose feet are lowest on screen) and its feet's art y, or null. */
  pick(ax: number, ay: number): { id: number; y: number } | null;
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
  /** One-shot clip (creature `attack` / `hurt`) playing until `until` seconds of slot time, with what started it. */
  shot: { clip: string; until: number } | null;
  lastHp: number;
  lastCooldown: number;
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

  /** True if a grid has a ship (an EVA drift is drawn only while it does). */
  function hasShip(shipId: number): boolean {
    return world.has(shipId, ShipC);
  }

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
        if (L.halos && !layer.def.slot.startsWith('arm')) {
          halo = new Sprite(); // cyber arm: no halo
          halo.blendMode = 'add';
          root.addChild(halo); // in the crew's own depth slot, drawn just over its glow
        }
        return { layer, sprite, halo };
      });
    L.sorted.addChild(root);
    return { root, parts, glows, ring, shadow, filter, carry, carryBack, barBg, barFill, x: 0, y: 0, placed: false, clip: '', t: 0, height: Math.max(20, first.def.anchor.y - 6), lying: false, suited, airBg, airFill, shot: null, lastHp: -1, lastCooldown: 0 };
  }

  function applyLight(s: Slot, tx: number, ty: number, dead: boolean): void {
    const lv = host.light ? host.light(Math.round(tx), Math.round(ty)) : 255;
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
        if (!pos || !crew || shipIdAtTile(world, pos.x, pos.y) !== target.shipId || host.hidden?.(pos.x, pos.y)) continue;
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
        // Drifting between a hovering shuttle and this hull: along the line to the shuttle's hatch (EvaFloat, sector tiles,
        // whose tile centres are at +0.5), facing the way it goes.
        const drift = world.get(id, EvaFloatC);
        let driftFacing = -1;
        if (drift && hasShip(target.shipId)) {
          const k = 1 - drift.ticks / Math.max(1, drift.total);
          const [hx, hy] = [drift.sx - 0.5, drift.sy - 0.5];
          const [ax, ay, bx, by] = drift.mode === 'out' ? [hx, hy, pos.x, pos.y] : [pos.x, pos.y, hx, hy];
          tx = ax + (bx - ax) * k;
          ty = ay + (by - ay) * k;
          driftFacing = facingOf(bx - ax, by - ay);
        }
        // A suited crew member outside the hull (on a Space tile) drifts on the pack's thrusters: the eva_float clip.
        const flight = !!drift; // eva_float only while drifting between the shuttle and the hull
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
        const facing = driftFacing >= 0 ? driftFacing : ((pos.facing % 8) + 8) % 8;
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
        // Creature sheets (aliens) carry `attack`, `hurt` and `dead`: an attack (the fight cooldown restarting) or a hit
        // (hp dropping) plays its clip once; a dead one lies as its `dead` corpse.
        const has = (c: string) => s.parts.some((q) => q.layer.def.clips[c]);
        const hpNow = world.get(id, HealthC)?.hp ?? 0;
        const cd = world.get(id, FighterC)?.cooldown ?? 0;
        if (!hurtLying && cd > s.lastCooldown && has('attack')) s.shot = { clip: 'attack', until: s.t + clipSec(s, 'attack') };
        else if (!hurtLying && s.lastHp >= 0 && hpNow < s.lastHp - 0.01 && has('hurt') && s.shot?.clip !== 'attack') s.shot = { clip: 'hurt', until: s.t + clipSec(s, 'hurt') };
        s.lastHp = hpNow;
        s.lastCooldown = cd;
        if (s.shot && (hurtLying || s.t >= s.shot.until)) s.shot = null;
        const clipName = hurtLying ? (dead && has('dead') ? 'dead' : has('wreck') ? 'wreck' : 'sleep') : sitting ? (crew.activity === 'working' ? 'sit_work' : 'sit_idle') : s.shot?.clip ?? clipFor(crew.activity, speed > 0.3, flight);
        const docked = crew.activity === 'charging' && !!at?.def.robotBay && !hurtLying;
        const dir = (sitting || docked) && at ? (SEAT_DIR[at.m.rot % 4] as number) : facing;
        s.shadow.visible = !sitting;
        if (clipName !== s.clip) {
          if (s.shot && clipName === s.shot.clip) s.shot.until -= s.t;
          s.clip = clipName;
          s.t = 0;
        }
        // Downed, dead and carried crew hold the first frame of the sleep clip (no dedicated lying clip yet).
        if (!hurtLying) s.t += dt;
        s.lying = clipName === 'sleep';
        // A layer without a sheet for the clip is drawn with its fallback or hidden (see resolveClip).
        for (const { layer, sprite } of s.parts) {
          const c = resolveClip(layer.def, clipName);
          sprite.visible = !!c;
          if (c) sprite.texture = layer.frame(c, dir, colOf(c, s.t));
        }
        for (const g of s.glows) {
          const c = resolveClip(g.layer.def, clipName);
          const tex = c ? g.layer.glowFrame(c, dir, colOf(c, s.t)) : null;
          g.sprite.texture = tex ?? Texture.EMPTY;
          g.sprite.visible = !!tex;
          if (g.halo) {
            g.halo.visible = !!tex;
            if (tex) {
              g.halo.texture = haloTex(tex);
              g.halo.position.set(-g.layer.def.anchor.x - HALO_PAD, -g.layer.def.anchor.y - HALO_PAD);
            }
          }
        }
        // Region-local art position and depth (the region's containers sit at its sector offset).
        const lx = s.x - target.ox, ly = s.y - target.oy;
        const p = iso(lx, ly);
        // A carried body hangs at the carrier's side, drawn just over them.
        s.root.position.set(Math.round(p.x) + (carried ? 9 : 0), Math.round(p.y) + (carried ? -13 : 0));
        let z = depthKey(lx, ly) + (carried ? 0.02 : 0);
        if (at && onOpen) {
          const f = footprintTiles(at.def, at.m.x, at.m.y, at.m.rot).reduce((a, t) => (t.x + t.y > a.x + a.y ? t : a));
          z = Math.max(z, moduleKey(at.def, f.x - target.ox, f.y - target.oy) + SEAT_DZ);
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
      return best === null ? null : { id: best, y: bestY };
    },
    count: () => slots.size,
    dispose() {
      for (const s of slots.values()) drop(s);
      slots.clear();
    },
  };
}

/** Seconds one play of a clip takes on the slot's first layer that has it. */
function clipSec(s: Slot, clip: string): number {
  const c = s.parts.find((q) => q.layer.def.clips[clip])?.layer.def.clips[clip];
  return c ? c.frames / Math.max(1, c.fps) : 0;
}

/** Column in the clip's sheet at time t. */
function colOf(c: ClipDef, t: number): number {
  const f = Math.floor(t * c.fps);
  return c.start + (c.loop ? f % c.frames : Math.min(c.frames - 1, f));
}
