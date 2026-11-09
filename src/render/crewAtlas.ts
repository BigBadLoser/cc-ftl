import { BufferImageSource, Container, Geometry, GlProgram, Mesh, Rectangle, RenderLayer, RenderTexture, Shader, Sprite, Texture, type Renderer } from 'pixi.js';
import type { Manifest } from './assets/manifest';
import { crewCompositeFrag, paletteKeys, rgb, type CrewPalette, type PaletteRole } from './assets/palette';
import { ART_SCALE } from './iso';

/**
 * Every crew figure's composite (palette swap, outline, rim, light tint; palette.ts) in one shared texture, so the world draws
 * each figure as one plain sprite that batches with walls and modules. A filter per figure was one offscreen pass each and broke
 * the depth-sorted batch around it (#389).
 *
 * Each figure owns a cell: its layer sprites stack in the cell (at world px, one texel per world px, as the sheets are) of
 * the layer texture, then one draw of a quad per figure (over its layers' bounds, plus the outline) runs the composite shader
 * into the atlas, and the figure's world sprite shows its cell there. Both passes happen once per frame (`render`). The
 * shader reads each cell's colours from a small palette texture (row = cell row, 8 texels per cell: the key replacements, then
 * the tint). Neighbours are sampled one art px (`ART_SCALE` texels) away, as the filter does at any zoom.
 */
export interface CrewCell {
  /** The figure's layers stack here, around the origin (the feet), as they did in the old filtered body. */
  readonly body: Container;
  /** The composited figure: put it where the body was (origin at the feet). */
  readonly sprite: Sprite;
  setPalette(pal: CrewPalette): void;
  /** Light tint (0xRRGGBB), multiplied after the swap. */
  setTint(color: number): void;
  /** Debug (`enabled` off): true takes the body's layers out of the atlas pass, so the body can draw elsewhere; false puts them back. */
  lend(out: boolean): void;
  release(): void;
}

export interface CrewAtlas {
  cell(pal: CrewPalette): CrewCell;
  /** Composite every cell (once per frame, before the world is drawn). `artZoom` < 1 samples the figures linearly. */
  render(gl: Renderer, artZoom: number): void;
  /** Debug (render diffs): false makes crew views draw each figure through its own filter, as before the atlas. */
  readonly enabled: boolean;
  setEnabled(on: boolean): void;
  /** Called on `setEnabled`, so views switch every figure at once; returns the unsubscribe. */
  onToggle(fn: () => void): () => void;
  readonly cells: number;
}

const texUid = (c: Container): number => (c instanceof Sprite ? c.texture.source.uid : 0);

/** Texels per cell in the palette texture: MAX_KEYS replacements, then the tint. */
const PAL_W = 8;
const TINT_TEXEL = 6;
/** Empty texels around every figure frame: the one-art-px outline, plus a texel so linear sampling never reads a neighbour. */
const PAD = ART_SCALE + 2;
const ATLAS_W = 2048;

const VERT = `#version 300 es
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vPos;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform highp vec4 uInputSize;
void main(void) {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vPos = aPosition;
  vTextureCoord = aPosition * uInputSize.zw;
}`;

const FRAG = crewCompositeFrag(
  `in vec2 vPos;\nuniform sampler2D uPalette;\nuniform vec2 uCell;\nivec2 gCell;`,
  (i) => `texelFetch(uPalette, ivec2(gCell.x * ${PAL_W} + ${i}, gCell.y), 0).rgb`,
  `texelFetch(uPalette, ivec2(gCell.x * ${PAL_W} + ${TINT_TEXEL}, gCell.y), 0).rgb`,
  'gCell = ivec2(floor(vPos / uCell));',
);

/** Cell size and the feet's place in it: every crew layer frame fits around the anchor, plus PAD. */
export function crewCellGeometry(manifest: Pick<Manifest, 'assets'>): { w: number; h: number; ox: number; oy: number } {
  let l = 0, r = 0, u = 0, d = 0;
  for (const a of Object.values(manifest.assets)) {
    if (a.kind !== 'crew.layer') continue;
    l = Math.max(l, a.anchor.x);
    r = Math.max(r, a.frameW - a.anchor.x);
    u = Math.max(u, a.anchor.y);
    d = Math.max(d, a.frameH - a.anchor.y);
  }
  return { w: Math.ceil(l + r) + 2 * PAD, h: Math.ceil(u + d) + 2 * PAD, ox: Math.ceil(l) + PAD, oy: Math.ceil(u) + PAD };
}

