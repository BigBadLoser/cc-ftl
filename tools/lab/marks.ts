import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { Atlas } from '../../src/render/assets/loader';
import { artZoom, createCrewFilter, crewFilters, crewPalette, setFilterTint, setFilterZoom } from '../../src/render/assets/palette';
import { MARK_HEAD } from '../../src/render/crewMarks';
import { drawLayers } from '../../src/render/crewSprites';
import { ART_SCALE as S, iso } from '../../src/render/iso';
import { lightTint } from '../../src/render/lightTint';
import { crewLoadout, preloadLayers } from '../../src/render/loadout';
import type { LabCell, LabCtx, LabPanel } from './panel';

/**
 * `?panel=marks`: the overhead crew icons (`crew.mark.*`, #239 social cues and #175 break symbols). Every icon's frames at 1x and 3x (one art px
 * per device px in a 2x shot at the default zoom 0.5), every break in its bubble at the three tiers, then each icon over a real crew figure (the
 * game's loadout and crew filter) on a lit floor and on a dark one, at game scale (two device px per art px), and a shouting pair facing each other.
 *   &src=/.cache/marks-preview/   where to read marks.png + marks.json when the manifest has no `crew.mark.*` (tools/blender/review/marks_preview.py;
 *                                 &preview=1 reads it even when it has, to try a change before `npm run sprites -- -- public/assets/1x marks`)
 */
const SOCIAL = ['chat', 'chatBad', 'shout'];
const BREAKS = ['panic', 'freeze', 'hide', 'tantrum', 'despair', 'refusal', 'isolation'];
const FIGHT = ['downed', 'surrendered'];
const TIERS = ['mild', 'moderate', 'severe'];
/** Where an icon's bottom sits over a standing figure (the game's spot, crewMarks.ts). */
const HEAD = MARK_HEAD;

type Frames = (id: string) => Texture[];

/**
 * The icon frames: from the manifest when the sheet is built, else from the preview sheet. `unit` scales a frame to one art px per k:
 * manifest frames are composed to world px already (two per art px).
 */
async function frames(atlas: Atlas, src: string, preview: boolean): Promise<{ get: Frames; fps: number; unit: number }> {
  if (atlas.ids('crew.mark.').length && !preview) {
    atlas.stat('crew.mark.chat.0');
    await atlas.whenIdle();
    const get: Frames = (id) => atlas.ids(`${id}.`).map((x) => atlas.stat(x)).filter((t) => !!t).map((t) => new Texture({ source: t.tex.source, frame: t.tex.frame, defaultAnchor: { x: t.ax / t.tex.width, y: t.ay / t.tex.height } }));
    return { fps: 4, unit: 1 / S, get };
  }
  const j = await (await fetch(`${src}marks.json`)).json() as { fps: number; frames: Record<string, { x: number; y: number; w: number; h: number; ax: number; ay: number }> };
  const sheet = await Assets.load<Texture>(`${src}marks.png?t=${Date.now()}`);
  sheet.source.scaleMode = 'nearest';
  const tex = new Map<string, Texture>();
  for (const [id, f] of Object.entries(j.frames)) {
    tex.set(id, new Texture({ source: sheet.source, frame: new Rectangle(f.x, f.y, f.w, f.h), defaultAnchor: { x: f.ax / f.w, y: f.ay / f.h } }));
  }
  return {
    fps: j.fps,
    unit: 1,
    get: (id) => (tex.has(id) ? [tex.get(id) as Texture] : [...tex.keys()].filter((k) => k.startsWith(`${id}.`)).map((k) => tex.get(k) as Texture)),
  };
}

