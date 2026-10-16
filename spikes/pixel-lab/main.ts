import { Application, BlurFilter, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import envMeta from '@sprites/env.json';
import engMeta from '@sprites/engineer.json';
import envQO from '@sprites/env.qo.png?inline';
import envQN from '@sprites/env.qn.png?inline';
import envRO from '@sprites/env.ro.png?inline';
import envRN from '@sprites/env.rn.png?inline';
import envGlowUrl from '@sprites/env.glow.png?inline';
import engQO from '@sprites/engineer.qo.png?inline';
import engQN from '@sprites/engineer.qn.png?inline';
import engRO from '@sprites/engineer.ro.png?inline';
import engRN from '@sprites/engineer.rn.png?inline';
import engGlowUrl from '@sprites/engineer.glow.png?inline';

const TW = 64, TH = 32;            // tile diamond in art pixels at 1x
const COLS = 12, ROWS = 8;
type V = 'qo' | 'qn' | 'ro' | 'rn';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function load(url: string): Promise<Texture> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const t = Texture.from(img);
  t.source.scaleMode = 'nearest';
  t.source.autoGenerateMipmaps = false;
  return t;
}
const sub = (base: Texture, x: number, y: number, w: number, h: number) =>
  new Texture({ source: base.source, frame: new Rectangle(x, y, w, h) });

// tile (gx,gy) centre at floor level -> art px
const iso = (gx: number, gy: number) => ({ x: (gx - gy) * (TW / 2), y: (gx + gy) * (TH / 2) });

const state = { zoom: 2, power: true, blur: false, outline: true, quant: true };
const variant = (): V => ((state.quant ? 'q' : 'r') + (state.outline ? 'o' : 'n')) as V;

