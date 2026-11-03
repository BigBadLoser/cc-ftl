import { Geometry, GlProgram, Mesh, Shader } from 'pixi.js';

/**
 * The shield dome: one quad per ship whose shader draws the bubble round the hull (a sheen that is clear in the middle
 * and near solid at the rim, a hex lattice packed toward the rim like a sphere, one lit row of cells per shield layer)
 * and every effect that plays on it (hit ripples, ion drain, a mass-driver hole, a layer breaking or returning, shields
 * going down, the overcharge pulse). It is drawn in screen-aligned art pixels (`uPx` world px each), so it sits with the
 * pixel art; ages are stepped by the caller (12 fps). The sprite pieces on top (flashes, the tear) are fx_shield art.
 */
const VERT = `#version 300 es
in vec2 aPosition;
out vec2 vW;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main(void) {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vW = aPosition;
}`;

/** Hits held at once (a burst laser lands three). */
export const DOME_HITS = 4;
/** Radial pitch of one ring of cells (one layer's lit row), in hex sizes. */
export const RING = 1.6;
/** Hex cell size in art px. */
export const HEX = 22;

const FRAG = `#version 300 es
precision highp float;
in vec2 vW;
out vec4 finalColor;
uniform vec4 uColor;
uniform vec2 uC;
uniform vec2 uAx;
uniform float uRot;
uniform float uPx;
uniform float uLit;
uniform float uOver;
uniform vec4 uHit[${DOME_HITS}];
uniform vec4 uEv;
const float RING = ${RING.toFixed(2)};
const float HEX = ${HEX.toFixed(1)};
const vec3 H0 = vec3(0.918, 0.996, 1.0);
const vec3 H1 = vec3(0.4, 0.878, 1.0);
const vec3 H2 = vec3(0.165, 0.498, 0.659);
const vec3 H3 = vec3(0.09, 0.29, 0.4);
const vec3 I0 = vec3(0.839, 0.886, 1.0);
const vec3 I1 = vec3(0.31, 0.447, 1.0);
const vec3 I2 = vec3(0.231, 0.153, 0.722);
const vec3 W = vec3(1.0);

vec2 local(vec2 p) {
  vec2 d = p - uC;
  float c = cos(uRot), s = sin(uRot);
  return vec2(d.x * c + d.y * s, -d.x * s + d.y * c);
}
vec2 hexRound(vec2 p) {
  float q = p.x * 0.57735 - p.y / 3.0;
  float r = p.y * 2.0 / 3.0;
  vec3 c = vec3(q, -q - r, r);
  vec3 rc = floor(c + 0.5);
  vec3 d = abs(rc - c);
  if (d.x > d.y && d.x > d.z) rc.x = -rc.y - rc.z;
  else if (d.y > d.z) rc.y = -rc.x - rc.z;
  else rc.z = -rc.x - rc.y;
  return rc.xz;
}
// The cell a point falls in: the plane is squeezed toward the rim like a sphere seen from above.
vec2 cellAt(vec2 p) {
  vec2 l = local(p);
  float r = length(l / uAx);
  float s = asin(min(r, 0.999)) / 1.5708 / max(r, 0.001);
  return hexRound(l * s / (HEX * uPx));
}
// Which ring of cells, counted from the rim in, a cell sits in (by its centre on the unwarped sphere).
float ringOf(vec2 c) {
  vec2 w = vec2(1.73205 * (c.x + 0.5 * c.y), 1.5 * c.y) * HEX * uPx;
  float e = max(length(w / uAx), 0.001);
  return floor(max((1.0 / e - 1.0) * length(w), 0.0) / (RING * HEX * uPx));
}
float hash(vec2 v) { return fract(sin(dot(v, vec2(12.9898, 78.233))) * 43758.5453); }
float hash1(float v) { return fract(sin(v * 91.3458) * 47453.5453); }

void main(void) {
  vec2 p = (floor(vW / uPx) + 0.5) * uPx;           // one art pixel
  vec2 l = local(p);
  float r = length(l / uAx);
  float breakAge = uEv.x, regenAge = uEv.y, downAge = uEv.z, downRows = uEv.w;
  if (r > (breakAge >= 0.0 ? 1.08 : 1.0)) discard;
  vec2 cell = cellAt(p);
  vec2 cr = cellAt(p + vec2(uPx, 0.0)), cd = cellAt(p + vec2(0.0, uPx));
  bool line = r < 1.0 && r > 0.2 && (cr != cell || cd != cell);
  float ch = hash(cell);
  float ring = ringOf(cell);
  if (line) ring = min(ring, min(ringOf(cr), ringOf(cd)));   // a line edging a lit cell is lit
  bool outer = ring < 0.5;
  float t = clamp((r - 0.25) / 0.75, 0.0, 1.0);
  float rows = downAge >= 0.0 ? downRows : uLit;
  float regenRow = regenAge >= 0.0 ? 1.0 : 0.0;

  // the sheen: clear middle, near solid toward the rim, deep blue at the edge
  vec3 col = mix(H2, H3, clamp((t - 0.75) / 0.25, 0.0, 1.0));
  float al = r < 1.0 ? pow(t, 2.6) * 0.92 * (1.0 + 0.2 * uOver) : 0.0;
  vec3 glow = vec3(0.0);
  if (line) {
    // unlit lines: faint in the middle, and toward the rim a lighter shade of the sheen rather than full cyan
    float la = floor((0.25 + 0.6 * pow(t, 1.4)) * 4.0 + 0.5) / 4.0 * (0.4 + 0.3 * uOver);
    col = mix(col, H1, al > la ? 0.45 + 0.3 * uOver : 1.0);
    al = max(al, la);
    if (ring < rows - regenRow) {                             // one lit ring of cells per layer, from the rim in
      col = mix(H1, H0, 0.35 + 0.6 * uOver);
      al = 1.0;
      glow = H1 * (0.6 + 0.5 * uOver);
    }
  } else if (r < 1.0 && ring < rows - regenRow) {    // and a faint fill inside the lit cells
    col = mix(col, H1, 0.35 + 0.3 * uOver);
    al = max(al, 0.18 + 0.15 * uOver);
  }

  if (breakAge >= 0.0) {                                       // the outer row flashes, its cells drop out, shards drift off
    outer = outer && line;
    if (outer && breakAge < 0.1) { col = W; al = 1.0; glow += H0 * 0.5; }
    else if (outer && ch > breakAge * 1.2) { col = breakAge < 0.5 ? H0 : H1; al = max(al, 1.0 - 0.4 * breakAge); glow += H1 * 0.4; }
    float ang = atan(l.y / uAx.y, l.x / uAx.x);
    for (int j = 0; j < 70; j++) {
      float fj = float(j);
      float born = hash1(fj + 3.1) * 0.8;
      float age = (breakAge - born) / 0.5;
      if (age < 0.0 || age > 1.0) continue;
      float a = (hash1(fj) * 2.0 - 1.0) * 3.14159;
      float rr = 0.985 + 0.07 * age;
      vec2 sp = vec2(uAx.x * rr * cos(a), uAx.y * rr * sin(a));
      vec2 dd = abs(l - sp) / uPx;
      if (dd.x + dd.y < 1.4 * (1.0 - 0.4 * age) + 0.5) { col = age < 0.4 ? H0 : age < 0.75 ? H1 : H2; al = 1.0 - 0.5 * age; }
    }
    if (r >= 1.0 && al <= 0.0) discard;
  }

  // the hit drawn over the break it caused (a laser or a drain that took the layer)
  // hits: x, y (bubble frame, world px), age 0..1 (<0 unused), kind (1 absorbed, 2 ion, 3 pierce)
  float reach = clamp(uAx.x * 0.3, 60.0 * uPx, 160.0 * uPx);
  for (int i = 0; i < ${DOME_HITS}; i++) {
    vec4 h = uHit[i];
    if (h.z < 0.0) continue;
    float d = length(l - h.xy);
    float k = h.z;
    if (h.w < 1.5) {                                          // absorbed: a ring of lit cells runs out from the hit
      float front = reach * k;
      if (line && d < front) { col = mix(H1, H0, 0.6 * (1.0 - k)); al = max(al, 1.0 - 0.4 * k); glow += H1 * 0.7 * (1.0 - k); }
      else if (d < front && r < 1.0) { col = mix(col, mix(H1, H0, 0.3), 0.75 * (1.0 - k)); al = max(al, 0.6 * (1.0 - k)); glow += H1 * 0.25 * (1.0 - k); }
      if (line && abs(d - front) < 12.0 * uPx) { col = H0; al = 1.0; glow += H0 * 0.8 * (1.0 - 0.5 * k); }
    } else if (h.w < 2.5) {                                   // ion: the outer row goes violet and drains into the hit
      bool rimRow = ring < 1.5 && d < reach * (0.8 + 3.0 * k);
      if (rimRow && line) { col = k < 0.6 ? I0 : I1; al = 1.0; glow = I1 * 0.8 * (1.0 - 0.6 * k); }
      else if (rimRow && r < 1.0) { col = mix(col, I2, 0.7); al = max(al, 0.45 * (1.0 - 0.5 * k)); }
      float front = reach * 1.5 * (1.0 - k);
      if (line && d > front && d < reach * 1.5) { col = I1; al = 1.0; glow += I2 * 0.7 * (1.0 - k); }
      else if (d > front && d < reach * 1.5 && r < 1.0) { col = mix(col, I2, 0.6); al = max(al, 0.35 * (1.0 - k)); }
      if (line && abs(d - front) < 10.0 * uPx) { col = I0; al = 1.0; glow += I1 * 0.9; }
    } else {                                                  // pierce: a hole torn round the hit, closing up again
      float size = (k < 0.3 ? mix(10.0, 14.0, k / 0.3) : k < 0.6 ? mix(14.0, 10.0, (k - 0.3) / 0.3) : mix(10.0, 3.0, (k - 0.6) / 0.4)) * uPx;
      vec2 q = l - h.xy * 0.97;
      float hd = length(vec2(q.x, q.y * 1.4));
      if (hd < size * (0.75 + 0.35 * ch)) { al = 0.0; glow = vec3(0.0); }
      else if (line && d < size + 7.0 * uPx) { col = H0; al = 1.0; }
    }
  }

  if (regenAge >= 0.0 && r < 1.0 && ring > rows - 1.5 && ring < rows - 0.5) {
    float a = (atan(l.y / uAx.y, l.x / uAx.x) + 3.14159) / 6.28318;   // a new row sweeps on round the rim
    bool head = a < regenAge && a > regenAge - 0.08;
    if (line && a < regenAge) { col = a > regenAge - 0.25 ? H0 : mix(H1, H0, 0.35); al = 1.0; glow += H1 * (a > regenAge - 0.25 ? 0.9 : 0.6); }
    else if (head) { col = mix(col, H0, 0.6); al = max(al, 0.55); glow += H1 * 0.4; }
    if (line && head) { col = W; al = 1.0; glow += H0; }
  }

  if (downAge >= 0.0) {                                        // shields down: the lattice sputters out, sparks crackle
    if (downAge >= 1.0) discard;
    float x = downAge * 9.0;
    int i0 = int(floor(x));
    float FL[10] = float[10](1.0, 0.3, 0.85, 0.2, 0.65, 0.1, 0.45, 0.05, 0.25, 0.0);
    float keep = mix(FL[i0], FL[min(i0 + 1, 9)], fract(x));
    float m = ch < keep ? keep : 0.08;
    al *= m;
    glow *= m;
    float frame = floor(downAge * 14.0);
    if (keep > 0.0 && keep < 1.0 && line && ring < 2.5 && hash(cell + vec2(frame * 1.37, frame * 0.71)) > 0.975) {
      col = W; al = 1.0; glow += H0 * 0.5;
    }
  }

  if (al <= 0.003 && dot(glow, glow) < 0.0001) discard;
  finalColor = vec4(col * al + glow * (1.0 - al * 0.5), al) * uColor.a;
}`;

