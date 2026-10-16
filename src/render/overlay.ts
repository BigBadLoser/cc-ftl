import { Container, Sprite } from 'pixi.js';
import type { Grid } from '../sim/grid';
import { Struct } from '../sim/structure';
import { diamondTextures } from './diamonds';
import { iso } from './iso';

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
/** Blue -> red ramp, t in [0, 1]. */
export const rampColor = (t: number): number => hsl(0.66 * (1 - Math.min(1, Math.max(0, t))), 0.8, 0.42);

/** Tinted floor diamonds for one grid field (rooms, later gases/power...). Rebuilt from revisions. */
export interface Overlay {
  setField(field: string | null): void;
  update(): void;
}

export function createOverlay(grid: Grid, parent: Container): Overlay {
  const layer = new Container();
  parent.addChild(layer);
  const tex = diamondTextures().fill;
  let field: string | null = null;
  let key = '';

  function rebuild(f: string): void {
    for (const c of layer.removeChildren()) c.destroy();
    let data: ArrayLike<number>;
    try {
      data = grid.raw(f);
    } catch {
      return;
    }
    const struct = grid.raw('struct');
    const room = f === 'room';
    let max = 0;
    if (!room) for (let i = 0; i < data.length; i++) max = Math.max(max, data[i] as number);
    for (let i = 0; i < data.length; i++) {
      const s = struct[i];
      if (s !== Struct.Floor && s !== Struct.Door) continue;
      const v = data[i] as number;
      if (room && v === 0) continue;
      const sp = new Sprite(tex);
      sp.anchor.set(0.5);
      const p = iso(i % grid.width, Math.floor(i / grid.width));
      sp.position.set(p.x, p.y);
      sp.tint = room ? roomColor(v) : rampColor(max > 0 ? v / max : 0);
      sp.alpha = 0.3;
      layer.addChild(sp);
    }
  }

  return {
    setField(f) {
      field = f;
      key = '';
      if (!f) for (const c of layer.removeChildren()) c.destroy();
    },
    update() {
      if (!field) return;
      let rev: number;
      try {
        rev = grid.revision(field);
      } catch {
        rev = -2;
      }
      const k = `${field}:${rev}:${grid.revision('struct')}`;
      if (k === key) return;
      key = k;
      rebuild(field);
    },
  };
}
