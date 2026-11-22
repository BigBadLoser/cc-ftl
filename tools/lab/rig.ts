import { Container, Graphics, Sprite } from 'pixi.js';
import type { ClipDef } from '../../src/render/assets/manifest';
import { artZoom, createCrewFilter, crewFilters, crewPalette, setFilterTint, setFilterZoom } from '../../src/render/assets/palette';
import { bedPose, berthLift } from '../../src/render/bedPose';
import { drawLayers } from '../../src/render/crewSprites';
import { ART_SCALE, iso } from '../../src/render/iso';
import { lightTint } from '../../src/render/lightTint';
import { crewLoadout, preloadLayers } from '../../src/render/loadout';
import { rigLayers, rigMirror } from '../../src/render/rigArt';
import { RIG_FPS, rigFrame, type RigCounts, RIG_PHASES } from '../../src/render/rigFrame';
import { frameCount } from '../../src/render/moduleArt';
import { content } from '../../src/content';
import type { Module } from '../../src/sim/modules/components';
import { rigFitsBed } from '../../src/sim/modules/rig';
import { TICK_HZ } from '../../src/sim/time';
import type { ModuleDef } from '../../src/sim/registry';
import type { LabCell, LabPanel } from './panel';

const RIG = 'module.surgery_rig', BED = 'module.med_bed';
const mod = (def: string, x: number, y: number, rot: number): Module => ({ def, x, y, rot, hp: 100, powerPriority: 5, enabled: true, powered: true, reservedBy: 0 });

/**
 * `?panel=rig`: the surgical rig (#311) beside a medical bed with a sleeper, as the game draws them (`rigLayers`: body, the front overlay at the bed's front,
 * the console hologram), stepped through an operation: an idle cell, then `frames` stills spread evenly over a job of `sec` seconds (the timeline of
 * render/rigFrame.ts; each cell's note names the phase and frame). `rot=0..3` turns the bed, `&play` runs the operation.
 */