let program: GlProgram | undefined;

export interface DomeUniforms {
  uC: Float32Array;
  uAx: Float32Array;
  uRot: number;
  uPx: number;
  uLit: number;
  uOver: number;
  uHit: Float32Array;
  uEv: Float32Array;
}

/** A dome mesh over the box (x0, y0)..(x1, y1) in sector art px; its uniforms are set each frame through `uniforms`. */
export function createDomeMesh(x0: number, y0: number, x1: number, y1: number): { mesh: Mesh<Geometry, Shader>; uniforms: DomeUniforms } {
  program ??= GlProgram.from({ vertex: VERT, fragment: FRAG, name: 'shield-dome' });
  const geometry = new Geometry({
    attributes: { aPosition: [x0, y0, x1, y0, x1, y1, x0, y1] },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });
  const hit = new Float32Array(DOME_HITS * 4);
  for (let i = 0; i < DOME_HITS; i++) hit[i * 4 + 2] = -1;
  const shield = {
    uC: { value: new Float32Array(2), type: 'vec2<f32>' },
    uAx: { value: new Float32Array(2), type: 'vec2<f32>' },
    uRot: { value: 0, type: 'f32' },
    uPx: { value: 2, type: 'f32' },
    uLit: { value: 0, type: 'f32' },
    uOver: { value: 0, type: 'f32' },
    uHit: { value: hit, type: 'vec4<f32>', size: DOME_HITS },
    uEv: { value: new Float32Array([-1, -1, -1, 0]), type: 'vec4<f32>' },
  };
  const shader = new Shader({ glProgram: program, resources: { shield } });
  const mesh = new Mesh({ geometry, shader });
  const group = shader.resources.shield as { uniforms: Record<string, unknown> };
  const u = group.uniforms;
  const uniforms = {} as DomeUniforms;
  for (const k of Object.keys(shield) as (keyof DomeUniforms)[]) {
    Object.defineProperty(uniforms, k, {
      get: () => u[k],
      set: (v) => {
        u[k] = v;
      },
    });
  }
  return { mesh, uniforms };
}
