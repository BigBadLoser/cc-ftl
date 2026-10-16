import type { World } from '../../sim/ecs';
import { AssignmentC, CrewC, JobC, PositionC } from '../../sim/crew/components';
import type { Grid } from '../../sim/grid';
import { footprintTiles } from '../../sim/modules/footprint';
import { ModuleC } from '../../sim/modules/components';
import { Struct } from '../../sim/structure';
import { iso } from '../iso';
import type { ModuleDefs } from '../moduleView';
import type { EmitterDef, Particles } from './particles';

const PUFFS = ['fx.puff.0', 'fx.puff.1', 'fx.puff.2', 'fx.puff.3'];

const SMOKE: EmitterDef = { frames: PUFFS, frameByAge: true, life: [1.4, 2.4], vx: [-5, 5], vy: [-9, -18], fade: 'inout', alpha: 0.55, tint: 0xb8bec8 };
const EMBER: EmitterDef = { frames: ['fx.ember'], life: [0.6, 1.3], vx: [-9, 9], vy: [-22, -42], gy: -6, fade: 'out', additive: true };
const SPARK: EmitterDef = { frames: ['fx.spark'], life: [0.25, 0.6], vx: [-45, 45], vy: [-70, -20], gy: 190, fade: 'out', additive: true };
const WELD: EmitterDef = { ...SPARK, vx: [-35, 35], vy: [-55, -10], life: [0.2, 0.45] };
/** Venting: air puffs and ice crystals stream toward the space tile; one def per grid direction (+x, -x, +y, -y). */
const DIRS: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const VENT = DIRS.map(([dx, dy]) => {
  const sx = (dx - dy) * 32;
  const sy = (dx + dy) * 16;
  const len = Math.hypot(sx, sy);
  const r = (a: number, b: number): [number, number] => [(sx / len) * a, (sx / len) * b];
  const q = (a: number, b: number): [number, number] => [(sy / len) * a, (sy / len) * b];
  const air: EmitterDef = { frames: PUFFS.slice(0, 3), frameByAge: true, life: [0.35, 0.7], vx: sortPair(r(50, 95)), vy: sortPair(q(50, 95)), fade: 'out', alpha: 0.5, tint: 0xd8ecff };
  const ice: EmitterDef = { frames: ['fx.ice'], life: [0.5, 0.9], vx: sortPair(r(35, 85)), vy: sortPair(q(35, 85)), gy: 40, fade: 'out' };
  return { air, ice };
});
function sortPair(p: [number, number]): [number, number] {
  return p[0] <= p[1] ? p : [p[1], p[0]];
}

const WELD_JOBS = new Set(['build', 'deconstruct', 'module', 'moduleDecon', 'repair']);

export interface AtmosphereHost {
  target(): { grid: Grid } | null;
}

/** Field- and component-driven emitters: smoke, fire embers, venting air and ice, module sparks, welding sparks. */
export function createAtmosphere(world: World, particles: Particles, defs: ModuleDefs, host: AtmosphereHost): { update(dt: number): void } {
  const wasPowered = new Map<number, boolean>();
  return {
    update(dt) {
      const t = host.target();
      if (!t) return;
      const { grid } = t;
      const { width: w, height: h } = grid;
      const struct = grid.raw('struct');
      const fire = grid.raw('fire');
      const smoke = grid.raw('smoke');
      const o2 = grid.raw('o2');
      for (let i = 0; i < struct.length; i++) {
        const k = struct[i];
        if (k !== Struct.Floor && k !== Struct.Door) continue;
        const x = i % w;
        const y = (i - x) / w;
        const c = iso(x, y);
        const sv = smoke[i] as number;
        if (sv >= 18) particles.emit(`s${i}`, SMOKE, c.x, c.y - 10, 0.4 + (sv / 255) * 2.4, dt, 18);
        const fv = fire[i] as number;
        if (fv > 0) particles.emit(`e${i}`, EMBER, c.x, c.y - 6, (fv / 255) * 5 + 0.6, dt, 14);
        const air = o2[i] as number;
        if (air > 0.5) {
          for (let d = 0; d < 4; d++) {
            const [dx, dy] = DIRS[d] as readonly [number, number];
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || struct[ny * w + nx] === Struct.Space) {
              const v = VENT[d] as (typeof VENT)[number];
              const rate = 3 + 7 * Math.min(1, air / 21);
              particles.emit(`va${i}.${d}`, v.air, c.x, c.y - 4, rate, dt, 8);
              particles.emit(`vi${i}.${d}`, v.ice, c.x, c.y - 4, rate * 0.25, dt, 8);
            }
          }
        }
      }
      for (const id of world.query(ModuleC)) {
        const m = world.get(id, ModuleC);
        const def = m && defs[m.def];
        if (!m || !def || m.gridId !== grid.id) continue;
        const tiles = footprintTiles(def, m.x, m.y, m.rot);
        let cx = 0;
        let cy = 0;
        for (const f of tiles) {
          const p = iso(f.x, f.y);
          cx += p.x / tiles.length;
          cy += p.y / tiles.length;
        }
        const on = m.powered && m.enabled && m.hp > 0;
        const prev = wasPowered.get(id);
        if (prev === true && !on && m.enabled) particles.burst(SPARK, cx, cy - 14, 10, 10);
        wasPowered.set(id, on);
        if (m.hp > 0 && m.hp < def.maxHp * 0.5) particles.emit(`m${id}`, SPARK, cx, cy - 14, 1.5 + 2.5 * (1 - m.hp / (def.maxHp * 0.5)), dt, 12);
      }
      for (const id of world.query(CrewC, PositionC)) {
        const crew = world.get(id, CrewC);
        const pos = world.get(id, PositionC);
        if (!crew || !pos || pos.gridId !== grid.id || crew.activity !== 'working') continue;
        const a = world.get(id, AssignmentC);
        const job = a && world.get(a.jobId, JobC);
        if (!job || !WELD_JOBS.has(job.kind)) continue;
        const p = iso(pos.x + (pos.toX - pos.x) * pos.progress, pos.y + (pos.toY - pos.y) * pos.progress);
        particles.emit(`w${id}`, WELD, p.x + 6, p.y - 16, 14, dt, 4);
      }
    },
  };
}
