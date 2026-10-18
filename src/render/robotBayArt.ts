import type { World } from '../sim/ecs';
import { CrewC, JobC } from '../sim/crew/components';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { FRONT_DZ, type ModuleLayer } from './moduleArt';

/** Assembly loop: 8 frames at 8 fps. */
const ASSEMBLY_FPS = 8;
const ASSEMBLY_FRAMES = 8;

/** The robot role being assembled in a bay (from its assemble job), or null. */
export function assemblingRole(world: World, bay: number): string | null {
  for (const j of world.query(JobC)) {
    const job = world.get(j, JobC);
    if (job?.kind === 'assemble' && job.target === bay && job.assemble) return job.assemble.role;
  }
  return null;
}

/**
 * Sprite layers of a robot bay (`module.robot_bay.r<rot>`): empty; `.charging[.drone]` plus its `.front` overlay while its
 * robot sits in the cradle (the hover drone, role.robot_repair, hangs from the clamp); the 8-frame
 * `.assembling.<worker|repair|security>.f<n>` loop while a robot is being built.
 */
export function robotBayLayers(world: World, id: number, m: Module, def: ModuleDef, now: number): ModuleLayer[] {
  const a = def.asset;
  const r = `.r${m.rot}`;
  const role = assemblingRole(world, id);
  if (role) {
    const f = Math.floor((now / 1000) * ASSEMBLY_FPS) % ASSEMBLY_FRAMES;
    return [{ chain: [`${a}${r}.assembling.${role.replace(/^role\.robot_/, '')}.f${f}`, `${a}${r}`, a], key: a, tiles: 'all' }];
  }
  const robot = m.reservedBy ? world.get(m.reservedBy, CrewC) : undefined;
  if (robot && robot.activity === 'charging') {
    const base = `${a}${r}.charging${robot.role === 'role.robot_repair' ? '.drone' : ''}`;
    return [
      { chain: [base, `${a}${r}`, a], key: a, tiles: 'all' },
      { chain: [`${base}.front`], key: `${a}.front`, tiles: 'all', dz: FRONT_DZ },
    ];
  }
  return [{ chain: [`${a}${r}`, a], key: a, tiles: 'all' }];
}
