import { Container, Graphics, Sprite } from 'pixi.js';
import { loadAtlas, type Atlas, type StaticSprite } from '../../src/render/assets/loader';
import { iso } from '../../src/render/iso';
import type { LabCell, LabCtx, LabPanel } from './panel';

/** The weapon upgrade items, the three in the game first, then the seven behaviour upgrades of slice 2. */
const BUILT = ['capacitor', 'coolant', 'housing'];
const PLANNED = ['prism', 'focus', 'frag', 'rail', 'nuke', 'chain', 'thermite'];
const NAMES: Record<string, string> = {
  capacitor: 'Quick capacitor', coolant: 'Coolant jacket', housing: 'Hardened housing', prism: 'Prism splitter', focus: 'Heavy focus',
  frag: 'Frag slug', rail: 'Rail coil', nuke: 'Nuclear warhead', chain: 'Chain coil', thermite: 'Thermite',
};
const SIZES = ['s', 'm', 'l', 'held'] as const;
const REF = ['item.electronics', 'item.parts'];
const PANEL_BG = 0x0b0e11; // --panel (src/ui/theme.css)
const ICON = 40; // css px: the upgrade's UI icon box (module inspector slot, hover card), shown 1:1
/** Each behaviour upgrade's shot and a proposed tint for it (slice 2 sets the real ones in WeaponDef.look). */
const SHOTS: { shot: string; weapon: string; tints: [string, number][] }[] = [
  { shot: 'laser_bolt', weapon: 'Burst laser', tints: [['prism', 0xd890ff], ['focus', 0xff4a5a]] },
  { shot: 'mass_slug', weapon: 'Mass driver', tints: [['frag', 0xffc04a], ['rail', 0xff8a3c]] },
  { shot: 'missile', weapon: 'Missile', tints: [['nuke', 0xb4ff4a]] },
  { shot: 'ion_bolt', weapon: 'Ion cannon', tints: [['chain', 0xa88cff]] },
  { shot: 'fire_shell', weapon: 'Incendiary', tints: [['thermite', 0xff5a2a]] },
];

/** A sprite on its anchor at (x, y), scaled by k, its glow added over it; an optional floor tile under it; an optional tint on both. */
function put(root: Container, st: StaticSprite | undefined, x: number, y: number, k: number, floor?: StaticSprite, tint?: number): void {
  if (floor) root.addChild(Object.assign(new Sprite(floor.tex), { x: x - floor.ax, y: y - floor.ay }));
  if (!st) return;
  st.tex.source.scaleMode = 'nearest';
  const s = Object.assign(new Sprite(st.tex), { x: x - st.ax * k, y: y - st.ay * k });
  s.scale.set(k);
  if (tint !== undefined) s.tint = tint;
  root.addChild(s);
  if (st.glow) {
    const g = Object.assign(new Sprite(st.glow), { x: s.x, y: s.y });
    g.scale.set(k);
    g.blendMode = 'add';
    if (tint !== undefined) g.tint = tint;
    root.addChild(g);
  }
}

/** A sprite centred in (cx, cy) by its frame, not its anchor (an icon frame sits in its box like ItemIcon draws it). */
function centred(root: Container, st: StaticSprite | undefined, cx: number, cy: number, k: number): void {
  if (!st) return;
  st.tex.source.scaleMode = 'nearest';
  const s = new Sprite(st.tex);
  s.anchor.set(0.5);
  s.scale.set(k);
  s.position.set(Math.round(cx - (st.tex.width * k) / 2) + (st.tex.width * k) / 2, Math.round(cy - (st.tex.height * k) / 2) + (st.tex.height * k) / 2);
  root.addChild(s);
}

/**
 * `?panel=upgrades` : the weapon upgrade items (`item.upg_*`, family `upgrades`).
 *   view=ref    (default) each stack size and held at 1x on a floor tile, beside item.electronics and item.parts for scale
 *   view=zoom   each size and held alone at 3x
 *   view=icons  the UI icons (`item.upg_*.icon`) on the --panel colour at 1x (40 px box, as the UI shows them) and 3x, in a row, then
 *               each beside its floor `.m`
 *   view=shots  each neutral shot (`fx.<shot>_neutral`) beside the weapon's coloured one, then tinted for each upgrade that uses it
 *   items=a,b   only these (capacitor, coolant, housing, prism, focus, frag, rail, nuke, chain, thermite)
 *   src=/.cache/upgrades-preview/   where to read the family's sheet while the manifest has none (build_sprites.py ... upgrades)
 */
