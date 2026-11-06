import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { loadAtlas, type Atlas, type StaticSprite } from '../../src/render/assets/loader';
import { iso } from '../../src/render/iso';
import type { LabCell, LabCtx, LabPanel } from './panel';

/** The weapon upgrade items, the three in the game first (their `placeholderIcon` goes when the art is wired), then the seven planned. */
const BUILT = ['capacitor', 'coolant', 'housing'];
const PLANNED = ['prism', 'focus', 'frag', 'rail', 'nuke', 'chain', 'thermite'];
const NAMES: Record<string, string> = {
  capacitor: 'Quick capacitor', coolant: 'Coolant jacket', housing: 'Hardened housing', prism: 'Prism splitter', focus: 'Heavy focus',
  frag: 'Frag slug', rail: 'Rail coil', nuke: 'Nuclear warhead', chain: 'Chain coil', thermite: 'Thermite',
};
const SIZES = ['s', 'm', 'l', 'held'] as const;
const REF = ['item.electronics', 'item.parts'];
const SLOT = 40; // css px: the module inspector's upgrade slot (ItemIcon size)

/** Sprites sit on the tile centre: draw an optional floor tile, then the sprite on its anchor. */
function put(root: Container, atlas: Atlas, st: StaticSprite | undefined, x: number, y: number, k: number, floor?: StaticSprite): void {
  if (floor) root.addChild(Object.assign(new Sprite(floor.tex), { x: x - floor.ax, y: y - floor.ay }));
  if (!st) return;
  st.tex.source.scaleMode = 'nearest';
  const s = Object.assign(new Sprite(st.tex), { x: x - st.ax * k, y: y - st.ay * k });
  s.scale.set(k);
  root.addChild(s);
  if (st.glow) {
    const g = Object.assign(new Sprite(st.glow), { x: s.x, y: s.y });
    g.scale.set(k);
    g.blendMode = 'add';
    root.addChild(g);
  }
  void atlas;
}

/**
 * `?panel=upgrades` : the weapon upgrade items (`item.upg_*`, family `upgrades`).
 *   view=ref   (default) each stack size and held at 1x on a floor tile, beside item.electronics and item.parts for scale, then the
 *              item as the module inspector's upgrade slot draws it (the `.m` pile cut into a 40 px box, as ItemIcon does)
 *   view=zoom  each size and held alone at 3x
 *   items=a,b  only these (capacitor, coolant, housing, prism, focus, frag, rail, nuke, chain, thermite)
 *   src=/.cache/upgrades-preview/   where to read the sheet while the manifest has none (python3 tools/blender/sprites/build_sprites.py ... upgrades)
 */
export const upgradesPanel: LabPanel = {
  id: 'upgrades',
  title: 'Weapon upgrade items',
  zoom: 0.5,
  help: 'item.upg_*: stacks and held at 1x beside item.electronics/item.parts and in the 40 px inspector slot (view=ref), or at 3x (view=zoom); items=a,b; src=/.cache/upgrades-preview/',
  async cells(ctx: LabCtx) {
    const z = Number(ctx.params.get('zoom') ?? 0.5);
    const view = ctx.params.get('view') ?? 'ref';
    const only = ctx.params.get('items')?.split(',').map((s) => s.trim()).filter(Boolean);
    const list = [...BUILT, ...PLANNED].filter((n) => !only || only.includes(n));
    // from the game's manifest once the art is built into it, else the preview sheet
    const own = ctx.atlas.ids('item.upg_').length > 0 && !ctx.params.has('src');
    const atlas = own ? ctx.atlas : await loadAtlas(ctx.params.get('src') ?? '/.cache/upgrades-preview/');
    for (const n of list) for (const s of SIZES) atlas.stat(`item.upg_${n}.${s}`);
    for (const r of REF) for (const s of SIZES) ctx.atlas.stat(`${r}.${s}`);
    ctx.atlas.stat('tile.floor.a');
    await Promise.all([atlas.whenIdle(), ctx.atlas.whenIdle()]);
    const floor = ctx.atlas.stat('tile.floor.a');
    const cells: LabCell[] = [];
    const TW = 128; // a floor tile, world px
    const H = 150;
    list.forEach((n, row) => {
      const tag = BUILT.includes(n) ? 'in game' : 'planned';
      if (view === 'zoom') {
        SIZES.forEach((s, i) => {
          const st = atlas.stat(`item.upg_${n}.${s}`);
          cells.push({
            label: i === 0 ? `${NAMES[n]}: ${n}` : `.${s}`, note: i === 0 ? `${tag}, .s` : undefined,
            w: 300, h: 300, newRow: i === 0 && row > 0,
            mount(root) { put(root, atlas, st, 150, 190, 3); return () => {}; },
          });
        });
        return;
      }
      SIZES.forEach((s, i) => {
        cells.push({
          label: i === 0 ? `${NAMES[n]} (${tag})` : '', note: `.${s}: ${REF[0]!.slice(5)} | ${n} | ${REF[1]!.slice(5)}`,
          w: TW * 3, h: H, newRow: i === 0 && row > 0,
          mount(root) {
            const items = [ctx.atlas.stat(`${REF[0]}.${s}`), atlas.stat(`item.upg_${n}.${s}`), ctx.atlas.stat(`${REF[1]}.${s}`)];
            items.forEach((st, j) => {
              const p = iso(0, 0);
              put(root, atlas, st, TW * (j + 0.5) + p.x, H * 0.62 + p.y, 1, floor);
            });
            return () => {};
          },
        });
      });
      // the inspector's upgrade slot: the `.m` pile fitted into a 40 px box (never more than 2x), pixelated, over a dark chip
      for (const [label, id] of [['slot .m (as the game)', `item.upg_${n}.m`], ['slot .s', `item.upg_${n}.s`]] as const) {
        cells.push({
          label: '', note: label, w: 120, h: H,
          mount(root) {
            const box = SLOT / z;
            const st = atlas.stat(id);
            root.addChild(new Graphics().roundRect(60 - box / 2, 62 - box / 2, box, box, 8 / z).fill(0x161d27).stroke({ width: 1 / z, color: 0x3a4658 }));
            if (st) {
              const artW = st.tex.width / 2;
              const artH = st.tex.height / 2;
              const k = Math.min(SLOT / artW, SLOT / artH, 2) / z / 2; // css px per art px, as world scale of the (2 px per art px) texture
              st.tex.source.scaleMode = 'nearest';
              const sp = new Sprite(st.tex);
              sp.anchor.set(0.5);
              sp.scale.set(k);
              sp.position.set(60, 62);
              root.addChild(sp);
            }
            const t = new Text({ text: `${Math.min(SLOT / ((st?.tex.width ?? 2) / 2), SLOT / ((st?.tex.height ?? 2) / 2), 2).toFixed(2)}x`, style: { fontSize: 10 / z, fill: 0x8fa0b4 } });
            t.position.set(60 - t.width / 2, 62 + box / 2 + 6);
            root.addChild(t);
            return () => {};
          },
        });
      }
    });
    return cells;
  },
};
