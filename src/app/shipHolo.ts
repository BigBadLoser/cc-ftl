import { content } from '../content';
import { createRenderer, type Renderer } from '../render/scene';
import { ModuleC, ShipC, Sim, shipGrid } from '../sim';
import { startGalaxy } from '../sim/galaxy/travel';
import { spawnContact } from '../sim/galaxy/arrivals';
import type { Contact } from '../sim/galaxy/types';
import type { SceneShip } from '../sim/scene/types';
import type { UiHolo, UiHoloRequest } from '../ui/comms/types';
import type { ModuleDef } from '../sim';

const defs: Readonly<Record<string, ModuleDef>> = content.modules;

/**
 * A picture of a scene ship before it exists: the generator's ship for the scene's contact (the same `shipFor` path a spawn takes, so it is the very
 * hull that will appear when the player drops out), spawned into a throwaway sim, drawn by the real renderer on an offscreen canvas, and read back
 * cropped to its opaque pixels. The part anchors (weapon modules, shuttle bay or airlock) are projected through the same camera, as fractions of the
 * crop, so a UI can pin callouts on the picture. Nothing here touches the game's sim or renderer; the scratch sim and renderer are disposed after one shot.
 */

/** Offscreen canvas size in CSS px; the ship is fitted inside it. */
const W = 1100;
const H = 700;
/** The renderer's clear colour (render/scene.ts): pixels of exactly this colour are the background and become transparent. */
const BG = [0x07, 0x09, 0x0d] as const;
const MARGIN = 6;
const GAIN = 1.25;

const cache = new Map<string, UiHolo | null>();
let chain: Promise<unknown> = Promise.resolve();

/** The request for a scene ship (plain data, also the cache key). */
export function holoRequestOf(s: SceneShip): UiHoloRequest {
  const c = s.contact;
  return { faction: c.faction, shipgen: c.shipgen, seed: c.seed, depth: c.depth, ...(s.family ? { family: s.family } : {}) };
}

const keyOf = (r: UiHoloRequest): string => `${r.shipgen}:${r.seed}:${r.depth}`;

/** The hologram of a ship (cached; one at a time, as each makes a renderer). Null when it cannot be drawn. */
export function shipHolo(req: UiHoloRequest): Promise<UiHolo | null> {
  const key = keyOf(req);
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  const run = chain.then(() => draw(req).catch((): null => null)).then((h) => (cache.set(key, h), h));
  chain = run.catch(() => null);
  return run;
}

/** Which modules a callout points at, as module centres in sector tiles (the first of each kind, in id order, so it is stable). */
function anchorsOf(sim: Sim, shipId: number): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  const centre = (m: { x: number; y: number }, def: string): { x: number; y: number } => {
    const [w, h] = defs[def]?.footprint ?? [1, 1];
    return { x: m.x + (w - 1) / 2, y: m.y + (h - 1) / 2 };
  };
  let airlock: { x: number; y: number } | undefined;
  const ship = sim.world.get(shipId, ShipC);
  if (!ship) return out;
  for (const id of [...sim.world.query(ModuleC)].sort((a, b) => a - b)) {
    const m = sim.world.get(id, ModuleC);
    const d = m && defs[m.def];
    if (!m || !d) continue;
    const inShip = m.x >= ship.x && m.y >= ship.y && m.x < ship.x + ship.width && m.y < ship.y + ship.height;
    if (!inShip) continue;
    if (d.weapon && !out['weapons']) out['weapons'] = centre(m, m.def);
    if (d.vehicleBay?.class === 'shuttle' && !out['boarding']) out['boarding'] = centre(m, m.def);
    if (d.airlock && !airlock) airlock = centre(m, m.def);
  }
  if (!out['boarding'] && airlock) out['boarding'] = airlock;
  return out;
}

async function draw(req: UiHoloRequest): Promise<UiHolo | null> {
  // An empty sim with a galaxy: no home ship in the frame, nothing of the game's own.
  const sim = new Sim(req.seed, content);
  startGalaxy(sim);
  const node = sim.galaxy.current;
  const contact: Contact = { id: 1, faction: req.faction, shipgen: req.shipgen, seed: req.seed, depth: req.depth, since: 0 };
  if (!spawnContact(sim, node, contact, { crew: 0 }) || contact.ship === undefined) return null;
  const id = contact.ship;
  const grid = shipGrid(sim, id);
  if (!grid) return null;
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;height:${H}px;pointer-events:none`;
  const canvas = document.createElement('canvas');
  // A stylesheet rule, not inline style: the renderer's resize() clears the canvas's inline size before it measures.
  canvas.className = 'holo-canvas';
  if (!document.getElementById('holo-canvas-css')) {
    const st = document.createElement('style');
    st.id = 'holo-canvas-css';
    st.textContent = `.holo-canvas{width:${W}px;height:${H}px;display:block}`;
    document.head.appendChild(st);
  }
  host.appendChild(canvas);
  document.body.appendChild(host);
  let r: Renderer | null = null;
  try {
    r = await createRenderer(canvas, 'high', sim.world, content);
    r.setSector(sim.sector.grid);
    r.showBackdrop(false);
    r.setGrid(grid);
    r.resize();
    r.frameShips([id]);
    const pump = (): void => { r?.render(0); };
    let raf = 0;
    const loop = (): void => { pump(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    await r.whenArtReady();
    await new Promise((res) => setTimeout(res, 800)); // roof and module sheets that stream in just after the hull
    await r.whenArtReady();
    cancelAnimationFrame(raf);
    pump();
    pump();
    const shot = document.createElement('canvas');
    shot.width = canvas.width;
    shot.height = canvas.height;
    const g = shot.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(canvas, 0, 0);
    const scale = canvas.width / Math.max(1, canvas.clientWidth);
    const img = g.getImageData(0, 0, shot.width, shot.height);
    const px = img.data;
    let x0 = shot.width, y0 = shot.height, x1 = -1, y1 = -1;
    for (let y = 0; y < shot.height; y++) {
      for (let x = 0; x < shot.width; x++) {
        const i = (y * shot.width + x) * 4;
        if (Math.abs(px[i]! - BG[0]) < 3 && Math.abs(px[i + 1]! - BG[1]) < 3 && Math.abs(px[i + 2]! - BG[2]) < 3) { px[i + 3] = 0; continue; }
        // The scratch ship is unlit, so the art reads dark: lift it (the hologram filter in the UI takes it from there).
        px[i] = Math.min(255, px[i]! * GAIN);
        px[i + 1] = Math.min(255, px[i + 1]! * GAIN);
        px[i + 2] = Math.min(255, px[i + 2]! * GAIN);
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return null;
    x0 = Math.max(0, x0 - MARGIN); y0 = Math.max(0, y0 - MARGIN); x1 = Math.min(shot.width - 1, x1 + MARGIN); y1 = Math.min(shot.height - 1, y1 + MARGIN);
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    g.putImageData(img, 0, 0);
    const crop = document.createElement('canvas');
    crop.width = w;
    crop.height = h;
    crop.getContext('2d')?.drawImage(shot, x0, y0, w, h, 0, 0, w, h);
    const anchors: UiHolo['anchors'] = {};
    for (const [k, t] of Object.entries(anchorsOf(sim, id))) {
      const p = r.screenOf(id, t.x, t.y);
      anchors[k] = { x: (p.x * scale - x0) / w, y: (p.y * scale - y0) / h };
    }
    return { url: crop.toDataURL('image/png'), w, h, anchors };
  } finally {
    r?.dispose();
    host.remove();
  }
}
