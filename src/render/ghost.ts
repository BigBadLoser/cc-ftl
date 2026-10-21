import { Filter, GlProgram } from 'pixi.js';

/** Alpha of a ghosted part (roof gear seen from inside a cutaway ship). */
export const GHOST_ALPHA = 0.3;

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

/** Fades the sprite to GHOST_ALPHA and adds a thin light outline one art px (at zoom) outside its silhouette. */
const FRAG = `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform float uZoom;
uniform float uGhost;
const vec3 LINE = vec3(0.72, 0.9, 1.0);
void main(void) {
  vec2 st = uInputSize.zw * uZoom;
  vec4 c = texture(uTexture, vTextureCoord);
  if (c.a > 0.5) { finalColor = c * uGhost; return; }
  float n = max(max(texture(uTexture, vTextureCoord + vec2(st.x, 0.0)).a, texture(uTexture, vTextureCoord - vec2(st.x, 0.0)).a),
                max(texture(uTexture, vTextureCoord + vec2(0.0, st.y)).a, texture(uTexture, vTextureCoord - vec2(0.0, st.y)).a));
  finalColor = n > 0.5 ? vec4(LINE * 0.6, 0.6) : vec4(0.0);
}`;

let program: GlProgram | undefined;

/** Render effect for ghosted roof gear. One filter per sprite (the outline is cheap; few sprites use it). */
export function createGhostFilter(): Filter {
  program ??= GlProgram.from({ vertex: VERT, fragment: FRAG, name: 'roof-ghost' });
  return new Filter({
    glProgram: program,
    padding: 2,
    resources: { ghost: { uZoom: { value: 1, type: 'f32' }, uGhost: { value: GHOST_ALPHA, type: 'f32' } } },
  });
}

/** Camera zoom (device px per art px), so the outline stays one art px wide. */
export function setGhostZoom(filter: Filter, scale: number): void {
  const zoom = Math.max(1, scale);
  const g = filter.resources.ghost as { uniforms: { uZoom: number }; update(): void };
  if (g.uniforms.uZoom === zoom) return;
  g.uniforms.uZoom = zoom;
  filter.padding = Math.max(2, zoom);
  g.update();
}
