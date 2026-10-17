import { Container, Sprite, Texture } from 'pixi.js';
import type { World } from '../sim/ecs';
import { CarriedC, CrewC, DeadC, DownedC, DraftedC, HealthC, PositionC } from '../sim/crew/components';
import { CarryingC } from '../sim/items/components';
import { BLEED_OUT_SECONDS } from '../sim/tuning';
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
}

const RED = 0xff3b3b;
const CYAN = 0x22d3ee;
const SMOOTH = 14;
/** Screen offset (art px, from the feet) of the hands for each facing 0..7 (SE, S, SW, W, NW, N, NE, E), and their height. */
const HAND: readonly (readonly [number, number])[] = [[7, 3], [0, 5], [-7, 3], [-8, 0], [-7, -3], [0, -4], [7, -3], [8, 0]];
const HAND_Y = -19;

export function createCrewView(world: World, atlas: Atlas, L: Layers, host: CrewViewHost): CrewView {
  const slots = new Map<number, Slot>();
  const tex = diamondTextures();
  let selected: number | null = null;
  let last = performance.now();

  function make(id: number): Slot | null {
    const crew = world.get(id, CrewC);
    if (!crew) return null;
    const layers = crewLoadout(atlas, crew);
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
    root.addChild(shadow, ring, carryBack, body, carry, barBg, barFill);
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
    return { root, parts, glows, ring, filter, carry, carryBack, barBg, barFill, x: 0, y: 0, placed: false, clip: '', t: 0, height: Math.max(20, first.def.anchor.y - 6), lying: false };
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
        if (!s) {
          const made = make(id);
          if (!made) continue;
          slots.set(id, (s = made));
        }
        const tx = pos.x + (pos.toX - pos.x) * pos.progress;
        const ty = pos.y + (pos.toY - pos.y) * pos.progress;
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
        const dir = ((pos.facing % 8) + 8) % 8;
        const dead = world.has(id, DeadC);
        const downed = world.get(id, DownedC);
        const carried = world.get(id, CarriedC);
        const hurtLying = dead || !!downed || !!carried;
        const clipName = hurtLying ? 'sleep' : clipFor(crew.activity, speed > 0.3);
        if (clipName !== s.clip) {
          s.clip = clipName;
          s.t = 0;
        }
        // Downed, dead and carried crew hold the first frame of the sleep clip (no dedicated lying clip yet).
        if (!hurtLying) s.t += dt;
        s.lying = clipName === 'sleep';
        for (const { layer, sprite } of s.parts) sprite.texture = layer.frame(dir, colOf(layer, clipName, s.t));
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
        s.root.zIndex = depthKey(s.x, s.y) + (carried ? 0.02 : 0);
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
