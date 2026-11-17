import { Container, Sprite } from 'pixi.js';
import type { Atlas } from '../../src/render/assets/loader';
import type { ClipDef } from '../../src/render/assets/manifest';
import { artZoom, createCrewFilter, crewFilters, crewPalette, setFilterTint, setFilterZoom } from '../../src/render/assets/palette';
import { drawLayers } from '../../src/render/crewSprites';
import { lightTint } from '../../src/render/lightTint';
import { crewLoadout, preloadLayers } from '../../src/render/loadout';
import { tubePieces, type TubeLook } from '../../src/render/tubeArt';
import type { WallLevel } from '../../src/render/tiles';
import type { TubeRun } from '../../src/sim/tube';
import type { LabCell, LabPanel } from './panel';

const TW = 64;
const TH = 32;
const PAD = 16;
const TALL = 140;                                      // headroom over the run for the hull row and ports, px

/** Draw the first existing sprite of `ids`, with its glow, anchored at (ox, oy). */
function put(root: Container, atlas: Atlas, id: string, ox: number, oy: number): void {
  const s = atlas.stat(id);
  if (!s) return;
  const x = Math.round(ox - s.ax);
  const y = Math.round(oy - s.ay);
  root.addChild(Object.assign(new Sprite(s.tex), { x, y }));
  if (s.glow) {
    const g = Object.assign(new Sprite(s.glow), { x, y });
    g.blendMode = 'add';
    root.addChild(g);
  }
}

/** A run of `len` floor tiles along `axis` from (2, 2), its far door at (1, 2) or (2, 1). */
const run = (axis: 'x' | 'y', len: number): TubeRun => {
  const dx = axis === 'x' ? 1 : 0, dy = 1 - dx;
  return { axis, x: 2, y: 2, len, far: { x: 2 - dx, y: 2 - dy }, near: { x: 2 + dx * len, y: 2 + dy * len } };
};

const CLIP = 'idle';
/** Crew stood along a run (tiles from its first floor tile): inside it, across the seams, at its near end and either side of the near door's middle. */
const STAND = [0, 0.45, 0.55, 1.3, 2.4, 2.8, 3.4];

type Look = ReturnType<typeof crewLoadout>;

/** A crew member at (x, y) (continuous tiles), drawn as the game does: the loadout's layers through the crew filter. */
function figure(root: Container, atlas: Atlas, look: Look, seed: number, at: { x: number; y: number }, zoom: number) {
  const body = new Container();
  const filter = createCrewFilter(atlas.manifest.keyColors, crewPalette(seed));
  const z = artZoom(zoom * devicePixelRatio);
  body.filters = crewFilters(filter, z);
  setFilterTint(filter, lightTint(255, false, -1));
  setFilterZoom(filter, z);
  const parts = look.map((layer) => { const s = new Sprite(); body.addChild(s); return { layer, sprite: s }; });
  body.position.set(Math.round(at.x), Math.round(at.y));
  root.addChild(body);
  return parts;
}

/**
 * Ground under the patch, then the run's pieces (tubeArt.tubePieces) and any crew in the game's depth order: tile depth plus the
 * piece's `dz`, a crew member's at their position. Returns the crew's layers.
 */
function scene(root: Container, atlas: Atlas, r: TubeRun, look: TubeLook, ox: number, oy: number, w: number, h: number, crew?: { look: Look; zoom: number; at: number[] }) {
  const sx = (x: number, y: number) => ox + ((x - y) * TW) / 2;
  const sy = (x: number, y: number) => oy + ((x + y) * TH) / 2;
  for (let d = 0; d <= w + h - 2; d++) for (let x = 0; x < w; x++) if (d - x >= 0 && d - x < h) put(root, atlas, `rock.ground.m15.v${(x * 5 + (d - x) * 3) % 8}`, sx(x, d - x), sy(x, d - x));
  const dx = r.axis === 'x' ? 1 : 0, dy = 1 - dx;
  const items = [
    ...tubePieces(r, look).map((p) => ({ d: p.x + p.y + p.dz, draw: () => { put(root, atlas, p.id, sx(p.x, p.y), sy(p.x, p.y)); return undefined; } })),
    ...(crew ? crew.at.filter((k) => k < r.len + 0.5) : []).map((k, n) => {
      const x = r.x + dx * k, y = r.y + dy * k;
      return { d: x + y, draw: () => figure(root, atlas, crew!.look, 11 * (n + 1), { x: sx(x, y), y: sy(x, y) }, crew!.zoom) };
    }),
  ].map((q, i) => ({ ...q, i })).sort((a, b) => a.d - b.d || a.i - b.i);
  return items.map((q) => q.draw()).filter((q) => !!q);
}