/** An icon as a container whose anchor (its bottom centre with `centred`) is its origin; `set(t)` picks the frame. */
function icon(get: Frames, fps: number, unit: number, id: string, k: number, flip = false, centred = false): { node: Container; set: (t: number) => void } {
  const node = new Container();
  const fr = get(id);
  const s = new Sprite(fr[0] ?? Texture.EMPTY);
  s.anchor.copyFrom(!centred && fr[0]?.defaultAnchor ? fr[0].defaultAnchor : { x: 0.5, y: 1 }); // the grids centre each frame; scenes use its anchor
  s.scale.set(k * unit * (flip ? -1 : 1), k * unit);
  node.addChild(s);
  return { node, set: (t) => { if (fr.length) s.texture = fr[Math.floor(t * fps) % fr.length] as Texture; } };
}

const ID = (k: string, tier = 'moderate') => (BREAKS.includes(k) ? `crew.mark.break.${k}.${tier}` : `crew.mark.${k}`);
const F = 32;
const ALL = [...SOCIAL, ...BREAKS, ...FIGHT];

/** A small floor of 3 x 3 tiles, lit or dark, with crew standing on it; returns the root and the feet points. */
function scene(ctx: LabCtx, root: Container, cx: number, cy: number, dark: boolean, crew: { gx: number; gy: number; dir: number; seed: number; role: string }[]): { x: number; y: number }[] {
  const tint = lightTint(dark ? 18 : 255, false, -1);
  const floor = ctx.atlas.stat('tile.floor.a');
  for (let gy = -1; gy <= 1; gy++) {
    for (let gx = -1; gx <= 1; gx++) {
      if (!floor) continue;
      const p = iso(gx, gy);
      const s = new Sprite(floor.tex);
      s.position.set(cx + p.x - floor.ax, cy + p.y - floor.ay);
      s.tint = tint;
      root.addChild(s);
    }
  }
  return crew.map((c) => {
    const p = iso(c.gx, c.gy);
    const at = { x: cx + p.x, y: cy + p.y };
    const layers = crewLoadout(ctx.atlas, { species: 'species.human', role: c.role, appearanceSeed: c.seed } as never);
    const body = new Container();
    const filter = createCrewFilter(ctx.atlas.manifest.keyColors, crewPalette(c.seed));
    const z = artZoom(Number(ctx.params.get('zoom') ?? 0.5) * devicePixelRatio);
    body.filters = crewFilters(filter, z);
    setFilterTint(filter, tint);
    setFilterZoom(filter, z);
    const parts = layers.map((layer) => {
      const sprite = new Sprite();
      body.addChild(sprite);
      return { layer, sprite };
    });
    drawLayers({ parts, glows: [] }, 'idle', c.dir, 0);
    body.position.set(at.x, at.y);
    root.addChild(body);
    return at;
  });
}

