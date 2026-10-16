import './lab.css';
import {
  ACESFilmicToneMapping, AmbientLight, Color, DepthTexture, DirectionalLight, HalfFloatType, HemisphereLight,
  PCFShadowMap, Scene, Vector2, Vector3, WebGLRenderTarget, WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createCameraRig } from '../../src/render/camera';
import { applyToon, OutlinePass } from './fx';
import { buildEnv, H, W } from './env';
import { buildCrew, pose, Sparks, type Crew, type Mode } from './rig';
import { glow, STYLES } from './styles';

const canvas = document.createElement('canvas');
document.body.append(canvas);
const el = <T extends HTMLElement>(tag: string, cls = '', text = ''): T => {
  const e = document.createElement(tag) as T;
  e.className = cls;
  e.textContent = text;
  document.body.append(e);
  return e;
};

// ---- renderer, scene, the game's lighting setup ----------------------------------------------------------------
const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.7;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
const scene = new Scene();
scene.background = new Color(0x07090d);
const rig = createCameraRig();
const ambient = new AmbientLight(0x8a9abb, 1.3);
const hemi = new HemisphereLight(0x8fa8d4, 0x1d1712, 1.0);
const key = new DirectionalLight(0xd4e0ff, 2.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0006;
key.shadow.normalBias = 0.02;
const R = Math.max(W, H) * 0.9;
Object.assign(key.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: R * 6 });
key.shadow.camera.updateProjectionMatrix();
key.position.set(R * 0.5, R * 1.6, R * 1.1);
scene.add(ambient, hemi, key, key.target);

const env = buildEnv(scene);
const sparks = new Sparks();
scene.add(sparks.group);

// ---- post: scene -> depth-bearing target -> outline -> bloom -> tone map -----------------------------------------
const target = new WebGLRenderTarget(2, 2, { type: HalfFloatType, samples: 4, depthTexture: new DepthTexture(2, 2) });
const composer = new EffectComposer(renderer, target);
const outline = new OutlinePass();
const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.55, 0.5, 0.85);
composer.addPass(new RenderPass(scene, rig.camera));
composer.addPass(outline);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---- crew: same engineer, four styles ----------------------------------------------------------------------------
const XS = [2.5, 4.2, 5.9, 7.6];
interface Slot { crew: Crew; home: Vector3; label: HTMLElement; sub: HTMLElement; i: number }
const slots: Slot[] = STYLES.map((S, i) => {
  const crew = buildCrew(S);
  scene.add(crew.root);
  const label = el('div', 'lab');
  label.append(Object.assign(document.createElement('b'), { textContent: String(S.id) }));
  const nm = Object.assign(document.createElement('span'), { textContent: S.name });
  const sub = Object.assign(document.createElement('small'), { textContent: S.blurb });
  label.append(nm, sub);
  return { crew, home: new Vector3(XS[i]! - W / 2, 0, 3.2 - H / 2), label, sub, i };
});

// ---- state + UI --------------------------------------------------------------------------------------------------
const st = { toon: 'Off', zoom: 'Close', anim: 'Idle', turn: 'Off', power: 'On', quality: 'High' };
const toon = (): boolean => st.toon === 'On';
let pr = 1;
let cw = 1, ch = 1;
const sizeAll = (): void => {
  cw = window.innerWidth;
  ch = window.innerHeight;
  pr = st.quality === 'High' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  renderer.setPixelRatio(pr);
  renderer.setSize(cw, ch, false);
  composer.setPixelRatio(pr);
  composer.setSize(cw, ch);
  rig.resize(cw, ch);
};
function frameView(): void {
  const viewH = st.zoom === 'Game' ? Math.max(5, (ch * 1.22) / 50) : Math.max(5, 6.6 / (cw / ch));
  rig.setView(new Vector3(0, 0.55, 0.2), viewH);
}
function applyState(): void {
  const on = st.power === 'On';
  ambient.intensity = on ? 1.3 : 0.18;
  hemi.intensity = on ? 1.0 : 0.15;
  key.intensity = on ? 2.4 : 0.25;
  env.lights.forEach((l, i) => (l.visible = on || i === 1));
  key.castShadow = st.quality === 'High';
  bloom.enabled = st.quality === 'High';
  outline.enabled = toon();
  applyToon(scene, toon());
}