/**
 * `?panel=tube`: the prefab base tube (#508) as tubeArt picks its sprites, on asteroid ground with no module walls round it:
 * x and y runs one, three and five tiles long with both doors shut and both open, at each wall view level, and roofed (the
 * hull row full height, no junction). The hull row is unpainted here (the game paints it with the hull's colours).
 */
export const tubePanel: LabPanel = {
  id: 'tube',
  title: 'Prefab base tube',
  zoom: 1,
  help: 'crew=1: only x and y runs three long, cut and roofed, with crew stood along them and in the near door (stand=0,1.5: where, tiles from the first)',
  async cells({ atlas, params }) {
    for (const p of ['tube.', 'rock.ground.m15']) atlas.ids(p).forEach((id) => atlas.stat(id)); // queue the sheets
    const crewOn = params.get('crew') === '1';
    const crewLook = crewLoadout(atlas, { species: 'species.human', role: 'role.engineer', appearanceSeed: 11 } as never);
    if (crewOn) {
      preloadLayers(crewLook);
      for (const l of crewLook) if (l.def.clips[CLIP]) l.request(l.def.clips[CLIP] as ClipDef, true);
    }
    await atlas.whenIdle();
    const cells: LabCell[] = [];
    if (crewOn) {
      const zoom = Number(params.get('zoom') ?? 1);
      const at = params.get('stand')?.split(',').map(Number).filter((k) => Number.isFinite(k)) ?? STAND;
      for (const axis of ['x', 'y'] as const)
        for (const [name, look] of [['cut', { level: 'cut', roofed: false, farOpen: true, nearOpen: true }], ['roofed', { level: 'up', roofed: true, farOpen: true, nearOpen: true }]] as [string, TubeLook][]) {
          const r = run(axis, 3);
          const w = axis === 'x' ? 7 : 5, h = axis === 'y' ? 7 : 5;
          cells.push({
            label: `${axis} 3: ${name}, crew`, note: `crew at ${at.join(', ')} tiles along`, w: ((w + h) * TW) / 2 + PAD * 2, h: ((w + h) * TH) / 2 + TALL + PAD * 2, newRow: name === 'cut',
            mount(root) {
              const figs = scene(root, atlas, r, look, PAD + (h * TW) / 2, PAD + TALL + TH / 2, w, h, { look: crewLook, zoom, at });
              return (t) => { for (const parts of figs) drawLayers({ parts, glows: [] }, CLIP, 2, t); };
            },
          });
        }
      return cells;
    }
    const looks: [string, TubeLook][] = [
      ['shut, cut', { level: 'cut', roofed: false, farOpen: false, nearOpen: false }],
      ['open, cut', { level: 'cut', roofed: false, farOpen: true, nearOpen: true }],
      ...(['up', 'low'] as WallLevel[]).map((level): [string, TubeLook] => [`shut, ${level}`, { level, roofed: false, farOpen: false, nearOpen: false }]),
      ['roofed', { level: 'up', roofed: true, farOpen: false, nearOpen: false }],
    ];
    for (const axis of ['x', 'y'] as const)
      for (const len of [1, 3, 5])
        looks.forEach(([name, look], i) => {
          const r = run(axis, len);
          const w = axis === 'x' ? len + 4 : 5, h = axis === 'y' ? len + 4 : 5;
          const cw = ((w + h) * TW) / 2 + PAD * 2, ch = ((w + h) * TH) / 2 + TALL + PAD * 2;
          cells.push({
            label: `${axis} ${len}: ${name}`, note: `far door ${r.far.x},${r.far.y}, near ${r.near.x},${r.near.y}`, w: cw, h: ch, newRow: i === 0,
            mount(root) { scene(root, atlas, r, look, PAD + (h * TW) / 2, PAD + TALL + TH / 2, w, h); return () => {}; },
          });
        });
    return cells;
  },
};
