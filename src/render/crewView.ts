import { Container, Sprite } from 'pixi.js';
import type { World } from '../sim/ecs';
import { CrewC, DraftedC, PositionC } from '../sim/crew/components';
import type { Atlas, LayerSprite } from './assets/loader';
import { createPaletteFilter, crewPalette } from './assets/palette';
import { diamondTextures } from './diamonds';
import { depthKey, iso } from './iso';
import type { Layers } from './layers';
import { clipFor, crewLoadout } from './loadout';

export interface CrewViewHost {
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
    body.filters = [createPaletteFilter(atlas.manifest.keyColors, crewPalette(crew.appearanceSeed))];
    const parts = layers.map((layer) => {
      const sprite = new Sprite();
      sprite.position.set(-layer.def.anchor.x, -layer.def.anchor.y);
      body.addChild(sprite);
      return { layer, sprite };
    });
    root.addChild(shadow, ring, body);
    const glows = layers
      .filter((l) => l.def.glow)
      .map((layer) => {
        const sprite = new Sprite();
        sprite.blendMode = 'add';
        sprite.position.set(-layer.def.anchor.x, -layer.def.anchor.y);
        root.addChild(sprite);
        let halo: Sprite | null = null;
        if (L.halos) L.halo.addChild((halo = new Sprite()));
        return { layer, sprite, halo };
      });
    L.sorted.addChild(root);
    return { root, parts, glows, ring, x: 0, y: 0, placed: false, clip: '', t: 0, height: Math.max(20, first.def.anchor.y - 6), lying: false };
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
        const clipName = clipFor(crew.activity, speed > 0.3);
        if (clipName !== s.clip) {
          s.clip = clipName;
          s.t = 0;
        }
        s.t += dt;
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
        s.root.position.set(Math.round(p.x), Math.round(p.y));
        s.root.zIndex = depthKey(s.x, s.y);
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
