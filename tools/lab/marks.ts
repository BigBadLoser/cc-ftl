import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { Atlas } from '../../src/render/assets/loader';
import { artZoom, createCrewFilter, crewFilters, crewPalette, setFilterTint, setFilterZoom } from '../../src/render/assets/palette';
import { drawLayers } from '../../src/render/crewSprites';
import { Z_PX } from '../../src/render/heights';
import { ART_SCALE as S, iso } from '../../src/render/iso';
import { lightTint } from '../../src/render/lightTint';
import { crewLoadout, preloadLayers } from '../../src/render/loadout';
import type { LabCell, LabCtx, LabPanel } from './panel';

/**
 * `?panel=marks`: the overhead crew icons (`crew.mark.*`, #239 social cues and #175 break symbols). Every icon's frames at 1x and 3x (one art px
 * per device px in a 2x shot at the default zoom 0.5), one break symbol on the three tier plates, then each icon over a real crew figure (the
 * game's loadout and crew filter) on a lit floor and on a dark one, at game scale (two device px per art px), and a shouting pair facing each other.
 *   &src=/.cache/marks-preview/   where to read marks.png + marks.json while the manifest has no `crew.mark.*` (tools/blender/review/marks_preview.py)
 */
const SOCIAL = ['chat', 'chatBad', 'shout'];
const BREAKS = ['panic', 'freeze', 'hide', 'tantrum', 'despair', 'refusal', 'isolation'];
const FIGHT = ['downed', 'surrendered'];
const TIERS = ['mild', 'moderate', 'severe'];
/** Head height of a standing figure (crewMarks.ts), where an icon's bottom sits. */
const HEAD = 1.6 * Z_PX;

type Frames = (id: string) => Texture[];

/** The icon frames: from the manifest when the sheets are built, else from the preview sheet. */
async function frames(atlas: Atlas, src: string): Promise<{ get: Frames; fps: number }> {
  if (atlas.ids('crew.mark.').length) {
    return { fps: 4, get: (id) => atlas.ids(`${id}.`).concat(atlas.ids(id).filter((x) => x === id)).map((x) => atlas.stat(x)?.tex).filter((t): t is Texture => !!t) };
  }
  const j = await (await fetch(`${src}marks.json`)).json() as { fps: number; frames: Record<string, { x: number; y: number; w: number; h: number }> };
  const sheet = await Assets.load<Texture>(`${src}marks.png?t=${Date.now()}`);
  sheet.source.scaleMode = 'nearest';
  const tex = new Map<string, Texture>();
  for (const [id, f] of Object.entries(j.frames)) tex.set(id, new Texture({ source: sheet.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }));
  return {
    fps: j.fps,
    get: (id) => (tex.has(id) ? [tex.get(id) as Texture] : [...tex.keys()].filter((k) => k.startsWith(`${id}.`)).map((k) => tex.get(k) as Texture)),
  };
}

/** An icon (a break symbol on its plate) as a container whose bottom centre is its origin; `set(t)` picks the frame. */
function icon(get: Frames, fps: number, id: string, k: number, tier?: string, flip = false): { node: Container; set: (t: number) => void } {
  const node = new Container();
  const plate = tier ? get(`crew.mark.tier.${tier}`)[0] : undefined;
  const fr = get(id);
  for (const t of [plate, fr[0]]) {
    if (!t) continue;
    const s = new Sprite(t);
    s.anchor.set(0.5, 1);
    s.scale.set(k * (flip ? -1 : 1), k);
    node.addChild(s);
  }
  const top = node.children[node.children.length - 1] as Sprite;
  return { node, set: (t) => { if (fr.length) top.texture = fr[Math.floor(t * fps) % fr.length] as Texture; } };
}

