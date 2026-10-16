import {
  Color, DataTexture, FrontSide, Mesh, MeshStandardMaterial, MeshToonMaterial, NearestFilter, RedFormat,
  ShaderMaterial, Vector2, type Material, type Object3D, type WebGLRenderer, type WebGLRenderTarget,
} from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

/** Per-material shader hooks shared by the standard and toon variants. */
export interface Hook { grain?: number; rim?: number }

/** 3-band toon ramp. */
const ramp = new DataTexture(new Uint8Array([78, 168, 255]), 3, 1, RedFormat);
ramp.minFilter = ramp.magFilter = NearestFilter;
ramp.needsUpdate = true;

/** Adds voxel-cell grain (1/16 tile cells, matching the ship) and/or a cool rim light. */
export function hook<T extends Material>(m: T, h: Hook): T {
  m.userData.hook = h;
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vLocal;
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= 1.0 + ${(h.grain ?? 0).toFixed(3)} * (h31(floor(vLocal * 16.0) + 7.0) - 0.5) * 2.0;`)
      .replace('#include <opaque_fragment>', `outgoingLight += vec3(0.35, 0.8, 1.0) * ${(h.rim ?? 0).toFixed(3)} * pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 2.5);
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `${h.grain ?? 0}|${h.rim ?? 0}`;
  return m;
}

const twins = new WeakMap<Material, MeshToonMaterial>();
function toonOf(m: MeshStandardMaterial): MeshToonMaterial {
  let t = twins.get(m);
  if (!t) {
    t = new MeshToonMaterial({ color: m.color, vertexColors: m.vertexColors, gradientMap: ramp });
    t.flatShading = m.flatShading; // not in the typings, but the program cache reads it
    t.userData.std = m;
    if (m.userData.hook) hook(t, m.userData.hook as Hook);
    twins.set(m, t);
  }
  return t;
}

/** Swap every standard material under `root` for its 3-band toon twin (or back). */
export function applyToon(root: Object3D, on: boolean): void {
  root.traverse((o) => {
    const me = o as Mesh;
    if (!me.isMesh) return;
    const mat = me.material as Material;
    if (on && (mat as MeshStandardMaterial).isMeshStandardMaterial) me.material = toonOf(mat as MeshStandardMaterial);
    else if (!on && mat.userData.std) me.material = mat.userData.std as Material;
  });
}

/**
 * Edge pass on the scene depth. Ortho depth is linear, so the Laplacian is ~0 on any plane and spikes on
 * silhouettes and creases: one cheap full-screen pass outlines ship and crew alike.
 */
export class OutlinePass extends Pass {
  private readonly quad: FullScreenQuad;
  private readonly mat = new ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null }, tDepth: { value: null }, texel: { value: new Vector2(1, 1) },
      range: { value: 599 }, thr: { value: 0.01 }, k: { value: 1 }, col: { value: new Color(0x03050a) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse, tDepth; uniform vec2 texel; uniform float range, thr, k; uniform vec3 col; varying vec2 vUv;
float D(vec2 o){ return texture2D(tDepth, vUv + o * texel * k).x * range; }
void main(){
  vec4 c = texture2D(tDiffuse, vUv);
  float lap = abs(D(vec2(1,0)) + D(vec2(-1,0)) + D(vec2(0,1)) + D(vec2(0,-1)) - 4.0 * D(vec2(0)));
  gl_FragColor = vec4(mix(c.rgb, col, smoothstep(thr, thr * 2.5, lap) * 0.92), c.a);
}`,
    side: FrontSide, depthTest: false, depthWrite: false,
  });

  constructor() {
    super();
    this.quad = new FullScreenQuad(this.mat);
  }

  /** `texelWorld`: world units covered by one render-target texel. */
  configure(w: number, h: number, texelWorld: number, k: number): void {
    this.mat.uniforms.texel!.value.set(1 / w, 1 / h);
    this.mat.uniforms.k!.value = k;
    this.mat.uniforms.thr!.value = Math.max(0.004, texelWorld * k * 0.9);
  }

  override render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void {
    this.mat.uniforms.tDiffuse!.value = readBuffer.texture;
    this.mat.uniforms.tDepth!.value = readBuffer.depthTexture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  override dispose(): void {
    this.mat.dispose();
    this.quad.dispose();
  }
}
