import { Graphics, Sprite } from 'pixi.js';
import { createDomeMesh } from '../../src/render/shieldDome';
import { fitExtent, rimPoint, type Fit } from '../../src/render/shieldFit';
import { DOME_SEC, newDome, type DomeState } from '../../src/render/shieldState';
import { paintDome, SHIELD_SPRITE, SPRITE_FPS, type DomeHit, type ShieldHitKind } from '../../src/render/shieldView';
import { strip, type LabCell, type LabPanel } from './panel';

interface Effect {
  label: string;
  sec: number;
  /** Layers before the event, and the state the event leaves (set at time 0). */
  layers: number;
  start(s: DomeState): void;
  hit?: ShieldHitKind;
  over?: boolean;
}

const EFFECTS: Readonly<Record<string, Effect>> = {
  laser: { label: 'laser absorbed', sec: DOME_SEC.hit, layers: 3, start: () => {}, hit: 'absorb' },
  laserBreak: { label: 'laser takes a layer', sec: DOME_SEC.break, layers: 3, start: (s) => ((s.layers = 2), (s.breakAt = 0)), hit: 'absorb' },
  ion: { label: 'ion drain', sec: DOME_SEC.hit, layers: 3, start: (s) => ((s.layers = 2), (s.breakAt = 0)), hit: 'ion' },
  pierce: { label: 'mass driver pierces', sec: DOME_SEC.pierce, layers: 1, start: () => {}, hit: 'pierce' },
  break: { label: 'layer breaks', sec: DOME_SEC.break, layers: 3, start: (s) => ((s.layers = 2), (s.breakAt = 0)) },
  lastBreak: { label: 'last layer breaks', sec: DOME_SEC.break, layers: 1, start: (s) => ((s.layers = 0), (s.breakAt = 0)) },
  regen: { label: 'layer returns', sec: DOME_SEC.regen, layers: 2, start: (s) => ((s.layers = 3), (s.regenAt = 0)) },
  down: { label: 'shields down (vent)', sec: DOME_SEC.down, layers: 3, start: (s) => ((s.layers = 0), (s.downAt = 0), (s.downRows = 3)) },
  overcharge: { label: 'overcharge pulse', sec: 0.9, layers: 3, start: () => {}, over: true },
};

/**
 * `?panel=shield`: the combat shield dome (src/render/shieldDome.ts) on a stand-in hull, every effect as a strip of
 * stills through its length, drawn by the same uniform code as the game (shieldView's `paintDome`), with the fx_shield
 * sprite piece at the hit. `effects=laser,ion` picks rows, `frames=8` the stills per effect, `rx=800&ry=420&rot=0.3`
 * the bubble, `rest=1,2,3,4` the layer counts at rest in the first row.
 */
export const shieldPanel: LabPanel = {
  id: 'shield',
  title: 'Shield dome',
  zoom: 0.25,
  help: `effects=${Object.keys(EFFECTS).join(',')} frames=8 rx=800 ry=420 rot=0 (zoom 0.25; 0.5 to look closer) rest=1,2,3,4`,
  cells({ atlas, params }) {
    const rx = Number(params.get('rx') ?? 800);
    const ry = Number(params.get('ry') ?? 420);
    const rot = Number(params.get('rot') ?? 0);
    const n = Number(params.get('frames') ?? 8);
    const names = (params.get('effects') ?? Object.keys(EFFECTS).join(',')).split(',').filter((k) => k in EFFECTS);
    const rest = (params.get('rest') ?? '1,2,3,4').split(',').map(Number).filter((x) => x > 0);
    const fit0: Fit = { cx: 0, cy: 0, rx, ry, rot };
    const { ex, ey } = fitExtent(fit0);
    const w = Math.ceil(ex * 2 + 40);
    const h = Math.ceil(ey * 2 + 40);
    const fit: Fit = { ...fit0, cx: w / 2, cy: h / 2 };
    const from = { x: fit.cx - rx * 2, y: fit.cy - ry * 2 };
    const p = rimPoint(fit, from);

    const cell = (label: string, note: string, layers: number, e: Effect | null, at: number, newRow: boolean): LabCell => ({
      label,
      note,
      w,
      h,
      at,
      loop: e ? e.sec + 0.4 : undefined,
      newRow,
      mount(root) {
        // a stand-in hull under the bubble (debug drawing), so the clear middle and the rim read as they do in game
        root.addChild(new Graphics().ellipse(fit.cx, fit.cy, rx * 0.8, ry * 0.62).fill(0x2a3a4c).stroke({ color: 0x3e566e, width: 2 }));
        const { mesh, uniforms } = createDomeMesh(fit.cx - ex * 1.12, fit.cy - ey * 1.12, fit.cx + ex * 1.12, fit.cy + ey * 1.12);
        uniforms.uC = new Float32Array([fit.cx, fit.cy]);
        uniforms.uAx = new Float32Array([rx, ry]);
        uniforms.uRot = rot;
        uniforms.uPx = 2;
        root.addChild(mesh);
        const spr = new Sprite();
        spr.blendMode = 'add';
        spr.visible = false;
        root.addChild(spr);
        const hits: DomeHit[] = e?.hit ? [{ lx: p.lx, ly: p.ly, at: 0, kind: e.hit }] : [];
        return (t) => {
          const now = t * 1000;
          const s = newDome(layers);
          if (e) e.start(s);
          mesh.visible = paintDome(uniforms, s, hits, !!e?.over, e ? now : 0);
          spr.visible = false;
          if (e?.hit) {
            const art = SHIELD_SPRITE[e.hit];
            const k = Math.floor(t * SPRITE_FPS);
            const st = k < art.frames ? atlas.stat(`${art.art}.${k}`) : undefined;
            if (st) {
              spr.texture = st.tex; // the game draws these pieces in its additive fx layer
              spr.anchor.set(st.ax / st.tex.width, st.ay / st.tex.height);
              spr.position.set(Math.round(p.x), Math.round(p.y));
              spr.rotation = e.hit === 'pierce' ? Math.atan2(p.y - from.y, p.x - from.x) : 0;
              spr.visible = true;
            }
          }
        };
      },
    });

    const cells: LabCell[] = rest.map((l, i) => cell(`${l} layer${l > 1 ? 's' : ''}`, 'at rest', l, null, 0, i === 0));
    for (const k of names) {
      const e = EFFECTS[k] as Effect;
      strip(e.sec, n).forEach((t, i) => cells.push(cell(i === 0 ? e.label : `${i}`, `${(t * 1000).toFixed(0)} ms`, e.layers, e, t, i === 0)));
    }
    return cells;
  },
};
