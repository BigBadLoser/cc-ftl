import { Container, Rectangle, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';

/**
 * Livery paints baked into one shared texture (#389): the roof livery masks (livery.ts) and the container overlays
 * (containerPaint.ts). Each was a mesh with its own recolour shader: a draw call of its own that also cut the depth-sorted
 * batch around it, so a roofed ship in view cost hundreds of draws (and again in the combat inset). A paint depends only on its
 * inputs (mask, plating, colours), never on the frame, so each distinct one is drawn once, through the same mesh, into a cell
 * of this texture, and the world shows it as a plain sprite that batches with everything else. The light tint and fades are
 * the sprite's tint and alpha, which multiply the shader's output exactly as the mesh's did (both write premultiplied colour).
 *
 * Cells are packed in shelves with a texel of padding (linear sampling below zoom 1 never reads a neighbour). New paints are
 * drawn the next frame (`render`); when the texture is full, every paint still in use is repacked into a fresh one (dropping
 * the unused), and after a lost GL context all are drawn again.
 */
export interface PaintAtlas {
  /**
   * A sprite (origin at its top-left; the caller positions it) showing the paint `key`: a w x h mesh, drawn from its local
   * (0, 0), that `make` builds the first time the key is asked for. The key must name every input of the mesh's pixels.
   */
  sprite(key: string, w: number, h: number, make: () => Container): Sprite;
  /** Draw the paints added since the last call (before the world is drawn). */
  render(gl: Renderer): void;
  /** Linear sampling (below zoom 1, as the sheets). */
  setSmooth(on: boolean): void;
  /** Free the texture and the paint meshes (the renderer is going away). */
  dispose(): void;
  /** Debug (render diffs): false makes views built from now on use a mesh per paint, as before the atlas. */
  enabled: boolean;
  readonly cells: number;
}

interface Entry {
  key: string;
  w: number;
  h: number;
  mesh: Container;
  frame: Rectangle;
  tex: Texture;
  sprites: Set<Sprite>;
  drawn: boolean;
}

const ATLAS_W = 2048;
const PAD = 1;

export function createPaintAtlas(): PaintAtlas {
  const entries = new Map<string, Entry>();
  let rt: RenderTexture | null = null;
  let rows = 0;
  // Shelf packer state.
  let sx = PAD;
  let sy = PAD;
  let shelfH = 0;
  let pending = false;
  let full = false;
  let smooth = false;
  let ctxGl: Renderer | null = null;
  const bake = new Container();

  const scale = (): 'linear' | 'nearest' => (smooth ? 'linear' : 'nearest');

  /** A spot for a w x h cell in the current texture, or null when it is full. */
  function place(w: number, h: number): Rectangle | null {
    if (w + 2 * PAD > ATLAS_W) return null;
    if (sx + w + PAD > ATLAS_W) {
      sx = PAD;
      sy += shelfH + PAD;
      shelfH = 0;
    }
    if (sy + h + PAD > rows) return null;
    const r = new Rectangle(sx, sy, w, h);
    sx += w + PAD;
    shelfH = Math.max(shelfH, h);
    return r;
  }

  /** Drop the unused paints and pack the rest into a new texture, at least `extra` texel rows bigger than they need. */
  function repack(extra: number): void {
    for (const [k, e] of entries) {
      if (e.sprites.size > 0) continue;
      e.mesh.destroy();
      entries.delete(k);
    }
    const live = [...entries.values()].sort((a, b) => b.h - a.h || b.w - a.w);
    let area = 0;
    for (const e of live) area += (e.w + PAD) * (e.h + PAD);
    rows = 256;
    while (rows * ATLAS_W < 2 * (area + extra * ATLAS_W)) rows *= 2;
    const fits = (): boolean => {
      sx = PAD;
      sy = PAD;
      shelfH = 0;
      for (const e of live) {
        const r = place(e.w, e.h);
        if (!r) return false;
        e.frame = r;
      }
      return true;
    };
    // Room for the cell that asked (`extra` rows) on a new shelf below the packed ones.
    while (!fits() || sy + shelfH + PAD + extra > rows) rows *= 2;
    rt?.destroy(true);
    rt = RenderTexture.create({ width: ATLAS_W, height: rows, resolution: 1, scaleMode: scale(), label: 'livery-atlas' });
    rt.source.style.update();
    for (const e of live) {
      e.tex = new Texture({ source: rt.source, frame: e.frame });
      for (const s of e.sprites) s.texture = e.tex;
      e.drawn = false;
    }
    full = true;
    pending = true;
  }

  const atlas: PaintAtlas = {
    enabled: true,
    get cells() {
      return entries.size;
    },
    sprite(key, w, h, make) {
      let e = entries.get(key);
      if (!e) {
        let frame = rt ? place(w, h) : null;
        if (!frame) {
          repack(h + PAD);
          frame = place(w, h) as Rectangle;
        }
        e = { key, w, h, mesh: make(), frame, tex: new Texture({ source: (rt as RenderTexture).source, frame }), sprites: new Set(), drawn: false };
        entries.set(key, e);
        pending = true;
      }
      const entry = e;
      const s = new Sprite(entry.tex);
      entry.sprites.add(s);
      s.once('destroyed', () => entry.sprites.delete(s));
      return s;
    },
    render(gl) {
      if (ctxGl !== gl) {
        // A restored context comes back with empty textures: draw every paint again.
        ctxGl = gl;
        gl.runners.contextChange.add({ contextChange: () => { full = true; pending = true; for (const e of entries.values()) e.drawn = false; } });
      }
      if (!pending || !rt) return;
      pending = false;
      for (const e of entries.values()) {
        if (e.drawn) continue;
        e.mesh.position.set(e.frame.x, e.frame.y);
        bake.addChild(e.mesh);
        e.drawn = true;
      }
      if (bake.children.length > 0 || full) gl.render({ container: bake, target: rt, clear: full, clearColor: [0, 0, 0, 0] });
      full = false;
      bake.removeChildren();
    },
    dispose() {
      for (const e of entries.values()) e.mesh.destroy();
      entries.clear();
      bake.destroy();
      rt?.destroy(true);
      rt = null;
    },
    setSmooth(on) {
      if (on === smooth) return;
      smooth = on;
      if (!rt) return;
      rt.source.scaleMode = scale();
      rt.source.style.update();
    },
  };
  return atlas;
}