export const marksPanel: LabPanel = {
  id: 'marks',
  title: 'Overhead crew icons',
  zoom: 0.5,
  help: 'crew.mark.*: every icon at 1x and 3x, every break at the three tiers, each over a crew figure on a lit and a dark floor; src=/.cache/marks-preview/',
  async cells(ctx) {
    const { get, fps, unit } = await frames(ctx.atlas, ctx.params.get('src') ?? '/.cache/marks-preview/', ctx.params.has('preview'));
    for (const seed of [11, 22, 33]) for (const role of ['role.engineer', 'role.gunner', 'role.medic']) preloadLayers(crewLoadout(ctx.atlas, { species: 'species.human', role, appearanceSeed: seed } as never));
    ctx.atlas.stat('tile.floor.a');
    await ctx.atlas.whenIdle();
    const cells: LabCell[] = [];
    // every icon, its frames side by side, at 1x then 3x (a break in its moderate bubble)
    for (const [k, tag] of [[1, '1x'], [3, '3x']] as const) {
      ALL.forEach((name, i) => {
        const n = Math.max(1, get(ID(name)).length);
        cells.push({
          label: name,
          note: `${tag} · ${n} frame${n > 1 ? 's' : ''}`,
          w: Math.max((n * (F + 2) + 2) * k, 200),
          h: (F + 4) * k,
          newRow: i === 0,
          mount(root) {
            for (let f = 0; f < n; f++) {
              const ic = icon(get, fps, unit, ID(name), k, false, true);
              ic.node.position.set((f * (F + 2) + F / 2 + 2) * k, (F + 2) * k);
              ic.set(f / fps + 0.01);
              root.addChild(ic.node);
            }
            return () => {};
          },
        });
      });
    }
    // every break at the three tiers, 3x
    cells.push({
      label: 'breaks: mild, moderate, severe',
      note: '3x',
      w: BREAKS.length * 3 * (F + 2) * 3 + BREAKS.length * 16,
      h: (F + 4) * 3,
      newRow: true,
      loop: 1,
      mount(root) {
        const sets: ((t: number) => void)[] = [];
        BREAKS.forEach((k, a) => TIERS.forEach((t, b) => {
          const ic = icon(get, fps, unit, ID(k, t), 3, false, true);
          ic.node.position.set(((a * 3 + b) * (F + 2) + F / 2 + 1) * 3 + a * 16, (F + 2) * 3);
          root.addChild(ic.node);
          sets.push(ic.set);
        }));
        return (t) => sets.forEach((s) => s(t));
      },
    });
    // each icon over a crew figure at game scale, on a lit floor then a dark one (break tiers rotate mild, moderate, severe)
    for (const dark of [false, true]) {
      ALL.forEach((name, i) => {
        const tier = TIERS[i % 3] as string;
        cells.push({
          label: name,
          note: `${dark ? 'dark' : 'lit'} floor${BREAKS.includes(name) ? ` · ${tier}` : ''}`,
          w: 200,
          h: 300,
          newRow: i === 0,
          loop: 1,
          mount(root) {
            const [at] = scene(ctx, root, 100, 240, dark, [{ gx: 0, gy: 0, dir: 1, seed: i % 2 ? 11 : 22, role: i % 2 ? 'role.engineer' : 'role.gunner' }]);
            const ic = icon(get, fps, unit, ID(name, tier), S);
            ic.node.position.set(at!.x, at!.y - HEAD);
            root.addChild(ic.node);
            return ic.set;
          },
        });
      });
    }
    // three crew side by side, mild, moderate, severe
    for (const dark of [false, true]) {
      cells.push({
        label: 'three breaks side by side',
        note: `${dark ? 'dark' : 'lit'} floor · mild, moderate, severe`,
        w: 380,
        h: 300,
        newRow: !dark,
        loop: 1,
        mount(root) {
          const feet = scene(ctx, root, 190, 240, dark, [{ gx: -1, gy: 1, dir: 1, seed: 22, role: 'role.gunner' }, { gx: 0, gy: 0, dir: 1, seed: 11, role: 'role.engineer' }, { gx: 1, gy: -1, dir: 1, seed: 33, role: 'role.medic' }]);
          const sets = feet.map((at, j) => {
            const ic = icon(get, fps, unit, ID(['hide', 'tantrum', 'refusal'][j] as string, TIERS[j]), S);
            ic.node.position.set(at.x, at.y - HEAD);
            root.addChild(ic.node);
            return ic.set;
          });
          return (t) => sets.forEach((s) => s(t));
        },
      });
    }
    // a shouting match: two crew facing each other, one icon mirrored
    for (const dark of [false, true]) {
      cells.push({
        label: 'shout, a pair facing each other',
        note: dark ? 'dark floor' : 'lit floor',
        w: 320,
        h: 300,
        newRow: !dark,
        loop: 1,
        mount(root) {
          const feet = scene(ctx, root, 160, 240, dark, [{ gx: 0, gy: 1, dir: 7, seed: 22, role: 'role.gunner' }, { gx: 1, gy: 0, dir: 3, seed: 11, role: 'role.engineer' }]);
          const sets = feet.map((at, j) => {
            const ic = icon(get, fps, unit, ID('shout'), S, j === 1);
            ic.node.position.set(at.x, at.y - HEAD);
            root.addChild(ic.node);
            return ic.set;
          });
          return (t) => sets.forEach((s) => s(t));
        },
      });
    }
    return cells;
  },
};
