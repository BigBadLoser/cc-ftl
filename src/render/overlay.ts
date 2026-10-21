import { Container, Sprite } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { ModuleC } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { Struct } from '../sim/structure';
import { diamondTextures } from './diamonds';
import { iso } from './iso';
import { regionTiles } from './regionTiles';
import { overlayDef, rampAt, type OverlayDef } from './overlayDefs';

function hsl(h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

/** Distinct hue for a room id (golden-angle spacing). */
export const roomColor = (id: number): number => hsl((id * 0.618034) % 1, 0.7, 0.45);

/** What the overlay needs besides the grid: module state for the power overlay. */
export interface OverlayWorld {
  world: World;
  modules: Readonly<Record<string, ModuleDef>>;
}

/** Tinted floor diamonds for one grid field (gases, fire, light, power, rooms). Rebuilt from revisions, at most ~8x a second. */
export interface Overlay {
  setField(field: string | null): void;
  update(): void;
}

const MIN_INTERVAL_MS = 120;
const ALPHA = 0.42;

export function createOverlay(grid: Grid, parent: Container, ow: OverlayWorld): Overlay {
  const layer = new Container();
  parent.addChild(layer);
  const tiles = regionTiles(grid);
  const tex = diamondTextures().fill;
  const pool: (Sprite | undefined)[] = [];
  let def: OverlayDef | undefined;
  let key = '';
  let lastAt = -Infinity;

  const sprite = (i: number): Sprite => {
    let s = pool[i];
    if (!s) {
      s = new Sprite(tex);
      s.anchor.set(0.5);
      const p = iso(i % grid.width, Math.floor(i / grid.width));
      s.position.set(p.x, p.y);
      s.alpha = ALPHA;
      layer.addChild(s);
      pool[i] = s;
    }
    return s;
  };

  function powerKey(): string {
    let k = '';
    for (const id of ow.world.query(ModuleC)) {
      const m = ow.world.get(id, ModuleC);
      if (m && grid.inBounds(m.x, m.y)) k += `${id}${m.powered && m.enabled && m.hp > 0 ? 1 : 0}`;
    }
    return k;
  }

  function paint(d: OverlayDef): void {
    const used = new Set<number>();
    const put = (i: number, color: number) => {
      const s = sprite(i);
      s.visible = true;
      s.tint = color;
      used.add(i);
    };
    if (d.special === 'power') {
      tiles.scan((_x, _y, i, ci, c) => {
        const id = (tiles.data('module', c)?.[ci] ?? 0) as number;
        if (!id) return;
        const m = ow.world.get(id, ModuleC);
        const power = m ? (ow.modules[m.def]?.power ?? 0) : 0;
        if (!m || power === 0) return;
        const on = m.powered && m.enabled && m.hp > 0;
        put(i, on ? (power > 0 ? 0x4ce0ff : 0x4cd964) : 0xe5322d);
      }, true);
    } else {
      const room = d.special === 'room';
      const field = room ? 'room' : d.id;
      tiles.scan((_x, _y, i, ci, c) => {
        const s = tiles.data('struct', c)?.[ci];
        if (s !== Struct.Floor && s !== Struct.Door) return;
        const v = (tiles.data(field, c)?.[ci] ?? 0) as number;
        if (room ? v === 0 : d.hideZero && v <= 0) return;
        put(i, room ? roomColor(v) : rampAt(d, v));
      });
    }
    for (let i = 0; i < pool.length; i++) {
      const s = pool[i];
      if (s && !used.has(i)) s.visible = false;
    }
  }

  return {
    setField(f) {
      def = f ? overlayDef(f) : undefined;
      key = '';
      for (const s of pool) if (s) s.visible = false;
    },
    update() {
      if (!def) return;
      const now = performance.now();
      if (now - lastAt < MIN_INTERVAL_MS) return;
      let k: string;
      if (def.special === 'power') k = `p:${grid.revision('module')}:${powerKey()}`;
      else k = `${def.id}:${grid.revision(def.special === 'room' ? 'room' : def.id)}:${grid.revision('struct')}`;
      if (k === key) return;
      key = k;
      lastAt = now;
      paint(def);
    },
  };
}