export const upgradesPanel: LabPanel = {
  id: 'upgrades',
  title: 'Weapon upgrade items',
  zoom: 0.5,
  help: 'item.upg_*: stacks and held beside item.electronics/item.parts (view=ref), at 3x (view=zoom), the 40 px UI icons (view=icons), neutral shots and their tints (view=shots); items=a,b; src=/.cache/upgrades-preview/',
  async cells(ctx: LabCtx) {
    const z = Number(ctx.params.get('zoom') ?? 0.5);
    const view = ctx.params.get('view') ?? 'ref';
    const only = ctx.params.get('items')?.split(',').map((s) => s.trim()).filter(Boolean);
    const list = [...BUILT, ...PLANNED].filter((n) => !only || only.includes(n));
    // from the game's manifest once the art is built into it, else the preview sheet
    const own = ctx.atlas.ids('item.upg_').length > 0 && !ctx.params.has('src');
    const atlas: Atlas = own ? ctx.atlas : await loadAtlas(ctx.params.get('src') ?? '/.cache/upgrades-preview/');
    for (const id of atlas.ids('item.upg_')) atlas.stat(id);
    for (const id of atlas.ids('fx.')) atlas.stat(id);
    for (const r of REF) for (const s of SIZES) ctx.atlas.stat(`${r}.${s}`);
    for (const s of SHOTS) ctx.atlas.stat(`fx.${s.shot}`);
    ctx.atlas.stat('tile.floor.a');
    await Promise.all([atlas.whenIdle(), ctx.atlas.whenIdle()]);
    const floor = ctx.atlas.stat('tile.floor.a');
    const tag = (n: string) => (BUILT.includes(n) ? 'in game' : 'slice 2');
    const ui = 1 / (2 * z); // world scale that draws one art px as one css px (the textures hold two world px per art px)
    const cells: LabCell[] = [];

    if (view === 'icons') {
      // a row at 1x, as the UI shows them, then a row at 3x, all on the panel colour
      for (const k of [1, 3]) {
        const box = (ICON * k) / z + 16;
        list.forEach((n, i) => cells.push({
          label: i === 0 ? `UI icons at ${k}x` : '', note: n, w: box, h: box, newRow: i === 0,
          mount(root) {
            root.addChild(new Graphics().rect(0, 0, box, box).fill(PANEL_BG));
            if (k === 1) root.addChild(new Graphics().rect(8, 8, ICON / z, ICON / z).stroke({ width: 1 / z, color: 0x232a33 }));
            centred(root, atlas.stat(`item.upg_${n}.icon`), box / 2, box / 2, ui * k);
            return () => {};
          },
        }));
      }
      // each icon (1x and 3x) beside the floor .m it stands for
      list.forEach((n, i) => cells.push({
        label: `${NAMES[n]} (${tag(n)})`, note: 'icon 1x | icon 3x | floor .m', w: 560, h: 170, newRow: i === 0 || i % 2 === 0,
        mount(root) {
          root.addChild(new Graphics().rect(0, 0, 340, 170).fill(PANEL_BG));
          centred(root, atlas.stat(`item.upg_${n}.icon`), 60, 85, ui);
          centred(root, atlas.stat(`item.upg_${n}.icon`), 230, 85, ui * 3);
          const p = iso(0, 0);
          put(root, atlas.stat(`item.upg_${n}.m`), 450 + p.x, 110 + p.y, 1, floor);
          return () => {};
        },
      }));
      return cells;
    }

    if (view === 'shots') {
      SHOTS.forEach((s, row) => {
        const col = ctx.atlas.stat(`fx.${s.shot}`);
        const neu = atlas.stat(`fx.${s.shot}_neutral`);
        const variants: [string, StaticSprite | undefined, number | undefined][] = [
          [`fx.${s.shot} (as now)`, col, undefined], [`fx.${s.shot}_neutral`, neu, undefined],
          ...s.tints.map(([u, t]): [string, StaticSprite | undefined, number | undefined] => [`neutral, ${NAMES[u]} tint #${t.toString(16)}`, neu, t]),
          ...s.tints.map(([u, t]): [string, StaticSprite | undefined, number | undefined] => [`as now, ${NAMES[u]} tint (muddy)`, col, t]),
        ];
        variants.forEach(([label, st, t], i) => cells.push({
          label: i === 0 ? s.weapon : '', note: label, w: 300, h: 110, newRow: i === 0 && row > 0,
          mount(root) { put(root, st, 160, 60, 2, undefined, t); return () => {}; },
        }));
      });
      return cells;
    }

    const TW = 128; // a floor tile, world px
    const H = 150;
    list.forEach((n, row) => {
      if (view === 'zoom') {
        SIZES.forEach((s, i) => cells.push({
          label: i === 0 ? `${NAMES[n]}: ${n}` : `.${s}`, note: i === 0 ? `${tag(n)}, .s` : undefined,
          w: 300, h: 300, newRow: i === 0 && row > 0,
          mount(root) { put(root, atlas.stat(`item.upg_${n}.${s}`), 150, 190, 3); return () => {}; },
        }));
        return;
      }
      SIZES.forEach((s, i) => cells.push({
        label: i === 0 ? `${NAMES[n]} (${tag(n)})` : '', note: `.${s}: ${REF[0]!.slice(5)} | ${n} | ${REF[1]!.slice(5)}`,
        w: TW * 3, h: H, newRow: i === 0 && row > 0,
        mount(root) {
          const items = [ctx.atlas.stat(`${REF[0]}.${s}`), atlas.stat(`item.upg_${n}.${s}`), ctx.atlas.stat(`${REF[1]}.${s}`)];
          const p = iso(0, 0);
          items.forEach((st, j) => put(root, st, TW * (j + 0.5) + p.x, H * 0.62 + p.y, 1, floor));
          return () => {};
        },
      }));
    });
    return cells;
  },
};
