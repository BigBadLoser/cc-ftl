import { Container, Graphics, Sprite } from 'pixi.js';
import { modules as defs } from '../../src/content/modules';
import { ANIM_FPS, frameCount, moduleLayers } from '../../src/render/moduleArt';
import type { Module } from '../../src/sim/modules/components';
import type { LabCell, LabPanel } from './panel';

const TW = 64;
const TH = 32;
const PAD = 14;
const IDS = ['module.arcade', 'module.gametable'] as const;

/** Floor under a w x h footprint (and the stand tiles), the origin at the centre of the front-most tile (ox, oy). */
function floor(tiles: { x: number; y: number }[], front: { x: number; y: number }, ox: number, oy: number, mark: Set<string>): Graphics {
  const g = new Graphics();
  for (const t of tiles) {
    const cx = ox + ((t.y - front.y - (t.x - front.x)) * TW) / 2;
    const cy = oy + ((t.x - front.x + (t.y - front.y)) * TH) / 2;
    g.poly([cx, cy - TH / 2, cx + TW / 2, cy, cx, cy + TH / 2, cx - TW / 2, cy]).fill(mark.has(`${t.x},${t.y}`) ? 0x35503a : 0x2a323a).stroke({ color: 0x3a444e, width: 1 });
  }
  return g;
}

/**
 * `?panel=leisure`: the arcade cabinet and the game table (#441) as the game stacks them (`moduleLayers`: body, front overlay, hologram),
 * unpowered, idle and each frame of the in-use animation, with the stand tiles (green) beside them. `ids=module.arcade,module.gametable`,
 * `rots=0,1,2,3` (default r0).
 */
export const leisurePanel: LabPanel = {
  id: 'leisure',
  title: 'Leisure modules',
  zoom: 2,
  help: 'ids=module.arcade,module.gametable rots=0,1,2,3 (default both, r0)',
  async cells({ atlas, params }) {
    const ids = (params.get('ids')?.split(',') ?? [...IDS]).filter((i) => (IDS as readonly string[]).includes(i));
    const rots = (params.get('rots')?.split(',') ?? ['0']).map(Number).filter((r) => r >= 0 && r < 4);
    for (const id of ids) atlas.ids(id).forEach((a) => atlas.stat(a)); // queue the sheets
    await atlas.whenIdle();
    const cells: LabCell[] = [];
    for (const id of ids) {
      const def = defs[id as (typeof IDS)[number]];
      for (const rot of rots) {
        const m: Module = { def: id, x: 0, y: 0, rot, hp: def.maxHp, powerPriority: 5, enabled: true, powered: true, reservedBy: 0 };
        const has = (a: string): boolean => !!atlas.stat(a);
        const n = Math.max(1, frameCount(has, `${id}.r${rot}.active`));
        const states: { label: string; active: boolean; off: boolean; at: number }[] = [
          { label: 'unpowered', active: false, off: true, at: 0 },
          { label: 'idle', active: false, off: false, at: 0 },
          ...Array.from({ length: n }, (_, f) => ({ label: `in use f${f}`, active: true, off: false, at: f / ANIM_FPS + 0.01 })),
        ];
        const [w, h] = rot % 2 === 0 ? def.footprint : [def.footprint[1], def.footprint[0]];
        const stands = (def.leisure?.stand ?? []).map(([dx, dy]) => {
          const [fw, fh] = def.footprint;
          let x = dx, y = dy, bw = fw, bh = fh;
          for (let i = 0; i < rot; i++) { [x, y] = [bh - 1 - y, x]; [bw, bh] = [bh, bw]; }
          return { x, y };
        });
        const tiles = [...Array.from({ length: w * h }, (_, i) => ({ x: i % w, y: Math.floor(i / w) })), ...stands];
        const front = { x: w - 1, y: h - 1 };
        const ox = PAD + 130, oy = PAD + 110;
        const mark = new Set(stands.map((s) => `${s.x},${s.y}`));
        states.forEach((st, i) => cells.push({
          label: st.label,
          note: `${def.name} r${rot}`,
          w: 260,
          h: 220,
          at: st.at,
          newRow: i === 0,
          mount(root) {
            root.addChild(floor(tiles, front, ox, oy, mark));
            const body = new Container();
            root.addChild(body);
            return (t) => {
              body.removeChildren();
              const look = { off: st.off, now: st.active ? t * 1000 : 0, hp: def.maxHp, maxHp: def.maxHp, has };
              for (const layer of moduleLayers(null as never, 0, m, def, st.active, false, null, look)) {
                const a = layer.chain.find((c) => atlas.stat(c));
                const s = a ? atlas.stat(a) : undefined;
                if (!s) continue;
                body.addChild(Object.assign(new Sprite(s.tex), { x: Math.round(ox - s.ax), y: Math.round(oy - s.ay) }));
                if (s.glow) body.addChild(Object.assign(new Sprite(s.glow), { x: Math.round(ox - s.ax), y: Math.round(oy - s.ay), blendMode: 'add' as const }));
              }
            };
          },
        }));
      }
    }
    return cells;
  },
};
