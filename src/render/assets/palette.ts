import { Filter, GlProgram } from 'pixi.js';

/** Per-crew colours for the palette-swap of `team.*` key colours. 0xRRGGBB. */
export interface CrewPalette {
  skin: number;
  hair: number;
  cloth: number;
  accent: number;
}

const SKIN = [0xf1c9a5, 0xe0ac84, 0xc68a62, 0x9c6a48, 0x7a4c33, 0x56321f];
const HAIR = [0x1c1612, 0x3b2a1c, 0x6b4426, 0xa8763a, 0xd9b45a, 0x8a8f99, 0x7a2e24, 0x2b3f66];
const CLOTH = [0xc2552d, 0x3f7fbf, 0x4f9a5e, 0x9a5fbf, 0xc9a13a, 0x6a7380, 0xbf4f7c, 0x3aa6a0];
const ACCENT = [0xffd23a, 0x37d2e8, 0xff6a4a, 0xa8e05a];

/** Small deterministic integer hash (render-side only; never touches the sim RNG). */
export function hash(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const pick = <T>(list: readonly T[], seed: number, salt: number): T => list[hash(seed, salt) % list.length] as T;

export function crewPalette(seed: number): CrewPalette {
  return { skin: pick(SKIN, seed, 1), hair: pick(HAIR, seed, 2), cloth: pick(CLOTH, seed, 3), accent: pick(ACCENT, seed, 4) };
}

const MAX_KEYS = 6;
const VERT = `
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
/** A pixel matches a key colour K when it is a shade of it (p ~ s*K); the replacement is scaled by the same s. */
const FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uKeys[${MAX_KEYS}];
uniform vec4 uRepl[${MAX_KEYS}];
uniform float uCount;
uniform vec3 uTint;
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  if (c.a < 0.01) { finalColor = c; return; }
  vec3 p = c.rgb / c.a;
  for (int i = 0; i < ${MAX_KEYS}; i++) {
    if (float(i) >= uCount) break;
    vec3 k = uKeys[i].rgb;
    float s = dot(p, k) / dot(k, k);
    if (s > 0.3 && s < 1.4 && length(p - s * k) < 0.14 * max(s, 0.5)) {
      p = clamp(uRepl[i].rgb * s, 0.0, 1.0);
      break;
    }
  }
  finalColor = vec4(p * uTint * c.a, c.a);
}`;

const rgb = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const parseHex = (s: string): number => parseInt(s.replace('#', ''), 16);

let program: GlProgram | undefined;

/** Filter remapping the manifest's key colours (team.skin, team.hair, team.cloth...) to a crew palette. */
export function createPaletteFilter(keyColors: Record<string, string>, pal: CrewPalette): Filter {
  program ??= GlProgram.from({ vertex: VERT, fragment: FRAG, name: 'crew-palette' });
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
    resources: {
      palette: {
        uKeys: { value: keys, type: 'vec4<f32>', size: MAX_KEYS },
        uRepl: { value: repl, type: 'vec4<f32>', size: MAX_KEYS },
        uCount: { value: n, type: 'f32' },
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
