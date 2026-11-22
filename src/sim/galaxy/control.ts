import type { Sim } from '../sim';
import { galaxyIndex } from './state';
import type { NodeData, StructureRef } from './types';

/**
 * Who holds a place. Territory is generated from the seed, but a sector can change hands (coarse.ts), so nothing reads `genFaction` / `genOwner`
 * to mean "who owns this": every reader asks here. `GalaxyState.control` holds only the sectors that differ from their generated state.
 */

/** The faction that holds a sector now (null = nobody). An unknown sector has none. */
export function sectorOwner(sim: Sim, sectorId: string): string | null {
  const c = sim.galaxy.control[sectorId];
  if (c) return c.owner;
  return galaxyIndex(sim.galaxy).sectors.get(sectorId)?.genFaction ?? null;
}

/** The faction that holds the territory a node lies in (null = open space). */
export const nodeOwner = (sim: Sim, node: NodeData): string | null => sectorOwner(sim, node.sector);

/**
 * Who owns a structure at a node now. A station owned by its sector's generated faction follows the sector's owner; everything else (a
 * civilian trader in open space, a black market, a derelict, a structure of another faction) keeps its generated owner.
 */
export function structureOwner(sim: Sim, node: NodeData, s: StructureRef): string | null {
  if (s.genOwner !== null && s.genOwner === node.genFaction) return nodeOwner(sim, node);
  return s.genOwner;
}

/** The faction that holds the territory at a node id (null = open space, or an unknown node). */
export function nodeOwnerAt(sim: Sim, nodeId: string): string | null {
  const n = galaxyIndex(sim.galaxy).nodes.get(nodeId);
  return n ? nodeOwner(sim, n) : null;
}
