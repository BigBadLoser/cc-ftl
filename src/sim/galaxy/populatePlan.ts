import type { OutpostKind, OutpostStyle } from '../outposts/gen';
import type { StationSize } from '../shipgen/stationTypes';
import type { Sim } from '../sim';
import type { BuildJob } from '../stations/buildMemo';
import { portsAt } from './portIndex';
import { sizeOf, stationKindOf, structureSeed } from './populateSpawn';
import type { Port } from './ports';
import { nodeOf } from './state';

/**
 * What each of a node's structures becomes when the node is populated (populate.ts), decided from the galaxy seed, the node and content alone: no sim
 * state is read or written, so it answers for any generated node, the current one or one on the route ahead. `populateNode` makes the structures from
 * this list, and `nodeBuildJobs` lists the slow builds in it (stations and outposts) so they can be made ahead, off the sim thread (#538).
 */

export const SALT = { place: 81, station: 91, field: 92, outpost: 93, derelict: 94, dug: 95, cargo: 96 } as const;

/** An outpost on a big asteroid, as `generateOutpost` makes it. */
export interface OutpostPlanned { style: OutpostStyle; kind: OutpostKind; seed: number }

/** One structure of a node (index `i` in its structures) and what it becomes. */
export type StructurePlan = { i: number; port: Port | undefined } & (
  | { type: 'station'; kind: string; size: StationSize; seed: number }
  | { type: 'outpost'; outpost: OutpostPlanned }
  | { type: 'field'; structure: string; seed: number; outpost?: OutpostPlanned }
  | { type: 'cargo'; seed: number }
  | { type: 'derelict'; nest: boolean; seed: number }
);

/** The node's structures in order, each with what it becomes. Empty for a node not generated or without galaxy content. */
export function planNode(sim: Sim, id: string): StructurePlan[] {
  const content = sim.content.galaxy;
  const node = nodeOf(sim, id);
  if (!content || !node) return [];
  const ports = new Map<number, Port>(portsAt(sim, id).map((p) => [Number(p.id.slice(p.id.indexOf('#') + 1)), p]));
  const hasField = node.structures.some((s) => content.structures[s.def]?.kind === 'asteroids');
  const out: StructurePlan[] = [];
  node.structures.forEach((s, i) => {
    const def = content.structures[s.def];
    if (!def) return;
    const port = ports.get(i);
    if (def.kind === 'station') {
      const pirate = content.factions[s.owner ?? '']?.kind === 'pirates';
      if (port?.kind === 'den' && hasField) {
        // A den among the rocks is dug into a big asteroid and hidden there.
        out.push({ i, port, type: 'outpost', outpost: { style: 'dug', kind: 'pirate', seed: structureSeed(sim, id, i, SALT.dug) } });
      } else {
        const kind = stationKindOf(sim, port, def.station === 'military', pirate, def.station === 'research');
        out.push({ i, port, type: 'station', kind, size: sizeOf(port), seed: structureSeed(sim, id, i, SALT.station) });
      }
    } else if (def.kind === 'asteroids') {
      const outpost = port?.kind === 'outpost' ? { style: 'surface' as const, kind: 'mining' as const, seed: structureSeed(sim, id, i, SALT.outpost) } : undefined;
      out.push({ i, port, type: 'field', structure: s.def, seed: structureSeed(sim, id, i, SALT.field), ...(outpost ? { outpost } : {}) });
    } else if (def.kind === 'cargo') {
      out.push({ i, port, type: 'cargo', seed: structureSeed(sim, id, i, SALT.cargo) });
    } else {
      out.push({ i, port, type: 'derelict', nest: port?.kind === 'nest', seed: structureSeed(sim, id, i, SALT.derelict) });
    }
  });
  return out;
}

/** The station and outpost builds populating the node makes, in structure order: the slow part of a first entry, which a worker can make ahead. */
export function nodeBuildJobs(sim: Sim, id: string): BuildJob[] {
  const jobs: BuildJob[] = [];
  for (const p of planNode(sim, id)) {
    if (p.type === 'station') jobs.push({ type: 'station', kind: p.kind, size: p.size, seed: p.seed });
    else if (p.type === 'outpost') jobs.push({ type: 'outpost', ...p.outpost });
    else if (p.type === 'field' && p.outpost) jobs.push({ type: 'outpost', ...p.outpost });
  }
  return jobs;
}
