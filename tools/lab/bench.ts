import { Container, Sprite } from 'pixi.js';
import type { ClipDef } from '../../src/render/assets/manifest';
import { artZoom, createCrewFilter, crewFilters, crewPalette, setFilterTint, setFilterZoom } from '../../src/render/assets/palette';
import { drawLayers } from '../../src/render/crewSprites';
import { content } from '../../src/content';
import { rotatedSize } from '../../src/sim/modules/footprint';
import { seatPoints } from '../../src/sim/ai/machines/sit';
import { iso } from '../../src/render/iso';
import { lightTint } from '../../src/render/lightTint';
import { crewLoadout, preloadLayers } from '../../src/render/loadout';
import type { LabCell, LabCtx, LabPanel } from './panel';

const A = 'module.bench';
const CLIP = 'sit_bench';
/** Seats in local tiles (tools/blender/sprites/bench.py SEATS: bench_r13 SEATS / 32, SIT_V): the game's own def (content/modules.ts), so the lab and the game cannot drift. */
const BENCH = content.modules['module.bench'];
const SEATS = BENCH.seats!.at;
/** Crew direction facing the bench's front (+v) per rotation (bench.py facing). */
const FACING = [2, 4, 6, 0] as const;
const CAST = [{ seed: 11, role: 'role.engineer' }, { seed: 22, role: 'role.medic' }, { seed: 33, role: 'role.gunner' }];

/** The seat point relative to the front-most tile (the sprite's anchor): the game's `seatPoints` (sim/ai/machines/sit.ts), which crewView draws sitters at. */
function seatAt(rot: number, k: number): { x: number; y: number } {
  const [w, d] = rotatedSize(BENCH, rot);
  const p = seatPoints(BENCH, { x: 0, y: 0, rot })[k] as { x: number; y: number };
  return { x: p.x - (w - 1), y: p.y - (d - 1) };
}

function sprite(ctx: LabCtx, root: Container, id: string, x: number, y: number): void {
  const s = ctx.atlas.stat(id);
  if (s) root.addChild(Object.assign(new Sprite(s.tex), { x: Math.round(x - s.ax), y: Math.round(y - s.ay) }));
}

/**
 * `?panel=bench`: the bench module (#441) at each rotation, empty and with a crew member on each of its three seats as the
 * game layers them: the bench, the sitters (the `sit_bench` clip, cut against a bench seat, through the crew filter),
 * then the front overlay `module.bench.front.r<n>`. `rots=0,1,2,3` (default all).
 */
export const benchPanel: LabPanel = {
  id: 'bench',
  title: 'Bench',
  zoom: 1,
  help: 'rots=0,1,2,3 (default all); the bench empty and with three seated crew',
  async cells(ctx) {
    const rots = (ctx.params.get('rots')?.split(',').map(Number).filter((r) => r >= 0 && r < 4)) ?? [0, 1, 2, 3];
    const looks = CAST.map((c) => crewLoadout(ctx.atlas, { species: 'species.human', role: c.role, appearanceSeed: c.seed } as never));
    for (const layers of looks) {
      preloadLayers(layers);
      for (const l of layers) if (l.def.clips[CLIP]) l.request(l.def.clips[CLIP] as ClipDef, true);
    }
    ctx.atlas.ids(A).forEach((id) => ctx.atlas.stat(id));
    ctx.atlas.stat('tile.floor.a');
    await ctx.atlas.whenIdle();
    const cells: LabCell[] = [];
    for (const seated of [false, true]) {
      rots.forEach((rot, i) => cells.push({
        label: `r${rot} ${seated ? 'seated' : 'empty'}`,
        w: 340,
        h: 300,
        newRow: i === 0,
        mount(root) {
          const ox = 180, oy = 200;
          const floor = ctx.atlas.stat('tile.floor.a');
          for (let gy = -2; gy <= 1; gy++) for (let gx = -2; gx <= 1; gx++) {
            if (!floor) continue;
            const p = iso(gx, gy);
            root.addChild(Object.assign(new Sprite(floor.tex), { x: ox + p.x - floor.ax, y: oy + p.y - floor.ay }));
          }
          sprite(ctx, root, `${A}.r${rot}`, ox, oy);
          if (!seated) return () => {};
          const seats = SEATS.map((_, k) => ({ ...seatAt(rot, k), k })).sort((a, b) => a.x + a.y - (b.x + b.y));
          const figures = seats.map(({ x, y, k }) => {
            const p = iso(x, y);
            const body = new Container();
            const filter = createCrewFilter(ctx.atlas.manifest.keyColors, crewPalette(CAST[k]!.seed));
            const z = artZoom(Number(ctx.params.get('zoom') ?? 1) * devicePixelRatio);
            body.filters = crewFilters(filter, z);
            setFilterTint(filter, lightTint(255, false, -1));
            setFilterZoom(filter, z);
            const parts = looks[k]!.map((layer) => {
              const s = new Sprite();
              body.addChild(s);
              return { layer, sprite: s };
            });
            body.position.set(Math.round(ox + p.x), Math.round(oy + p.y));
            root.addChild(body);
            return parts;
          });
          sprite(ctx, root, `${A}.front.r${rot}`, ox, oy);
          return (t) => { for (const parts of figures) drawLayers({ parts, glows: [] }, CLIP, FACING[rot] as number, t); };
        },
      }));
    }
    return cells;
  },
};