const ID = (k: string) => (BREAKS.includes(k) ? `crew.mark.break.${k}` : `crew.mark.${k}`);
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
  help: 'crew.mark.*: every icon at 1x and 3x, a break symbol on the three tier plates, each over a crew figure on a lit and a dark floor; src=/.cache/marks-preview/',
  async cells(ctx) {
    const { get, fps } = await frames(ctx.atlas, ctx.params.get('src') ?? '/.cache/marks-preview/');
    for (const seed of [11, 22, 33]) for (const role of ['role.engineer', 'role.gunner', 'role.medic']) preloadLayers(crewLoadout(ctx.atlas, { species: 'species.human', role, appearanceSeed: seed } as never));
    ctx.atlas.stat('tile.floor.a');
    await ctx.atlas.whenIdle();
    const cells: LabCell[] = [];
    // every icon, its frames side by side, at 1x then 3x (a break symbol on the moderate plate)
    for (const [k, tag] of [[1, '1x'], [3, '3x']] as const) {
      ALL.forEach((name, i) => {
        const n = Math.max(1, get(ID(name)).length);
        cells.push({
          label: name,
          note: `${tag} · ${n} frame${n > 1 ? 's' : ''}`,
          w: Math.max((n * 22 + 2) * k, 200),
          h: 24 * k,
          newRow: i === 0,
          mount(root) {
            for (let f = 0; f < n; f++) {
              const ic = icon(get, fps, ID(name), k, BREAKS.includes(name) ? 'moderate' : undefined);
              ic.node.position.set((f * 22 + 12) * k, 22 * k);
              ic.set(f / fps + 0.01);
              root.addChild(ic.node);
            }
            return () => {};
          },
        });
      });
    }
    // one symbol on each tier plate, and bare
    for (const k of [1, 3]) {
      [undefined, ...TIERS].forEach((tier, i) => {
        cells.push({
          label: tier ? `tantrum, ${tier}` : 'tantrum, no plate',
          note: `${k}x`,
          w: Math.max(24 * k, 200),
          h: 24 * k,
          newRow: i === 0,
          loop: 2 / fps,
          mount(root) {
            const ic = icon(get, fps, ID('tantrum'), k, tier);
            ic.node.position.set(12 * k, 22 * k);
            root.addChild(ic.node);
            return ic.set;
          },
        });
      });
    }
    // each icon over a crew figure at game scale, on a lit floor then a dark one
    for (const dark of [false, true]) {
      ALL.forEach((name, i) => {
        cells.push({
          label: name,
          note: dark ? 'dark floor' : 'lit floor',
          w: 200,
          h: 280,
          newRow: i === 0,
          loop: 1,
          mount(root) {
            const [at] = scene(ctx, root, 100, 220, dark, [{ gx: 0, gy: 0, dir: 1, seed: i % 2 ? 11 : 22, role: i % 2 ? 'role.engineer' : 'role.gunner' }]);
            const tier = BREAKS.includes(name) ? TIERS[i % 3] : undefined;
            const ic = icon(get, fps, ID(name), S, tier);
            ic.node.position.set(at!.x, at!.y - HEAD);
            root.addChild(ic.node);
            return ic.set;
          },
        });
      });
    }
    // tier options (preview only, crew_marks_tiers.py): each way to show the tier, a few symbols at 3x, then three crew at game scale
    const OPTS = ['ring', 'thought', 'stress', 'pips'].filter((o) => get(`crew.mark.opt.${o}.mild.panic`).length);
    const KINDS = ['panic', 'tantrum', 'isolation', 'freeze'];
    OPTS.forEach((o) => {
      cells.push({
        label: `tier option: ${o}`,
        note: '3x · mild, moderate, severe',
        w: KINDS.length * 3 * 22 * 3 + KINDS.length * 12,
        h: 24 * 3,
        newRow: true,
        loop: 1,
        mount(root) {
          const sets: ((t: number) => void)[] = [];
          KINDS.forEach((k, a) => TIERS.forEach((t, b) => {
            const ic = icon(get, fps, `crew.mark.opt.${o}.${t}.${k}`, 3);
            ic.node.position.set(((a * 3 + b) * 22 + 11) * 3 + a * 12, 22 * 3);
            root.addChild(ic.node);
            sets.push(ic.set);
          }));
          return (t) => sets.forEach((s) => s(t));
        },
      });
      for (const dark of [false, true]) {
        cells.push({
          label: o,
          note: `${dark ? 'dark' : 'lit'} floor · mild, moderate, severe`,
          w: 380,
          h: 280,
          loop: 1,
          mount(root) {
            const feet = scene(ctx, root, 190, 200, dark, [{ gx: -1, gy: 1, dir: 1, seed: 22, role: 'role.gunner' }, { gx: 0, gy: 0, dir: 1, seed: 11, role: 'role.engineer' }, { gx: 1, gy: -1, dir: 1, seed: 33, role: 'role.medic' }]);
            const sets = feet.map((at, j) => {
              const ic = icon(get, fps, `crew.mark.opt.${o}.${TIERS[j]}.${KINDS[j + 1]}`, S);
              ic.node.position.set(at.x, at.y - HEAD);
              root.addChild(ic.node);
              return ic.set;
            });
            return (t) => sets.forEach((s) => s(t));
          },
        });
      }
    });
    // a shouting match: two crew facing each other, one icon mirrored
    for (const dark of [false, true]) {
      cells.push({
        label: 'shout, a pair facing each other',
        note: dark ? 'dark floor' : 'lit floor',
        w: 320,
        h: 280,
        newRow: !dark,
        loop: 1,
        mount(root) {
          const feet = scene(ctx, root, 160, 200, dark, [{ gx: 0, gy: 1, dir: 7, seed: 22, role: 'role.gunner' }, { gx: 1, gy: 0, dir: 3, seed: 11, role: 'role.engineer' }]);
          const sets = feet.map((at, j) => {
            const ic = icon(get, fps, ID('shout'), S, undefined, j === 1);
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
