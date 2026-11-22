import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { JobC } from '../sim/crew/components';
import { ModuleC, type Module } from '../sim/modules/components';
import { footprintTiles } from '../sim/modules/footprint';
import { bedEnds, bedOfRig } from '../sim/modules/rig';
import type { ModuleDef } from '../sim/registry';
import { FRONT_DZ, HOLO_DZ, frameCount, type ModuleLayer, type ModuleLook } from './moduleArt';
import { RIG_PHASES, frameId, rigFrame, rigTick, type RigCounts } from './rigFrame';
import { TICK_HZ } from '../sim/time';

/**
 * A surgical rig's layers (#311): the body `<asset>[.r{n}].{idle,active}` (a stand-in from render/assets/fallback.ts until its sheets land) and the front
 * overlay `<asset>.front[.r{n}].{idle,active}` (the arms and lamp that reach over the bed; while operating, the phase's frame from the job's progress, render/rigFrame.ts, and the console hologram `<asset>.holo.r{n}`), drawn at the rig but sorted at the front-most
 * of the bed's tiles and its own (`frontAt`), over the bed, its patient and the column (`sortAt`). `.active` while an operation is in progress at that bed. A missing overlay draws nothing.
 * The rig stands on either long side of the bed and its halo reaches toward the bed's head: on one side that is the art's local +u, on the other the
 * mirrored set `<asset>.m...` (tools/blender/sprites/surgery_rig_family.py) draws it (`mirror`).
 */
export interface RigView {
  /** Where the front overlay sorts, in the module's frame: the front-most of the bed's tiles and the rig's own, so the boom and its counterweight draw over
   * both the patient and the column (the overlay is rendered with the body as holdout). Null when no bed (the rig serves nothing). */
  frontAt: { x: number; y: number } | null;
  /** An operation is in progress at that bed. */
  active: boolean;
  /** The bed's head lies along the rig's local -u: the mirrored art (`<asset>.m`) reaches toward it. */
  mirror?: boolean;
  /** The surgery job's progress and work (sim ticks), 0 when none: the operation's frame follows them (render/rigFrame.ts). */
  progress: number;
  work: number;
}

export function rigLayers(m: Module, def: ModuleDef, rig: RigView | undefined, look?: ModuleLook): ModuleLayer[] {
  const a = rig?.mirror ? `${def.asset}.m` : def.asset;
  const r = `.r${m.rot}`;
  const s = rig?.active ? '.active' : '.idle';
  const body: ModuleLayer = { chain: [`${a}${r}${s}`, `${a}${r}`, `${a}${s}`, a, ...(a === def.asset ? [] : [def.asset])], key: a, tiles: 'all' };
  if (!rig?.frontAt) return [body];
  const front = [`${a}.front${r}${s}`, `${a}.front${r}`, `${a}.front${s}`, `${a}.front`];
  const out: ModuleLayer[] = [body, { chain: front, key: `${a}.front`, tiles: 'all', dz: FRONT_DZ, sortAt: rig.frontAt, optional: true }];
  // The operation's frame from the job's progress, over the static front; the console hologram loops on its own clock.
  if (!rig.active || !look || !look.has(`${a}.front${r}.deploy`)) return out;
  const frontBase = `${a}.front${r}`;
  const counts = Object.fromEntries(RIG_PHASES.map((p) => [p, frameCount(look.has, `${frontBase}.${p}`)])) as unknown as RigCounts;
  const f = rigFrame(rig.progress, rig.work, counts);
  if (f.phase !== 'idle') out[1] = { ...(out[1] as ModuleLayer), chain: [frameId(`${frontBase}.${f.phase}`, f.frame), ...front] };
  const holo = `${a}.holo${r}`, n = frameCount(look.has, holo);
  out.push({ chain: [frameId(holo, rigTick(rig.progress) % n), holo], key: `${a}.holo`, tiles: 'all', dz: HOLO_DZ, optional: true, glowOver: true });
  return out;
}

/** Does a rig turned `rot` draw its mirrored art for bed `bed`: does the bed's head lie along the art's local -u (modkit.K: +u is +x, +y, -x, -y by rotation)? */
export function rigMirror(rot: number, bedDef: ModuleDef, bed: { x: number; y: number; rot: number }): boolean {
  const u = ([[1, 0], [0, 1], [-1, 0], [0, -1]] as const)[((rot % 4) + 4) % 4] as readonly [number, number];
  const { head, foot } = bedEnds(bedDef, bed.x, bed.y, bed.rot);
  return u[0] * (head.x - foot.x) + u[1] * (head.y - foot.y) < 0;
}

/** What rig `id`'s art reads from the world, with the bed's front tile region-local (minus the grid origin, as the module's own tile is). */
export function rigView(world: World, defs: Readonly<Record<string, ModuleDef>>, grid: Grid, id: number): RigView {
  const bed = bedOfRig(world, defs, grid, id);
  const b = world.get(bed, ModuleC);
  const def = b && defs[b.def];
  if (!b || !def) return { frontAt: null, active: false, progress: 0, work: 0 };
  const own = world.get(id, ModuleC);
  const mirror = rigMirror(own?.rot ?? 0, def, b);
  const t = [...footprintTiles(def, b.x, b.y, b.rot), ...(own ? [own] : [])].reduce((a, c) => (c.x + c.y > a.x + a.y ? c : a), { x: b.x, y: b.y });
  let active = false, progress = 0, work = 0;
  for (const j of world.query(JobC)) {
    const job = world.get(j, JobC);
    if (job?.kind === 'surgery' && job.bed === bed && job.progress > 0) { active = true; progress = job.progress; work = job.work; }
  }
  return { frontAt: { x: t.x - grid.x0, y: t.y - grid.y0 }, active, progress, work, mirror };
}

/** The rig's view as a memo input (render/moduleMemo.ts `sameInputs`). */
export const rigInputs = (v: RigView | undefined): string =>
  (v ? `|${v.frontAt ? `${v.frontAt.x},${v.frontAt.y}` : '-'}${v.mirror ? 'm' : ''}|${v.active ? `${rigTick(v.progress)}/${Math.floor(v.work / TICK_HZ)}` : 0}` : '');
