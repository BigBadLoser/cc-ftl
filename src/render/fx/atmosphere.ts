import { shipIdAtTile } from '../regionRules';
import type { World } from '../../sim/ecs';
import { AssignmentC, CrewC, JobC, PositionC } from '../../sim/crew/components';
import type { Grid } from '../../sim/grid';
import { footprintTiles } from '../../sim/modules/footprint';
import { ModuleC } from '../../sim/modules/components';
import { Struct } from '../../sim/structure';
import { ART_SCALE as S, iso, TILE_H, TILE_W } from '../iso';
import { createModuleIndex } from '../moduleMemo';
import { regionTiles } from '../regionTiles';
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
  const sx = ((dx - dy) * TILE_W) / 2;
  const sy = ((dx + dy) * TILE_H) / 2;
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

/** The fields a tile's emitters read. */
const EMIT_FIELDS = ['struct', 'smoke', 'fire', 'o2'] as const;

/** A floor tile with something to emit, and the field values that set its rates. */
interface Emitter {
  x: number;
  y: number;
  i: number;
  sv: number;
  fv: number;
  vm: number;
  air: number;
}

/** The region's floor tiles with smoke, fire or air venting into vacuum. */
function scanEmitters(tiles: ReturnType<typeof regionTiles>, vent: Map<number, number>): Emitter[] {
  const out: Emitter[] = [];
  // The scan hands out one chunk ref per row run: look its fields up once per run, not per tile.
  let at: unknown = null;
  let struct: ArrayLike<number> | undefined;
  let smoke: ArrayLike<number> | undefined;
  let fire: ArrayLike<number> | undefined;
  let o2: ArrayLike<number> | undefined;
  tiles.scan((x, y, i, ci, c) => {
    if (c !== at) {
      at = c;
      struct = tiles.data('struct', c);
      smoke = tiles.data('smoke', c);
      fire = tiles.data('fire', c);
      o2 = tiles.data('o2', c);
    }
    const k = struct?.[ci];
    if (k !== Struct.Floor && k !== Struct.Door) return;
    const sv = (smoke?.[ci] ?? 0) as number;
    const fv = (fire?.[ci] ?? 0) as number;
    const air = (o2?.[ci] ?? 0) as number;
    const vm = air > 0.5 ? (vent.get(i) ?? 0) : 0;
    if (sv < 18 && !(fv > 0) && !vm) return;
    out.push({ x, y, i, sv, fv, vm, air });
  });
  return out;
}

