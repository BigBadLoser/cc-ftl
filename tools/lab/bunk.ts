import { Container, Sprite } from 'pixi.js';
import type { ClipDef } from '../../src/render/assets/manifest';
import { artZoom, createCrewFilter, crewFilters, crewPalette, setFilterTint, setFilterZoom } from '../../src/render/assets/palette';
import { berthLift, bedPose } from '../../src/render/bedPose';
import { drawLayers } from '../../src/render/crewSprites';
import { ART_SCALE, iso } from '../../src/render/iso';
import { lightTint } from '../../src/render/lightTint';
import { crewLoadout, preloadLayers } from '../../src/render/loadout';
import { content } from '../../src/content';
import type { ModuleDef } from '../../src/sim/registry';
import type { LabCell, LabCtx, LabPanel } from './panel';

const CAST = [{ seed: 11, role: 'role.engineer' }, { seed: 22, role: 'role.medic' }];

function sprite(ctx: LabCtx, root: Container, id: string, x: number, y: number): void {
  const s = ctx.atlas.stat(id);
  if (s) root.addChild(Object.assign(new Sprite(s.tex), { x: Math.round(x - s.ax), y: Math.round(y - s.ay) }));
}

/**
 * `?panel=bunk`: the double bunk and the single bed (#441) at each rotation, empty and with sleepers, layered as the game draws them
 * (crewView, moduleArt bedFronts): the bed body, the lower sleeper, `<asset>.front.b0.r<n>`, the upper sleeper, `<asset>.front.b1.r<n>`.
 * The sleepers lie where bedPose puts them, raised by berthLift. `rots=0,1,2,3` (default all), `beds=bunk,bed`.
 */
export const bunkPanel: LabPanel = {
  id: 'bunk',
  title: 'Bunk',
  zoom: 1,
  help: 'rots=0,1,2,3 (default all), beds=bunk,bed; each bed empty and with a sleeper in every berth',
  async cells(ctx) {
    const rots = (ctx.params.get('rots')?.split(',').map(Number).filter((r) => r >= 0 && r < 4)) ?? [0, 1, 2, 3];
    const beds = (ctx.params.get('beds') ?? 'bunk,bed').split(',').map((b) => `module.${b.trim()}`);
    const looks = CAST.map((c) => crewLoadout(ctx.atlas, { species: 'species.human', role: c.role, appearanceSeed: c.seed } as never));
    for (const layers of looks) {
      preloadLayers(layers);
      for (const l of layers) if (l.def.clips.sleep) l.request(l.def.clips.sleep as ClipDef, true);
    }
    for (const a of beds) ctx.atlas.ids(a).forEach((id) => ctx.atlas.stat(id));
    ctx.atlas.stat('tile.floor.a');
    await ctx.atlas.whenIdle();
    const cells: LabCell[] = [];
    for (const a of beds) {
      const def = (content.modules as Record<string, ModuleDef | undefined>)[a];
      if (!def) continue;
      for (const filled of [false, true]) {
        rots.forEach((rot, i) => cells.push({
          label: `${a.slice(7)} r${rot} ${filled ? 'asleep' : 'empty'}`,
          w: 300,
          h: 300,
          newRow: i === 0,
          mount(root) {
            const ox = 150, oy = 210;
            const floor = ctx.atlas.stat('tile.floor.a');
            for (let gy = -2; gy <= 1; gy++) for (let gx = -2; gx <= 1; gx++) {
              if (!floor) continue;
              const p = iso(gx, gy);
              root.addChild(Object.assign(new Sprite(floor.tex), { x: ox + p.x - floor.ax, y: oy + p.y - floor.ay }));
            }
            // The footprint at (0, 0) - its front tile, the sprite anchor, sits at (w - 1, d - 1).
            const [w, d] = rot % 2 === 0 ? def.footprint : [def.footprint[1], def.footprint[0]];
            const fx = w - 1, fy = d - 1;
            sprite(ctx, root, `${a}.r${rot}`, ox, oy);
            const figures: { parts: { layer: (typeof looks)[number][number]; sprite: Sprite }[] }[] = [];
            const pose = bedPose(def, 0, 0, rot, true);
            for (let b = 0; b < (def.berths ?? 1); b++) {
              if (filled) {
                const p = iso(pose.x - fx, pose.y - fy);
                const body = new Container();
                const filter = createCrewFilter(ctx.atlas.manifest.keyColors, crewPalette(CAST[b]!.seed));
                const z = artZoom(Number(ctx.params.get('zoom') ?? 1) * devicePixelRatio);
                body.filters = crewFilters(filter, z);
                setFilterTint(filter, lightTint(255, false, -1));
                setFilterZoom(filter, z);
                const parts = looks[b]!.map((layer) => {
                  const s = new Sprite();
                  body.addChild(s);
                  return { layer, sprite: s };
                });
                body.position.set(Math.round(ox + p.x), Math.round(oy + p.y - berthLift(b) * ART_SCALE));
                root.addChild(body);
                figures.push({ parts });
              }
              sprite(ctx, root, `${a}.front.b${b}.r${rot}`, ox, oy);
            }
            return (t) => { for (const f of figures) drawLayers({ parts: f.parts, glows: [] }, 'sleep', pose.dir, t); };
          },
        }));
      }
    }
    return cells;
  },
};