async function main() {
  const app = new Application();
  const dpr = window.devicePixelRatio || 1;
  const physW = () => Math.round(window.innerWidth * dpr), physH = () => Math.round(window.innerHeight * dpr);
  await app.init({ width: physW(), height: physH(), background: 0x080a0f, antialias: false, resolution: 1, autoDensity: false, roundPixels: true, preference: 'webgl' });
  $('stage').appendChild(app.canvas);
  const fit = () => {
    app.renderer.resize(physW(), physH());
    app.canvas.style.width = window.innerWidth + 'px';
    app.canvas.style.height = window.innerHeight + 'px';
  };
  fit();

  // ---- textures --------------------------------------------------------------------------------------------
  const envBase: Record<V, Texture> = { qo: await load(envQO), qn: await load(envQN), ro: await load(envRO), rn: await load(envRN) };
  const engBase: Record<V, Texture> = { qo: await load(engQO), qn: await load(engQN), ro: await load(engRO), rn: await load(engRN) };
  const envGlowBase = await load(envGlowUrl), engGlowBase = await load(engGlowUrl);
  const VS: V[] = ['qo', 'qn', 'ro', 'rn'];
  interface Env { meta: any; tex: Record<V, Texture>; glow: Texture | null }
  const env: Record<string, Env> = {};
  for (const m of (envMeta as any).sprites) {
    const tex = {} as Record<V, Texture>;
    for (const v of VS) tex[v] = sub(envBase[v], m.x, m.y, m.w, m.h);
    env[m.id] = { meta: m, tex, glow: m.glow ? sub(envGlowBase, m.x, m.y, m.w, m.h) : null };
  }
  const [cw, ch] = (engMeta as any).cell as number[];
  const [eax, eay] = (engMeta as any).anchor as number[];
  const clips = (engMeta as any).clips as Record<string, { start: number; count: number; fps: number }>;
  const engTex = {} as Record<V, Texture[][]>;
  for (const v of VS) engTex[v] = (engMeta as any).dirs.map((_: string, d: number) => Array.from({ length: (engMeta as any).cols }, (_, c) => sub(engBase[v], c * cw, d * ch, cw, ch)));
  const engGlow: Texture[][] = (engMeta as any).dirs.map((_: string, d: number) => Array.from({ length: (engMeta as any).cols }, (_, c) => sub(engGlowBase, c * cw, d * ch, cw, ch)));

  // ---- scene -----------------------------------------------------------------------------------------------
  const world = new Container();
  const floorLayer = new Container(), poolLayer = new Container(), sorted = new Container(), bloom = new Container();
  sorted.sortableChildren = true;
  poolLayer.blendMode = 'add';
  world.addChild(floorLayer, poolLayer, sorted, bloom);
  app.stage.addChild(world);
  const blurF = new BlurFilter({ strength: 5, quality: 3 });
  bloom.filters = [blurF];
  bloom.blendMode = 'add';
  bloom.visible = false;

  interface Item { spr: Sprite; e: Env; glow?: Sprite; halo?: Sprite; emerg: boolean; cx: number; cy: number }
  const items: Item[] = [];
  const envTinted: Sprite[] = [];

  function place(id: string, gx: number, gy: number, key: number, parent: Container = sorted, emergOverride?: boolean): Item {
    const e = env[id];
    const p = iso(gx, gy);
    const spr = new Sprite(e.tex[variant()]);
    spr.x = p.x - e.meta.ax; spr.y = p.y - e.meta.ay;
    spr.zIndex = key;
    parent.addChild(spr);
    envTinted.push(spr);
    const it: Item = { spr, e, emerg: emergOverride ?? id.startsWith('emerg'), cx: gx, cy: gy };
    if (e.glow) {
      const g = new Sprite(e.glow);
      g.blendMode = 'add'; g.x = spr.x; g.y = spr.y; g.zIndex = key + 0.01;
      parent.addChild(g);
      const h = new Sprite(e.glow);
      h.x = spr.x; h.y = spr.y; h.alpha = 0.9;
      bloom.addChild(h);
      it.glow = g; it.halo = h;
    }
    items.push(it);
    return it;
  }

  // floor
  for (let gy = 0; gy < ROWS; gy++) for (let gx = 0; gx < COLS; gx++) {
    const id = ['floor_a', 'floor_b', 'floor_a', 'floor_a', 'floor_c'][(gx * 7 + gy * 13 + ((gx ^ gy) & 3)) % 5];
    place(id, gx, gy, 0, floorLayer);
  }
  // pool textures: banded ellipse (hard pixel steps), tinted per use
  function poolTex(): Texture {
    const c = document.createElement('canvas'); c.width = 64; c.height = 32;
    const g = c.getContext('2d')!;
    const img = g.createImageData(64, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
      const d = Math.hypot((x - 31.5) / 32, (y - 15.5) / 16);
      const band = d < 0.3 ? 4 : d < 0.55 ? 3 : d < 0.78 ? 2 : d < 1 ? 1 : 0;
      const i = (y * 64 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = band * 22;
    }
    g.putImageData(img, 0, 0);
    const t = Texture.from(c); t.source.scaleMode = 'nearest'; return t;
  }
  const pt = poolTex();
  const pools: { s: Sprite; red: boolean }[] = [];
  const pool = (gx: number, gy: number, red: boolean) => {
    const s = new Sprite(pt); const p = iso(gx, gy);
    s.anchor.set(0.5); s.scale.set(3); s.x = p.x; s.y = p.y; s.tint = red ? 0xff2030 : 0x9fe8ff;
    poolLayer.addChild(s); pools.push({ s, red });
  };

  // walls: back (north/west) full height, front (south/east) cut away low
  const northIds = ['wall_x', 'wall_light_x', 'wall_x', 'wall_x', 'door_x', 'wall_x', 'wall_light_x', 'emerg_light_x', 'hull_x', 'hull_x', 'hull_x', 'hull_x'];
  const westIds = ['wall_y', 'wall_y', 'wall_light_y', 'wall_y', 'emerg_light_y', 'wall_y', 'hull_y', 'hull_y'];
  northIds.forEach((id, gx) => { place(id, gx, 0, gx + 0 - 0.2); });
  westIds.forEach((id, gy) => { place(id, 0, gy, gy - 0.2); });
  northIds.forEach((id, gx) => { if (id.startsWith('wall_light')) pool(gx, 1.2, false); if (id.startsWith('emerg')) pool(gx, 1.2, true); });
  westIds.forEach((id, gy) => { if (id.startsWith('wall_light')) pool(1.2, gy, false); if (id.startsWith('emerg')) pool(1.2, gy, true); });
  for (let gx = 0; gx < COLS; gx++) place('wall_low_x', gx, ROWS, gx + ROWS - 0.2);
  for (let gy = 0; gy < ROWS; gy++) place('wall_low_y', COLS, gy, COLS + gy - 0.2);

  // props
  place('console', 2, 1, 3);
  place('reactor', 10, 3, 12.6);
  place('crates', 1, 5, 6);
  place('crates', 11, 7, 18 - 0.3);

  // ---- crew ------------------------------------------------------------------------------------------------
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = 22; c.height = 11;
    const g = c.getContext('2d')!; const img = g.createImageData(22, 11);
    for (let y = 0; y < 11; y++) for (let x = 0; x < 22; x++) {
      const d = Math.hypot((x - 10.5) / 11, (y - 5) / 5.5);
      img.data[(y * 22 + x) * 4 + 3] = d < 1 ? (d < 0.62 ? 120 : 70) : 0;
    }
    g.putImageData(img, 0, 0);
    const t = Texture.from(c); t.source.scaleMode = 'nearest'; return t;
  })();
  const crewTinted: Sprite[] = [];
  interface Crew { spr: Sprite; glow: Sprite; halo: Sprite; sh: Sprite; x: number; y: number; path: [number, number][]; seg: number; dir: number; speed: number; work: boolean; t: number; off: number }
  const crew: Crew[] = [];
  const addCrew = (path: [number, number][], speed: number, work = false, dir = 0, off = 0) => {
    const spr = new Sprite(engTex[variant()][0][0]);
    const glow = new Sprite(engGlow[0][0]); glow.blendMode = 'add';
    const halo = new Sprite(engGlow[0][0]); bloom.addChild(halo);
    const sh = new Sprite(shadowTex); sh.anchor.set(0.5, 0.5);
    sorted.addChild(sh, spr, glow);
    crewTinted.push(spr);
    crew.push({ spr, glow, halo, sh, x: path[0][0], y: path[0][1], path, seg: 0, dir, speed, work, t: off, off });
  };
  const loop = (pts: [number, number][]) => pts;
  addCrew(loop([[3, 3.2], [7.2, 3.2], [7.2, 6.2], [3, 6.2]]), 1.3);                       // clockwise loop
  addCrew(loop([[6.5, 6.5], [6.5, 2.2], [3.5, 2.2], [3.5, 6.5]]), 1.1, false, 0, 0.4);     // counter-clockwise
  addCrew(loop([[2.2, 6.8], [8.2, 4.6], [2.2, 6.8], [4.8, 3.0], [8.4, 6.6]]), 1.5, false, 0, 0.2); // diagonals
  addCrew([[2, 1.9]], 0, true, 5);                                                          // works at the console (faces NE)
  const dirIdx = (dx: number, dy: number) => { const a = Math.atan2(dy, dx) * 180 / Math.PI; return (((Math.round((a - 45) / 45)) % 8) + 8) % 8; };

  // ---- camera / input --------------------------------------------------------------------------------------
  let P = state.zoom * Math.max(1, Math.round(dpr));       // physical px per art px (integer)
  const centreArt = iso(COLS / 2 - 0.5, ROWS / 2 - 0.5 + 0.2);
  let pos = { x: 0, y: 0 };
  const apply = () => { world.scale.set(P); world.x = Math.round(pos.x); world.y = Math.round(pos.y); };
  const centreOn = (ax: number, ay: number) => { pos = { x: Math.round(physW() / 2 - ax * P), y: Math.round(physH() / 2 - ay * P) }; apply(); };
  centreOn(centreArt.x, centreArt.y - 6);
  function setZoom(z: number) {
    z = Math.max(1, Math.min(2, z));
    if (z === state.zoom) return;
    const cx = (physW() / 2 - pos.x) / P, cy = (physH() / 2 - pos.y) / P;
    state.zoom = z; P = z * Math.max(1, Math.round(dpr));
    centreOn(cx, cy); refreshUi();
  }
  const cv = app.canvas;
  const ptrs = new Map<number, { x: number; y: number }>();
  let pinch0 = 0;
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
  cv.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    if (ptrs.size === 1) { pos.x += (e.clientX - p.x) * dpr; pos.y += (e.clientY - p.y) * dpr; apply(); }
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (d > pinch0 * 1.3) { setZoom(state.zoom + 1); pinch0 = d; } else if (d < pinch0 / 1.3) { setZoom(state.zoom - 1); pinch0 = d; } }
  });
  const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(state.zoom + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
  window.addEventListener('resize', () => { fit(); apply(); });

  // ---- toggles ---------------------------------------------------------------------------------------------
  function refreshUi() {
    document.querySelectorAll<HTMLElement>('[data-zoom]').forEach((b) => b.classList.toggle('on', +b.dataset.zoom! === state.zoom));
    $('power').classList.toggle('on', state.power); $('power').textContent = state.power ? 'Power On' : 'Power Off';
    $('blur').classList.toggle('on', state.blur); $('outline').classList.toggle('on', state.outline); $('quant').classList.toggle('on', state.quant);
    bloom.visible = state.blur;
    for (const it of items) it.spr.texture = it.e.tex[variant()];
    $('info').textContent = `art ${P / Math.max(1, Math.round(dpr))}x | ${P} device px per art px | dpr ${dpr} | ${variant()}`;
  }
  document.querySelectorAll<HTMLElement>('[data-zoom]').forEach((b) => b.addEventListener('click', () => setZoom(+b.dataset.zoom!)));
  $('power').onclick = () => { state.power = !state.power; refreshUi(); };
  $('blur').onclick = () => { state.blur = !state.blur; refreshUi(); };
  $('outline').onclick = () => { state.outline = !state.outline; refreshUi(); };
  $('quant').onclick = () => { state.quant = !state.quant; refreshUi(); };
  refreshUi();
  (window as any).__lab = { state, setZoom, refreshUi, centreOn, iso };

  // ---- loop ------------------------------------------------------------------------------------------------
  let time = 0, fpsAcc = 0, fpsN = 0;
  app.ticker.add((tk) => {
    const dt = Math.min(tk.deltaMS / 1000, 0.1);
    time += dt;
    const on = state.power;
    const tintE = on ? 0xffffff : 0x4b5b78, tintC = on ? 0xffffff : 0x8493ad;
    for (const s of envTinted) s.tint = tintE;
    for (const s of crewTinted) s.tint = tintC;
    const pulse = 0.55 + 0.45 * Math.sin(time * 4);
    for (const it of items) {
      if (!it.glow) continue;
      const vis = on ? !it.emerg : it.emerg;
      it.glow.visible = vis; it.halo!.visible = vis;
      it.glow.alpha = it.emerg ? pulse : 1; it.halo!.alpha = it.emerg ? pulse : 0.9;
    }
    for (const p of pools) { p.s.visible = p.red ? !on : on; p.s.alpha = p.red ? pulse : 1; }
    poolLayer.alpha = 1;
    const v = variant();
    for (const c of crew) {
      let clip = 'idle';
      if (c.work) clip = 'work';
      else if (c.path.length > 1) {
        clip = 'walk';
        const a = c.path[c.seg], b = c.path[(c.seg + 1) % c.path.length];
        const dx = b[0] - c.x, dy = b[1] - c.y, d = Math.hypot(dx, dy), step = c.speed * dt;
        if (d <= step) { c.x = b[0]; c.y = b[1]; c.seg = (c.seg + 1) % c.path.length; }
        else { c.x += dx / d * step; c.y += dy / d * step; c.dir = dirIdx(dx, dy); }
        void a;
      }
      c.t += dt;
      const k = clips[clip];
      const col = k.start + (Math.floor(c.t * k.fps) % k.count);
      const p = iso(c.x, c.y);
      const sx = Math.round(p.x - eax), sy = Math.round(p.y - eay);
      c.spr.texture = engTex[v][c.dir][col];
      c.spr.x = sx; c.spr.y = sy;
      const key = c.x + c.y;
      c.spr.zIndex = key; c.glow.zIndex = key + 0.01; c.sh.zIndex = key - 0.01;
      c.glow.texture = engGlow[c.dir][col]; c.glow.x = sx; c.glow.y = sy;
      c.halo.texture = engGlow[c.dir][col]; c.halo.x = sx; c.halo.y = sy;
      c.sh.x = Math.round(p.x); c.sh.y = Math.round(p.y);
    }
    fpsAcc += tk.deltaMS; fpsN++;
    if (fpsAcc > 500) { $('fps').textContent = Math.round(fpsN * 1000 / fpsAcc) + ' fps'; fpsAcc = 0; fpsN = 0; }
  });
}
main();
