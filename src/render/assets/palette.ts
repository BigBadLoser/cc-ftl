import { Filter, GlProgram } from 'pixi.js';

/** Per-crew colours for the palette-swap of `team.*` key colours. 0xRRGGBB. */
export interface CrewPalette {
  skin: number;
  hair: number;
  cloth: number;
  accent: number;
}

const SKIN = [0xf5d0ac, 0xe8b48a, 0xd09468, 0xb07c54, 0x8f6040, 0x6e4430];
const HAIR = [0x2a2018, 0x4e3624, 0x8a5a2e, 0xc8903f, 0xf0d070, 0xc4cad4, 0xb03c2c, 0x3f5fa8];
const CLOTH = [0xe8582c, 0x3f8cf0, 0x3fbf5a, 0xb45ff0, 0xf0c030, 0xe8ecf4, 0xe04a8a, 0x2fd0c0];
const ACCENT = [0xffd23a, 0x37d2e8, 0xff6a4a, 0xa8e05a];

/** Small deterministic integer hash (render-side only; never touches the sim RNG). */
export function hash(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const pick = <T>(list: readonly T[], seed: number, salt: number): T => list[hash(seed, salt) % list.length] as T;

/** Saturation boost of clothing (pipeline default: +30%, so shirts read against skin and pants). */
const CLOTH_SAT = 1.3;
function saturate(hex: number, f: number): number {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const y = 0.3 * r + 0.59 * g + 0.11 * b;
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, y + (v - y) * f)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}

export function crewPalette(seed: number): CrewPalette {
  return { skin: pick(SKIN, seed, 1), hair: pick(HAIR, seed, 2), cloth: saturate(pick(CLOTH, seed, 3), CLOTH_SAT), accent: pick(ACCENT, seed, 4) };
}

const MAX_KEYS = 6;
const VERT = `#version 300 es
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;
/**
 * Crew composite shader, run once on a crew member's stacked layers:
 *  - palette swap: a pixel that is s*K for a key colour K becomes the crew colour on the shade ramp (the same ramp as
 *    tools/blender compose.shade: cooler shadows, warmer lights), then the light tint;
 *  - ONE 1 px outline around the combined alpha: a fixed near-black (OUTLINE), so crew separate from any floor;
 *  - a thin cool rim on the left silhouette edge.
 * Neighbours are sampled `uZoom` px away (one art px at the camera's integer zoom), so everything stays on the art grid.
 */
const FRAG = `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform vec4 uKeys[${MAX_KEYS}];
uniform vec4 uRepl[${MAX_KEYS}];
uniform float uCount;
uniform float uZoom;
uniform vec3 uTint;
const float MULT[5] = float[5](0.42, 0.62, 0.82, 1.0, 1.22);
// Near-black outline (#0a0f16), independent of the clothing colour.
const vec3 OUTLINE = vec3(10.0, 15.0, 22.0) / 255.0;
const float LIFT = 1.25;
const vec3 RIM = vec3(0.47, 0.8, 1.0);
// Sit clips mark crew pixels hidden behind the chair with a faint alpha: drawn as nothing, and no outline or rim along the cut.
const float HIDDEN = 0.01;

vec3 ramp(vec3 col, float s) {
  int lv = int(s > 0.385) + int(s > 0.555) + int(s > 0.73) + int(s > 0.91);
  float m = MULT[lv];
  if (m < 1.0) return col * m * pow(vec3(0.88, 0.96, 1.18), vec3((1.0 - m) * 1.5));
  return col * m * (m > 1.0 ? vec3(1.04, 1.0, 0.92) : vec3(1.0));
}

vec3 swapColor(vec4 c) {
  vec3 p = c.rgb / c.a;
  for (int i = 0; i < ${MAX_KEYS}; i++) {
    if (float(i) >= uCount) break;
    vec3 k = uKeys[i].rgb;
    float s = dot(p, k) / dot(k, k);
    if (s > 0.25 && s < 1.4 && length(p - s * k) < 0.14 * max(s, 0.5)) return clamp(ramp(uRepl[i].rgb, s), 0.0, 1.0);
  }
  // Fixed-colour crew parts (pants, boots, tee): lifted a little so dark clothing keeps value separation from the floor.
  return min(p * LIFT + 0.015, 1.0);
}

void main(void) {
  vec2 st = uInputSize.zw * uZoom;
  vec4 c = texture(uTexture, vTextureCoord);
  if (c.a > 0.5) {
    vec3 col = swapColor(c);
    float l = texture(uTexture, vTextureCoord - vec2(st.x, 0.0)).a;
    float r = texture(uTexture, vTextureCoord + vec2(st.x, 0.0)).a;
    if (l < HIDDEN && r > 0.5) col = mix(col, RIM, 0.38);
    finalColor = vec4(col * uTint, 1.0);
    return;
  }
  if (c.a > HIDDEN) {
    finalColor = vec4(0.0);
    return;
  }
  float n = 0.0;
  vec2 offs[4] = vec2[4](vec2(st.x, 0.0), vec2(-st.x, 0.0), vec2(0.0, st.y), vec2(0.0, -st.y));
  for (int i = 0; i < 4; i++) {
    vec4 q = texture(uTexture, vTextureCoord + offs[i]);
    if (q.a > 0.5) {
      n += 1.0;
    }
  }
  if (n > 0.0) finalColor = vec4(OUTLINE * uTint, 1.0);
  else finalColor = vec4(0.0);
}`;

const rgb = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const parseHex = (s: string): number => parseInt(s.replace('#', ''), 16);

let program: GlProgram | undefined;

/** Composite filter for one crew member: palette swap of the manifest's key colours, one outline, thin rim. */
export function createCrewFilter(keyColors: Record<string, string>, pal: CrewPalette): Filter {
  program ??= GlProgram.from({ vertex: VERT, fragment: FRAG, name: 'crew-composite' });
  const keys = new Float32Array(MAX_KEYS * 4);
  const repl = new Float32Array(MAX_KEYS * 4);
  let n = 0;
  for (const [name, hex] of Object.entries(keyColors)) {
    if (n >= MAX_KEYS) break;
    const role = name.split('.').pop() ?? '';
    const to = role === 'skin' ? pal.skin : role === 'hair' ? pal.hair : role === 'accent' ? pal.accent : pal.cloth;
    keys.set(rgb(parseHex(hex)), n * 4);
    repl.set(rgb(to), n * 4);
    n++;
  }
  return new Filter({
    glProgram: program,
    padding: 1,
    resources: {
      palette: {
        uKeys: { value: keys, type: 'vec4<f32>', size: MAX_KEYS },
        uRepl: { value: repl, type: 'vec4<f32>', size: MAX_KEYS },
        uCount: { value: n, type: 'f32' },
        uZoom: { value: 1, type: 'f32' },
        uTint: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
      },
    },
  });
}

/** Multiply the filter's output by a packed colour (applied after the palette swap, so key colours still match). */
export function setFilterTint(filter: Filter, color: number): void {
  const group = filter.resources.palette as { uniforms: { uTint: Float32Array }; update(): void };
  const t = group.uniforms.uTint;
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  if (t[0] === r && t[1] === g && t[2] === b) return;
  t[0] = r;
  t[1] = g;
  t[2] = b;
  group.update();
}

/** Camera zoom (device px per art px): the outline and rim step this far, and the filter pads one art px. */
export function setFilterZoom(filter: Filter, zoom: number): void {
  const group = filter.resources.palette as { uniforms: { uZoom: number }; update(): void };
  if (group.uniforms.uZoom === zoom) return;
  group.uniforms.uZoom = zoom;
  filter.padding = zoom;
  group.update();
}