/** The composite's area for a figure: its visible layers' box, plus the one-art-px outline, inside its cell (atlas px). */
export function figureBounds(body: Container, cell: Rectangle, hx: number, hy: number): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of body.children) {
    if (!c.visible || !(c instanceof Sprite)) continue;
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x + c.width);
    y1 = Math.max(y1, c.y + c.height);
  }
  if (x0 > x1) return null;
  const pad = ART_SCALE;
  return {
    x0: Math.max(cell.x, Math.floor(hx + body.x + x0) - pad),
    y0: Math.max(cell.y, Math.floor(hy + body.y + y0) - pad),
    x1: Math.min(cell.x + cell.width, Math.ceil(hx + body.x + x1) + pad),
    y1: Math.min(cell.y + cell.height, Math.ceil(hy + body.y + y1) + pad),
  };
}

/** True if a sprite and every parent of it are visible (the world draws it this frame, if it is on the stage). */
function drawn(s: Container): boolean {
  let o: Container | null = s;
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

export function createCrewAtlas(manifest: Pick<Manifest, 'assets' | 'keyColors'>): CrewAtlas {
  const g = crewCellGeometry(manifest);
  const cols = Math.max(1, Math.floor(ATLAS_W / g.w));
  const { keys, roles } = paletteKeys(manifest.keyColors);
  const root = new Container();
  // Cells never overlap, so only the stacking inside a figure matters: the layers of every cell are drawn by their place in
  // the stack, then grouped by sheet, so a sheet shared by many figures (the body's idle clip) is one run of the batch.
  const order = new RenderLayer({ sortableChildren: true });
  const slotOf = new WeakMap<Container, number>();
  order.sortRenderLayerChildren = () => {
    const a = order.renderLayerChildren;
    for (const c of a) slotOf.set(c, c.parent ? c.parent.getChildIndex(c) : 0);
    a.sort((x, y) => (slotOf.get(x) ?? 0) - (slotOf.get(y) ?? 0) || texUid(x) - texUid(y));
  };
  root.addChild(order);
  let rows = 0;
  /** The stacked layers (pass 1) and the composited figures (pass 2, what the world samples). */
  let layersRt: RenderTexture | null = null;
  let rt: RenderTexture | null = null;
  let palette = new Uint8Array(0);
  let palTex: Texture | null = null;
  let dirty = true;
  let applied: 'linear' | 'nearest' | null = null;
  const free: number[] = [];
  let next = 0;
  const live = new Map<number, { sprite: Sprite; holder: Container; body: Container; lent: boolean }>();
  const size = new Float32Array(4);
  const shader = new Shader({
    glProgram: GlProgram.from({ vertex: VERT, fragment: FRAG, name: 'crew-atlas' }),
    resources: {
      crew: {
        uKeys: { value: keys, type: 'vec4<f32>', size: keys.length / 4 },
        uCount: { value: roles.length, type: 'f32' },
        uZoom: { value: ART_SCALE, type: 'f32' },
        uCell: { value: new Float32Array([g.w, g.h]), type: 'vec2<f32>' },
        uInputSize: { value: size, type: 'vec4<f32>' },
      },
      uTexture: Texture.EMPTY.source,
      uPalette: Texture.EMPTY.source,
    },
  });
  let quads = 0;
  let mesh: Mesh<Geometry, Shader> | null = null;
  /** A mesh with room for `n` figure quads (unused ones are degenerate). */
  function meshFor(n: number): Mesh<Geometry, Shader> {
    if (mesh && quads >= n) return mesh;
    quads = Math.max(n, quads * 2, 8);
    const index = new Uint32Array(quads * 6);
    for (let q = 0; q < quads; q++) index.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
    mesh?.destroy();
    mesh = new Mesh({ geometry: new Geometry({ attributes: { aPosition: new Float32Array(quads * 8) }, indexBuffer: index }), shader });
    return mesh;
  }

  const frameOf = (i: number) => new Rectangle((i % cols) * g.w, Math.floor(i / cols) * g.h, g.w, g.h);

  /** Make room for `n` cells: a taller texture (and palette); every live sprite gets its frame on the new texture. */
  function grow(n: number): void {
    const need = Math.ceil(n / cols);
    if (need <= rows) return;
    rows = Math.max(need, rows * 2, 2);
    rt?.destroy(true);
    layersRt?.destroy(true);
    applied = null;
    const w = cols * g.w, h = rows * g.h;
    rt = RenderTexture.create({ width: w, height: h, resolution: 1, scaleMode: 'nearest', label: 'crew-atlas' });
    layersRt = RenderTexture.create({ width: w, height: h, resolution: 1, scaleMode: 'nearest', label: 'crew-layers' });
    // The composite samples texel centres of the layers: nearest, set on the GL texture (see `render`).
    layersRt.source.style.update();
    size.set([w, h, 1 / w, 1 / h]);
    shader.resources.uTexture = layersRt.source;
    const old = palette;
    palette = new Uint8Array(cols * PAL_W * rows * 4);
    palette.set(old);
    palTex?.destroy(true);
    palTex = new Texture({ source: new BufferImageSource({ resource: palette, width: cols * PAL_W, height: rows, format: 'rgba8unorm', alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest' }) });
    shader.resources.uPalette = palTex.source;
    for (const [i, c] of live) c.sprite.texture = new Texture({ source: rt.source, frame: frameOf(i) });
    dirty = true;
  }

  function put(i: number, texel: number, color: number): void {
    const o = (Math.floor(i / cols) * cols * PAL_W + (i % cols) * PAL_W + texel) * 4;
    const [r, gg, b] = rgb(color).map((v) => Math.round(v * 255)) as [number, number, number];
    if (palette[o] === r && palette[o + 1] === gg && palette[o + 2] === b) return;
    palette[o] = r;
    palette[o + 1] = gg;
    palette[o + 2] = b;
    palette[o + 3] = 255;
    dirty = true;
  }

  let enabled = true;
  const toggles = new Set<() => void>();
  const atlas: CrewAtlas = {
    get enabled() {
      return enabled;
    },
    setEnabled(on) {
      enabled = on;
      for (const fn of toggles) fn();
    },
    onToggle(fn) {
      toggles.add(fn);
      return () => toggles.delete(fn);
    },
    get cells() {
      return live.size;
    },
    cell(pal) {
      const i = free.pop() ?? next++;
      grow(i + 1);
      const holder = new Container();
      const f = frameOf(i);
      holder.position.set(f.x + g.ox, f.y + g.oy);
      const body = new Container();
      body.on('childAdded', (c: Container) => order.attach(c));
      holder.addChild(body);
      root.addChild(holder);
      const sprite = new Sprite(new Texture({ source: (rt as RenderTexture).source, frame: f }));
      sprite.position.set(-g.ox, -g.oy);
      const entry = { sprite, holder, body, lent: false };
      live.set(i, entry);
      const cell: CrewCell = {
        body,
        sprite,
        setPalette(p) {
          roles.forEach((role: PaletteRole, k) => put(i, k, p[role]));
        },
        setTint: (c) => put(i, TINT_TEXEL, c),
        lend(out) {
          entry.lent = out;
          for (const c of body.children) {
            if (out) order.detach(c);
            else order.attach(c);
          }
        },
        release() {
          live.delete(i);
          holder.destroy({ children: true });
          const t = sprite.texture;
          sprite.destroy();
          t.destroy(false);
          free.push(i);
        },
      };
      cell.setPalette(pal);
      cell.setTint(0xffffff);
      return cell;
    },
    render(gl, artZoom) {
      if (!rt || !live.size) return;
      const mode = artZoom < 1 ? 'linear' : 'nearest';
      if (applied !== mode) {
        // Pixi does not pass a filter change on to the GL texture by itself (nor the mode given at creation): `update` does.
        applied = mode;
        rt.source.scaleMode = mode;
        rt.source.style.update();
      }
      if (dirty && palTex) {
        palTex.source.update();
        dirty = false;
      }
      // Only figures the world draws are stacked and composited (a ship out of view keeps its crew's cells, unused).
      for (const c of live.values()) c.holder.visible = c.lent || drawn(c.sprite);
      gl.render({ container: root, target: layersRt as RenderTexture, clear: true, clearColor: [0, 0, 0, 0] });
      const m = meshFor(live.size);
      const buf = m.geometry.getBuffer('aPosition');
      const pos = buf.data as Float32Array;
      pos.fill(0);
      let q = 0;
      for (const [i, c] of live) {
        if (c.lent || !c.holder.visible) continue;
        const b = figureBounds(c.body, frameOf(i), c.holder.x, c.holder.y);
        if (b) pos.set([b.x0, b.y0, b.x1, b.y0, b.x1, b.y1, b.x0, b.y1], q++ * 8);
      }
      buf.update();
      gl.render({ container: m, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
    },
  };
  return atlas;
}
