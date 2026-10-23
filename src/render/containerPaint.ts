import { Geometry, GlProgram, Mesh, Shader } from 'pixi.js';
import type { StaticSprite } from './assets/loader';
import { lum } from './roofArt';

/**
 * Container livery overlays (tools/blender/sprites/containers.py): `<shell>.paint` is the painted plating in neutral greys,
 * tinted to the livery's primary colour keeping the shading (out = P * lum(px) / lum(plate #6f7b87)); `<shell>.lv` is the trim
 * in key colours (red mkP, green mkS), recoloured to the scheme's P and S. Both draw over the shell, in a mesh shader like the
 * roof livery. The light tint (the mesh tint, uColor) multiplies the result like the shell's.
 */
export type ContainerOverlay = 'paint' | 'lv';

/** Luminance of the plate colour the paint overlay is shaded against. */
const PLATE_LUM = lum(0x6f7b87);

const VERT = `#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main(void) {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}`;

const HEAD = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uMask;
uniform vec4 uColor;
uniform vec3 uP;
uniform vec3 uS;
uniform float uRef;
const vec3 LUM = vec3(0.299, 0.587, 0.114);
void main(void) {
  vec4 m = texture(uMask, vUV);
  if (m.a < 0.02) discard;
  vec3 px = m.rgb / m.a;
  vec3 c;
`;
const TAIL = `
  finalColor = vec4(clamp(c, 0.0, 1.0) * uColor.rgb, 1.0) * (m.a * uColor.a);
}`;
const BODY: Record<ContainerOverlay, string> = {
  paint: 'c = uP * (dot(px, LUM) / uRef);',
  lv: 'c = px.r > px.g ? uP : uS;',
};
const programs = new Map<ContainerOverlay, GlProgram>();

const rgb = (hex: number): Float32Array => new Float32Array([((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]);

/** A mesh over the overlay sprite `s` (local origin at its top-left; the caller positions it like a sprite), recoloured to P and S. */
export function createContainerOverlay(kind: ContainerOverlay, s: StaticSprite, P: number, S: number): Mesh<Geometry, Shader> {
  let program = programs.get(kind);
  if (!program) programs.set(kind, (program = GlProgram.from({ vertex: VERT, fragment: HEAD + BODY[kind] + TAIL, name: `container-${kind}` })));
  const { x, y, width: w, height: h } = s.tex.frame;
  const W = s.tex.source.width;
  const H = s.tex.source.height;
  const geometry = new Geometry({
    attributes: {
      aPosition: [0, 0, w, 0, w, h, 0, h],
      aUV: [x / W, y / H, (x + w) / W, y / H, (x + w) / W, (y + h) / H, x / W, (y + h) / H],
    },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });
  const shader = new Shader({
    glProgram: program,
    resources: {
      uMask: s.tex.source,
      livery: { uP: { value: rgb(P), type: 'vec3<f32>' }, uS: { value: rgb(S), type: 'vec3<f32>' }, uRef: { value: PLATE_LUM, type: 'f32' } },
    },
  });
  return new Mesh({ geometry, shader, texture: s.tex });
}
