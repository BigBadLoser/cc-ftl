/**
 * The starmap's labels as Pixi `Text`, pooled by content and style: a label is made once and shown, moved and hidden as the layout
 * changes. Sizes are screen px (the label sits in map space at scale 1 / s, so one texel is one device px and the glyphs stay sharp).
 * Like the SVG text it replaces: centred on x, `y` the baseline, a background-coloured halo (stroke under the fill) round the glyphs.
 */
import { CanvasTextMetrics, Container, Text, TextStyle } from 'pixi.js';

export interface LabelStyle {
  font: 'head' | 'pixel';
  /** Screen px. */
  size: number;
  fill: number;
  fillAlpha?: number;
  /** Halo width in screen px (0: none) and colour. */
  halo?: number;
  bold?: boolean;
  /** Letter spacing in em. */
  spacing?: number;
  upper?: boolean;
}

const FONTS = {
  head: "Rajdhani, 'Barlow Condensed', 'Roboto Condensed', 'Arial Narrow', system-ui, sans-serif",
  pixel: "Silkscreen, Rajdhani, monospace",
};

export interface LabelPool {
  /** Start a layout: everything is hidden until `put` shows it again. */
  begin(): void;
  /** Show `text` centred on (x, y baseline), in map units; `k` = 1 / scale so it draws at device size. Returns the label. */
  put(text: string, st: LabelStyle, x: number, y: number, k: number): Text;
  /** Hide whatever `put` did not show since `begin`. */
  end(): void;
  destroy(): void;
}

export function createLabelPool(parent: Container, bg: number): LabelPool {
  const cache = new Map<string, Text>();
  const used = new Set<string>();
  const seen = new Map<string, number>();
  const offsets = new Map<string, number>();
  return {
    begin() {
      used.clear();
      seen.clear();
    },
    put(text, st, x, y, k) {
      const shown = st.upper ? text.toUpperCase() : text;
      const base = `${st.font}|${st.size}|${st.fill}|${st.fillAlpha ?? 1}|${st.halo ?? 0}|${st.bold ? 1 : 0}|${st.spacing ?? 0}|${shown}`;
      // The same label twice in one layout (two exits with the same figures) needs two objects.
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const key = `${base}#${n}`;
      let t = cache.get(key);
      const halo = st.halo ?? 0;
      if (!t) {
        const style = new TextStyle({
          fontFamily: FONTS[st.font], fontSize: st.size, fontWeight: st.bold ? '700' : st.font === 'head' ? '600' : '400',
          fill: { color: st.fill, alpha: st.fillAlpha ?? 1 }, letterSpacing: (st.spacing ?? 0) * st.size,
          ...(halo ? { stroke: { color: bg, width: halo, join: 'round' as const } } : {}),
          padding: Math.ceil(halo / 2) + 1,
        });
        t = new Text({ text: shown, style, roundPixels: true });
        t.eventMode = 'none';
        t.anchor.set(0.5, 0);
        const m = CanvasTextMetrics.measureFont(style.fontStyle + ' ' + style.fontVariant + ' ' + style.fontWeight + ' ' + style.fontSize + 'px ' + style.fontFamily);
        offsets.set(key, m.ascent + style.padding);
        parent.addChild(t);
        cache.set(key, t);
      }
      t.scale.set(k);
      t.position.set(x, y - (offsets.get(key) as number) * k);
      t.visible = true;
      used.add(key);
      return t;
    },
    end() {
      for (const [key, t] of cache) if (!used.has(key)) t.visible = false;
      if (cache.size > 500) {
        for (const [key, t] of cache) {
          if (used.has(key)) continue;
          t.destroy();
          cache.delete(key);
          offsets.delete(key);
        }
      }
    },
    destroy() {
      for (const t of cache.values()) t.destroy();
      cache.clear();
    },
  };
}
