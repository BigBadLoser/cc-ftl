import { Container, Graphics, Sprite } from 'pixi.js';
import { content } from '../../src/content';
import { resolveArt } from '../../src/render/assets/fallback';
import { ART_SCALE as S } from '../../src/render/iso';
import { ARC_COLOR, drawBolt, recolor, shotLook } from '../../src/render/shotLook';
import type { ItemDef, WeaponDef } from '../../src/sim/registry';
import { withMods } from '../../src/sim/upgrades/stats';
import type { LabCell, LabCtx, LabPanel } from './panel';

/**
 * `?panel=shots`: every behaviour upgrade's shot beside the plain one (slice 2 of #338). A cell is one shot: the bolt in flight with its trail, the impact
 * burst and explosion at the end, drawn from the same look the game reads (render/shotLook.ts, the weapon's `look`, with the upgrade's mods applied by
 * the sim's `withMods`), and for an `arc` effect the lightning into a crew marker. `only=prism,chain` picks upgrades. Stand-in drawing (the target tile, the crew dot) is debug drawing.
 */
const W = 360, H = 200;
const MID = 100;

const upgrades = (Object.entries(content.items) as [string, ItemDef][]).filter(([, d]) => d.upgrade?.mods.weapon).map(([id, d]) => ({ id, name: d.name, up: d.upgrade! }));

function shotCell(ctx: LabCtx, label: string, note: string, weapon: string, def: WeaponDef, newRow: boolean): LabCell {
  return {
    label, note, w: W, h: H, newRow,
    mount(root: Container) {
      const look = shotLook(weapon, def.look);
      const arc = def.effects.some((e) => e.type === 'arc');
      const sprite = (id: string, x: number, y: number, scale: number, tint?: number, add = true): void => {
        const art = resolveArt(ctx.atlas, [id]);
        if (!art) return;
        const spr = new Sprite(art.s.tex);
        spr.anchor.set(art.s.ax / art.s.tex.width, art.s.ay / art.s.tex.height);
        spr.scale.set(art.scale * scale);
        spr.tint = art.tint;
        if (tint !== undefined) recolor(spr, tint);
        if (add) spr.blendMode = 'add';
        spr.position.set(Math.round(x), Math.round(y));
        root.addChild(spr);
      };
      const g = new Graphics();
      root.addChild(g);
      // the target tile and the muzzle
      g.rect(W - 120, MID + 14, 60, 18).fill({ color: 0x1c2733 }).stroke({ color: 0x3a4a5a, width: 1 });
      g.circle(24, MID + 10, 5).fill({ color: 0x3a4a5a });
      // the trail: dots thinning behind the bolt, more of them for a denser trail
      const bx = W / 2 - 10;
      const dots = Math.round(7 * look.trail);
      for (let i = 1; i <= dots; i++) g.circle(bx - (i * 70) / Math.max(7, dots), MID + (i % 2 ? 2 : -2), 2).fill({ color: look.tint, alpha: 0.8 * (1 - i / (dots + 1)) });
      // the volley: every shot of it in a row, a fixed gap apart (the delay between shots, in px)
      // (staggered along the flight and fanned in lanes so each bolt can be counted)
      const n = def.shots;
      for (let i = 0; i < n; i++) sprite(def.projectileAsset, bx - 40 + (i - (n - 1) / 2) * 34, MID + (i - (n - 1) / 2) * 15, n > 1 ? 0.6 : 1, def.look?.tint);
      // the impact: sparks and the explosion, sized by the blast
      const hx = W - 90, hy = MID + 10;
      for (let i = 0; i < Math.round(10 * look.blast); i++) {
        const a = (i / Math.round(10 * look.blast)) * Math.PI * 2;
        g.circle(hx + Math.cos(a) * 18 * look.blast * S, hy + Math.sin(a) * 10 * look.blast * S, 2).fill({ color: i % 3 ? look.tint : 0xffffff, alpha: 0.9 });
      }
      sprite('fx.explosion_small', hx, hy, look.blast, def.look?.tint);
      if (arc) {
        const crew = [{ x: hx - 40, y: hy + 40 }, { x: hx + 10, y: hy + 50 }];
        for (const c of crew) {
          g.circle(c.x, c.y, 5).fill({ color: 0xe8d8b0 });
          const bolt = new Graphics();
          root.addChild(bolt);
          drawBolt(bolt, { x: hx, y: hy + 10 }, c, def.look?.tint ?? ARC_COLOR, 0.95, 0);
        }
      }
      return () => {};
    },
  };
}

export const shotsPanel: LabPanel = {
  id: 'shots',
  title: 'Behaviour upgrade shots',
  help: 'each behaviour upgrade\'s shot (tint, trail, blast, arcs) beside the plain weapon\'s: only=prism,focus,frag,rail,nuke,chain,thermite',
  async cells(ctx) {
    for (const id of ['fx.explosion_small', ...Object.values(content.weapons).map((w) => w.projectileAsset)]) ctx.atlas.stat(id);
    await ctx.atlas.whenIdle();
    const only = (ctx.params.get('only') ?? '').split(',').filter(Boolean);
    const cells: LabCell[] = [];
    for (const u of upgrades.filter((x) => !only.length || only.some((o) => x.id.endsWith(`_${o}`)))) {
      const weapon = u.up.fits?.[0] ?? '';
      const base = (content.weapons as Record<string, WeaponDef>)[weapon];
      if (!base) continue;
      cells.push(shotCell(ctx, `${base.name} (plain)`, weapon, weapon, base, true));
      cells.push(shotCell(ctx, u.name, `${u.id}: ${describe(base, withMods(base, u.up.mods))}`, weapon, withMods(base, u.up.mods), false));
    }
    return cells;
  },
};

/** One line of what changed in the numbers, for the cell's note. */
function describe(base: WeaponDef, d: WeaponDef): string {
  const bits: string[] = [];
  if (d.shots !== base.shots) bits.push(`${d.shots} shots`);
  if (d.speed !== base.speed) bits.push(`speed ${d.speed}`);
  if (d.shield.pierce !== base.shield.pierce) bits.push(`pierce ${d.shield.pierce}`);
  if (d.ammoPerShot) bits.push(`${d.ammoPerShot} ammo`);
  if (d.heat !== base.heat) bits.push(`heat x${(d.heat / base.heat).toFixed(1)}`);
  if (d.effects.some((e) => e.type === 'arc')) bits.push('arc');
  return bits.join(', ');
}
