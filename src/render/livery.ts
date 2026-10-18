import { Geometry, GlProgram, Mesh, Shader, type Texture } from 'pixi.js';
import type { StaticSprite } from './assets/loader';
import { FAMILY_LUM, RELIEF } from './roofArt';

const VERT = `#version 300 es
in vec2 aPosition;
in vec2 aUV;
in vec2 aBaseUV;
out vec2 vUV;
out vec2 vBase;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main(void) {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vBase = aBaseUV;
}`;

/**
 * Livery recolour (roof_livery.py docstring, v12): a mask pixel in key red / green takes the scheme's P / S colour as
 * opaque paint; the only trace of the plating B under it is a faint relief hint from s = lum(B) / lum(top tone of the
 * tile's colour family): one shade darker below RELIEF.dark (grooves, bolt feet), lighter above RELIEF.light (lit lips,
 * bolt heads). The light tint (uColor, the mesh tint) multiplies the result like the plating's.
 */
const FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
in vec2 vBase;
out vec4 finalColor;
uniform sampler2D uMask;
uniform sampler2D uBase;
uniform vec4 uColor;
uniform vec3 uP;
uniform vec3 uS;
uniform float uRef;
uniform vec4 uBaseRect;
const vec3 LUM = vec3(0.299, 0.587, 0.114);
void main(void) {
  vec4 m = texture(uMask, vUV);
  if (m.a < 0.5) discard;
  vec3 c;
  if (m.r > 0.78 && m.g < 0.235) c = uP;
  else if (m.g > 0.78 && m.r < 0.235) c = uS;
  else discard;
  float h = 0.0;
  if (all(greaterThanEqual(vBase, uBaseRect.xy)) && all(lessThan(vBase, uBaseRect.zw))) {
    vec4 b = texture(uBase, vBase);
    if (b.a > 0.5) {
      float s = dot(b.rgb / b.a, LUM) / uRef;
      h = s < ${RELIEF.dark.toFixed(3)} ? -${RELIEF.kDark.toFixed(3)} : s > ${RELIEF.light.toFixed(3)} ? ${RELIEF.kLight.toFixed(3)} : 0.0;
    }
  }
  finalColor = vec4(clamp(c * (1.0 + h), 0.0, 1.0) * uColor.rgb, 1.0) * uColor.a;
}`;

let program: GlProgram | undefined;

const rgb = (hex: number): Float32Array => new Float32Array([((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]);

/** UV rectangle (u0, v0, u1, v1) of a texture's frame in its source. */
function uvRect(t: Texture): [number, number, number, number] {
  const { x, y, width, height } = t.frame;
  const W = t.source.width;
  const H = t.source.height;
  return [x / W, y / H, (x + width) / W, (y + height) / H];
}

/**
 * One painted livery mask on a roof tile: a quad over the mask sprite (anchored like the base tile) whose shader reads
 * the mask and the base tile's plating under each pixel. `x, y` = the tile's screen anchor (art px).
 */
export function createLiveryMesh(mask: StaticSprite, base: StaticSprite, col: 'o' | 'b', P: number, S: number, x: number, y: number): Mesh<Geometry, Shader> {
  program ??= GlProgram.from({ vertex: VERT, fragment: FRAG, name: 'roof-livery' });
  const w = mask.tex.frame.width;
  const h = mask.tex.frame.height;
  const x0 = Math.round(x - mask.ax);
  const y0 = Math.round(y - mask.ay);
  const [mu0, mv0, mu1, mv1] = uvRect(mask.tex);
  // The base pixel under mask pixel (i, j): same screen point, so offset by the anchor difference.
  const bt = base.tex;
  const bW = bt.source.width;
  const bH = bt.source.height;
  const bx = bt.frame.x + (base.ax - mask.ax);
  const by = bt.frame.y + (base.ay - mask.ay);
  const bu0 = bx / bW;
  const bv0 = by / bH;
  const bu1 = (bx + w) / bW;
  const bv1 = (by + h) / bH;
  const geometry = new Geometry({
    attributes: {
      aPosition: [x0, y0, x0 + w, y0, x0 + w, y0 + h, x0, y0 + h],
      aUV: [mu0, mv0, mu1, mv0, mu1, mv1, mu0, mv1],
      aBaseUV: [bu0, bv0, bu1, bv0, bu1, bv1, bu0, bv1],
    },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });
  const shader = new Shader({
    glProgram: program,
    resources: {
      uMask: mask.tex.source,
      uBase: bt.source,
      livery: {
        uP: { value: rgb(P), type: 'vec3<f32>' },
        uS: { value: rgb(S), type: 'vec3<f32>' },
        uRef: { value: FAMILY_LUM[col], type: 'f32' },
        uBaseRect: { value: new Float32Array(uvRect(bt)), type: 'vec4<f32>' },
      },
    },
  });
  return new Mesh({ geometry, shader, texture: mask.tex });
}