const ui = el('div');
ui.id = 'ui';
const defs: [string, keyof typeof st, string[]][] = [
  ['Outline + toon', 'toon', ['Off', 'On']],
  ['Zoom', 'zoom', ['Close', 'Game']],
  ['Anim', 'anim', ['Idle', 'Walk', 'Work']],
  ['Turntable', 'turn', ['Off', 'On']],
  ['Power', 'power', ['On', 'Off']],
  ['Quality', 'quality', ['High', 'Low']],
];
for (const [label, k, opts] of defs) {
  const b = document.createElement('button');
  const paint = (): void => {
    b.textContent = `${label}: ${st[k]}`;
    b.classList.toggle('on', ['On', 'Game', 'Walk', 'Work'].includes(st[k]));
  };
  b.onclick = () => {
    st[k] = opts[(opts.indexOf(st[k]) + 1) % opts.length]!;
    paint();
    if (k === 'zoom') frameView();
    if (k === 'quality') sizeAll();
    applyState();
  };
  paint();
  ui.append(b);
}
el('div', '', 'Crew Lab - drag to pan, pinch / scroll to zoom').id = 'cap';
const fpsEl = el('div');
fpsEl.id = 'fps';

// ---- camera input, like the game ---------------------------------------------------------------------------------
const ptrs = new Map<number, { x: number; y: number }>();
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  if (ptrs.size === 1) rig.pan(e.clientX - p.x, e.clientY - p.y);
  else if (ptrs.size === 2) {
    const o = [...ptrs.entries()].find(([id]) => id !== e.pointerId)![1];
    const before = Math.hypot(p.x - o.x, p.y - o.y);
    const after = Math.hypot(e.clientX - o.x, e.clientY - o.y);
    rig.zoomAt(after / Math.max(1, before), (e.clientX + o.x) / 2, (e.clientY + o.y) / 2);
    rig.pan((e.clientX - p.x) / 2, (e.clientY - p.y) / 2);
  }
  p.x = e.clientX;
  p.y = e.clientY;
});
const up = (e: PointerEvent): void => void ptrs.delete(e.pointerId);
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  rig.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
}, { passive: false });
window.addEventListener('resize', () => { sizeAll(); frameView(); });

sizeAll();
frameView();
applyState();

// ---- loop ----------------------------------------------------------------------------------------------------------
let last = performance.now(), acc = 0, frames = 0;
const tmp = new Vector3();
const WALK_R = 0.5;
function tick(now: number): void {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  acc += dt;
  frames++;
  if (acc > 0.5) {
    fpsEl.textContent = `${Math.round(frames / acc)} fps`;
    acc = 0;
    frames = 0;
  }
  const mode = st.anim.toLowerCase() as Mode;
  glow(0x19e6ff).color.setHex(0x19e6ff).multiplyScalar(1.45 + 0.25 * Math.sin(t * 3));
  for (const s of slots) {
    pose(s.crew, t + s.i * 0.7, mode);
    const r = s.crew.root;
    if (mode === 'walk') {
      const a = t * 1.9 + s.i * 1.3;
      r.position.set(s.home.x + WALK_R * Math.cos(a), 0, s.home.z + WALK_R * Math.sin(a));
      r.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
    } else {
      r.position.copy(s.home);
      r.rotation.y = Math.PI / 4 + (st.turn === 'On' ? t * 0.8 : 0);
    }
    if (mode === 'work' && Math.random() < 0.6) {
      s.crew.handL.getWorldPosition(tmp);
      sparks.emit(tmp);
    }
  }
  sparks.update(dt);
  env.view.update();
  applyToon(env.view.group, toon());
  const texel = rig.viewHeight() / (ch * pr);
  outline.configure(cw * pr, ch * pr, texel, Math.max(1, pr * 0.7));
  if (toon() || st.quality === 'High') composer.render();
  else renderer.render(scene, rig.camera);

  // floating labels
  const spacing = (1.7 * Math.SQRT1_2 * ch) / rig.viewHeight();
  for (const s of slots) {
    tmp.copy(s.crew.root.position).setY(1.75).project(rig.camera);
    s.label.style.left = `${((tmp.x + 1) / 2) * cw}px`;
    s.label.style.top = `${((1 - tmp.y) / 2) * ch}px`;
    s.label.classList.toggle('mini', spacing < 110);
  }
}
requestAnimationFrame(tick);