export const rigPanel: LabPanel = {
  id: 'rig',
  title: 'Surgical rig',
  zoom: 1,
  help: 'frames=16 (stills through the operation), sec=60 (its length), rot=0 (the bed turned; the rig stands at its first fitting side)',
  async cells(ctx) {
    const frames = Math.max(1, Number(ctx.params.get('frames') ?? 16)), sec = Math.max(1, Number(ctx.params.get('sec') ?? 60));
    const rot = Math.max(0, Math.min(3, Number(ctx.params.get('rot') ?? 0)));
    const mods = content.modules as Record<string, ModuleDef | undefined>;
    const bedDef = mods[BED], rigDef = mods[RIG];
    if (!bedDef || !rigDef) return [];
    const look0 = crewLoadout(ctx.atlas, { species: 'species.human', role: 'role.engineer', appearanceSeed: 11 } as never);
    preloadLayers(look0);
    for (const l of look0) if (l.def.clips.sleep) l.request(l.def.clips.sleep as ClipDef, true);
    for (const a of [RIG, BED]) ctx.atlas.ids(a).forEach((id) => ctx.atlas.stat(id));
    ctx.atlas.stat('tile.floor.a');
    await ctx.atlas.whenIdle();
    const has = (id: string): boolean => !!ctx.atlas.stat(id);
    // The rig's own spot: the first of its four rotations and the tiles round the bed that face the bed's foot from a long side.
    const spots = [-1, 0, 1, 2].flatMap((y) => [-1, 0, 1, 2].flatMap((x) => [0, 1, 2, 3].map((r) => ({ x, y, r }))));
    const at = spots.find((s) => rigFitsBed(rigDef, s.x, s.y, s.r, bedDef, 0, 0, rot));
    if (!at) return [];
    const [bw, bd] = rot % 2 === 0 ? bedDef.footprint : [bedDef.footprint[1], bedDef.footprint[0]];
    const rigM = mod(RIG, at.x, at.y, at.r);
    const bedFront = { x: bw - 1, y: bd - 1 };
    const counts = Object.fromEntries(RIG_PHASES.map((p) => [p, frameCount(has, `${RIG}.front.r${at.r}.${p}`)])) as unknown as RigCounts;
    const work = sec * TICK_HZ;
    const shots = [{ label: 'idle', t: 0, active: false }, ...Array.from({ length: frames }, (_, i) => ({ label: `${Math.round((i / frames) * sec)}s`, t: ((i + 0.5) / frames) * sec, active: true }))];
    return shots.map((s, i): LabCell => {
      const progress = s.t * TICK_HZ, f = s.active ? rigFrame(progress, work, counts) : null;
      return {
        label: s.label,
        note: f ? `${f.phase} f${f.frame} @${Math.floor(s.t * RIG_FPS)}` : 'no operation',
        w: 300, h: 300, at: s.t, loop: s.active ? sec : undefined, newRow: i % 5 === 0,
        mount(root) {
          const ox = 150, oy = 200;
          const clip = new Graphics().rect(0, 0, 300, 300).fill(0xffffff); // the floor reaches past the cell: keep the next cell's off this one
          root.addChild(clip);
          root.mask = clip;
          const place = (tx: number, ty: number): { x: number; y: number } => { const p = iso(tx - bedFront.x, ty - bedFront.y); return { x: ox + p.x, y: oy + p.y }; };
          const floor = ctx.atlas.stat('tile.floor.a');
          for (let gy = -2; gy <= 2; gy++) for (let gx = -2; gx <= 2; gx++) {
            if (!floor) continue;
            const p = place(gx, gy);
            root.addChild(Object.assign(new Sprite(floor.tex), { x: p.x - floor.ax, y: p.y - floor.ay }));
          }
          const draw = (id: string[], x: number, y: number): void => {
            const st = id.map((c) => ctx.atlas.stat(c)).find(Boolean);
            if (!st) return;
            root.addChild(Object.assign(new Sprite(st.tex), { x: Math.round(x - st.ax), y: Math.round(y - st.ay) }));
            if (st.glow) root.addChild(Object.assign(new Sprite(st.glow), { x: Math.round(x - st.ax), y: Math.round(y - st.ay), blendMode: 'add' as const }));
          };
          const st = s.active ? 'active' : 'idle';
          draw([`${BED}${rot ? `.r${rot}` : ''}.${st}`, `${BED}.${st}`, BED], ox, oy);
          const pose = bedPose(bedDef, 0, 0, rot, true), p = iso(pose.x - bedFront.x, pose.y - bedFront.y);
          const body = new Container(), filter = createCrewFilter(ctx.atlas.manifest.keyColors, crewPalette(11)), z = artZoom(Number(ctx.params.get('zoom') ?? 1) * devicePixelRatio);
          body.filters = crewFilters(filter, z);
          setFilterTint(filter, lightTint(255, false, -1));
          setFilterZoom(filter, z);
          const parts = look0.map((layer) => { const sp = new Sprite(); body.addChild(sp); return { layer, sprite: sp }; });
          body.position.set(Math.round(ox + p.x), Math.round(oy + p.y - berthLift(0) * ART_SCALE));
          root.addChild(body);
          draw([...(s.active ? [`${BED}.front.b0.r${rot}.active`] : []), `${BED}.front.b0.r${rot}`], ox, oy);
          const host = new Container();
          root.addChild(host);
          const rp = place(rigM.x, rigM.y);
          return (t) => {
            drawLayers({ parts, glows: [] }, 'sleep', pose.dir, t);
            host.removeChildren();
            const rig = { bedFront, active: s.active, progress: s.active ? t * TICK_HZ : 0, work, mirror: rigMirror(rigM.rot, bedDef, { x: 0, y: 0, rot }) };
            const look = { off: false, now: t * 1000, hp: 100, maxHp: 100, has };
            
            for (const l of rigLayers(rigM, rigDef, rig, look)) {
              const st = l.chain.map((c) => ctx.atlas.stat(c)).find(Boolean);
              if (!st) continue;
              host.addChild(Object.assign(new Sprite(st.tex), { x: Math.round(rp.x - st.ax), y: Math.round(rp.y - st.ay) }));
              if (st.glow) host.addChild(Object.assign(new Sprite(st.glow), { x: Math.round(rp.x - st.ax), y: Math.round(rp.y - st.ay), blendMode: 'add' as const }));
            }
          };
        },
      };
    });
  },
};
