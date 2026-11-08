import { Container, Graphics, Sprite } from 'pixi.js';
import { artZoom, createCrewFilter, crewFilters, crewPalette, setFilterZoom } from '../../src/render/assets/palette';
import { drawLayers } from '../../src/render/crewSprites';
import { crewLoadout, preloadLayers } from '../../src/render/loadout';
import { iso, TILE_H, TILE_W } from '../../src/render/iso';
import type { LabCell, LabPanel } from './panel';

const PAD = 10;
/** The cone variants of the escape pod's first preview (tools/blender/sprites/escape_pod.py VARIANTS). */
const LABELS: Record<string, string> = { h: 'H', hs: 'H soot', hw: 'H worn' };

/**
 * `?panel=pods` : pod-family craft side by side for shape and scale. Each variant (`variants=h`) and state
 * (`states=fly,drift:f0,drift:f1,docked`: sprites `vehicle.escape_pod.<v>.<state>.d<d>[.<frame>]`) gets a row at 1x beside the
 * mining pod (`ref=`), the first state also at 3x (`big`: every state), headings `dirs=0,2,5`; then the states side by
 * side at 3x. A floor tile's diamond under each anchor and a crew member beside it (`crew=0` hides them) show the scale.
 * Read a scratch preview build with `&assets=/.cache/escape-preview/` (built into .cache/escape-preview/1x).
 */
export const podsPanel: LabPanel = {
  id: 'pods',
  title: 'Pods',
  help: 'pod craft variants beside the mining pod at 1x and 3x: variants=h, states=fly,drift:f0,drift:f1,docked, big (every state at 3x), dirs=0,2,5, ref=vehicle.mining_pod, craft=vehicle.escape_pod',
  async cells({ atlas, params }) {
    const variants = (params.get('variants') ?? 'h').split(',').filter(Boolean);
    const dirs = (params.get('dirs') ?? '0,2,5').split(',').map(Number);
    const craft = params.get('craft') ?? 'vehicle.escape_pod';
    const ref = params.get('ref') ?? 'vehicle.mining_pod';
    // states: a sprite state, with an optional frame after a colon (`drift:f0` = <craft>.<v>.drift.d<d>.f0)
    const states = (params.get('states') ?? 'fly,drift:f0,drift:f1,docked').split(',').filter(Boolean);
    const sid = (v: string, st: string, d: number): string => {
      const [name, frame] = st.split(':');
      return `${craft}.${v}.${name}.d${d}${frame ? `.${frame}` : ''}`;
    };
    const ids = [...dirs.map((d) => `${ref}.fly.d${d}`), ...variants.flatMap((v) => states.flatMap((st) => dirs.map((d) => sid(v, st, d))))];
    for (const id of ids) atlas.stat(id);
    const withCrew = params.get('crew') !== '0';
    const loadout = crewLoadout(atlas, { species: 'species.human', role: 'role.engineer', appearanceSeed: 22 } as never);
    if (withCrew) preloadLayers(loadout);
    await atlas.whenIdle();
    const zoom = Number(params.get('zoom') ?? 1) || 1;
    const CREW = iso(1.2, -1.2); // a crew member a little over a tile to the pod's right, on the same row
    const CREW_H = 150; // room above a standing crew member (world px)
    const st = ids.map((id) => atlas.stat(id)).filter((s) => !!s);
    // one box for every sprite, anchors lined up, wide enough for a floor tile
    const left = Math.max(TILE_W / 2, ...st.map((s) => s.ax));
    const top = Math.max(CREW_H, ...st.map((s) => s.ay));
    const right = Math.max(TILE_W / 2, ...st.map((s) => s.tex.width - s.ax), withCrew ? CREW.x + 40 : 0);
    const bottom = Math.max(TILE_H / 2, ...st.map((s) => s.tex.height - s.ay));
    const w = Math.ceil(left + right) + PAD * 2;
    const h = Math.ceil(top + bottom) + PAD * 2;
    const cell = (label: string, id: string, k: number, newRow: boolean): LabCell => ({
      label,
      note: k === 1 ? '1x' : `${k}x nearest`,
      w: w * k,
      h: h * k,
      newRow,
      mount(root) {
        const s = atlas.stat(id);
        const box = new Container();
        box.scale.set(k);
        root.addChild(box);
        const ox = PAD + left, oy = PAD + top;
        box.addChild(new Graphics().poly([ox - TILE_W / 2, oy, ox, oy - TILE_H / 2, ox + TILE_W / 2, oy, ox, oy + TILE_H / 2])
          .fill({ color: 0x2a3340, alpha: 0.6 }).stroke({ color: 0x3d4a5c, width: 1 }));
        if (!s) return () => {};
        if (withCrew) {
          const body = new Container();
          const filter = createCrewFilter(atlas.manifest.keyColors, crewPalette(22));
          const z = artZoom(zoom * k * devicePixelRatio);
          body.filters = crewFilters(filter, z);
          setFilterZoom(filter, z);
          const parts = loadout.map((layer) => {
            const sprite = new Sprite();
            body.addChild(sprite);
            return { layer, sprite };
          });
          drawLayers({ parts, glows: [] }, 'idle', 3, 0);
          body.position.set(ox + CREW.x, oy + CREW.y);
          box.addChild(body);
        }
        box.addChild(Object.assign(new Sprite(s.tex), { x: ox - s.ax, y: oy - s.ay }));
        if (s.glow) {
          const g = Object.assign(new Sprite(s.glow), { x: ox - s.ax, y: oy - s.ay });
          g.blendMode = 'add';
          box.addChild(g);
        }
        return () => {};
      },
    });
    const cells: LabCell[] = [];
    for (const v of variants) {
      const name = LABELS[v] ?? v;
      states.forEach((st, k) => {
        const tag = `${name} ${st.replace(':', ' ')}`;
        cells.push(cell(`mining pod d${dirs[0]}`, `${ref}.fly.d${dirs[0]}`, 1, true));
        dirs.forEach((d) => cells.push(cell(`${tag}: d${d}`, sid(v, st, d), 1, false)));
        if (k === 0 || params.has('big')) dirs.forEach((d, i) => cells.push(cell(`${tag}: d${d}`, sid(v, st, d), 3, i === 0)));
      });
      // the states side by side at 3x on one heading, to compare
      if (states.length > 1) states.forEach((st, i) => cells.push(cell(`${name} ${st.replace(':', ' ')}: d${dirs[0]}`, sid(v, st, dirs[0]), 3, i === 0)));
    }
    return cells;
  },
};