/** Field- and component-driven emitters: smoke, fire embers, venting air and ice, module sparks, welding sparks. */
export function createAtmosphere(world: World, particles: Particles, defs: ModuleDefs, host: AtmosphereHost): { update(dt: number): void } {
  const wasPowered = new Map<number, boolean>();
  /** Per region: which floor tiles vent which way (bit d: the tile in direction d is Space or rock ground), by struct revision. */
  const vents = new WeakMap<Grid, { rev: number; mask: Map<number, number> }>();
  const ventMask = (grid: Grid, tiles: ReturnType<typeof regionTiles>): Map<number, number> => {
    const rev = grid.revision('struct');
    const hit = vents.get(grid);
    if (hit && hit.rev === rev) return hit.mask;
    const mask = new Map<number, number>();
    tiles.scan((x, y, i, ci, c) => {
      const k = tiles.data('struct', c)?.[ci];
      if (k !== Struct.Floor && k !== Struct.Door) return;
      let m = 0;
      for (let d = 0; d < 4; d++) {
        const [dx, dy] = DIRS[d] as readonly [number, number];
        // the real tile (not the art kind, which shows asteroid rock as Space): air streams out only into vacuum,
        // Space or airless rock ground; rock mass is a wall
        const n = tiles.get('struct', x + dx, y + dy);
        if (n === Struct.Space || n === Struct.Ground) m |= 1 << d;
      }
      if (m) mask.set(i, m);
    });
    vents.set(grid, { rev, mask });
    return mask;
  };
  /** Per region: the floor tiles that emit (smoke, embers, venting air), as of the field revisions in `rev`. */
  const emitting = new WeakMap<Grid, { rev: number; vent: Map<number, number>; list: Emitter[] }>();
  const shipModules = createModuleIndex(world);
  return {
    update(dt) {
      const t = host.target();
      if (!t) return;
      const { grid } = t;
      const tiles = regionTiles(grid);
      const vent = ventMask(grid, tiles);
      // The emitting tiles change only with these fields: scan the region again only when a chunk's revision moves.
      let rev = 0;
      for (const c of tiles.chunks()) for (const f of EMIT_FIELDS) rev = (rev * 31 + tiles.src.chunkRevision(f, c.cx, c.cy)) % 2147483647;
      let hot = emitting.get(grid);
      if (!hot || hot.rev !== rev || hot.vent !== vent) {
        hot = { rev, vent, list: scanEmitters(tiles, vent) };
        emitting.set(grid, hot);
      }
      for (const { x, y, i, sv, fv, vm, air } of hot.list) {
        const cc = iso(x, y);
        if (sv >= 18) particles.emit(`s${i}`, SMOKE, cc.x, cc.y - 10 * S, 0.4 + (sv / 255) * 2.4, dt, 18);
        if (fv > 0) particles.emit(`e${i}`, EMBER, cc.x, cc.y - 6 * S, (fv / 255) * 5 + 0.6, dt, 14);
        if (vm) {
          for (let d = 0; d < 4; d++) {
            if (!(vm & (1 << d))) continue;
            const v = VENT[d] as (typeof VENT)[number];
            const rate = 3 + 7 * Math.min(1, air / 21);
            particles.emit(`va${i}.${d}`, v.air, cc.x, cc.y - 4 * S, rate, dt, 8);
            particles.emit(`vi${i}.${d}`, v.ice, cc.x, cc.y - 4 * S, rate * 0.25, dt, 8);
          }
        }
      }
      for (const id of shipModules(grid)) {
        const m = world.get(id, ModuleC);
        const def = m && defs[m.def];
        if (!m || !def || !grid.inBounds(m.x, m.y)) continue;
        const on = m.powered && m.enabled && m.hp > 0;
        const prev = wasPowered.get(id);
        wasPowered.set(id, on);
        const burst = prev === true && !on && m.enabled;
        const hurt = m.hp > 0 && m.hp < def.maxHp * 0.5;
        if (!burst && !hurt) continue;
        const tiles = footprintTiles(def, m.x, m.y, m.rot);
        let cx = 0;
        let cy = 0;
        for (const f of tiles) {
          const p = iso(f.x - grid.x0, f.y - grid.y0); // modules are in sector tiles, particles region-local
          cx += p.x / tiles.length;
          cy += p.y / tiles.length;
        }
        if (burst) particles.burst(SPARK, cx, cy - 14 * S, 10, 10);
        if (hurt) particles.emit(`m${id}`, SPARK, cx, cy - 14 * S, 1.5 + 2.5 * (1 - m.hp / (def.maxHp * 0.5)), dt, 12);
      }
      for (const id of world.query(CrewC, PositionC)) {
        const crew = world.get(id, CrewC);
        const pos = world.get(id, PositionC);
        if (!crew || !pos || shipIdAtTile(world, pos.x, pos.y) !== grid.id || crew.activity !== 'working') continue;
        const a = world.get(id, AssignmentC);
        const job = a && world.get(a.jobId, JobC);
        if (!job || !WELD_JOBS.has(job.kind)) continue;
        const p = iso(pos.x + (pos.toX - pos.x) * pos.progress - grid.x0, pos.y + (pos.toY - pos.y) * pos.progress - grid.y0);
        particles.emit(`w${id}`, WELD, p.x + 6 * S, p.y - 16 * S, 14, dt, 4);
      }
    },
  };
}
