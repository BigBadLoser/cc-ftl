import type { Sim } from '../sim';
import { COARSE_TURNS, FLIP_COOLDOWN } from './tuningCoarse';
import { galaxyIndex } from './state';
import type { NodeData, SectorControl, StructureRef } from './types';

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

/** The owner of every generated sector (what `sectorOwner` answers for each, in one pass over the index). */
export function sectorOwners(sim: Sim): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const s of galaxyIndex(sim.galaxy).sectors.values()) out.set(s.id, sim.galaxy.control[s.id] ? (sim.galaxy.control[s.id] as SectorControl).owner : s.genFaction);
  return out;
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

/** The sector's control entry, made (as its generated owner, no pressure) when it has none. Callers write through it and then `tidyControl`. */
export function controlOf(sim: Sim, sectorId: string): SectorControl {
  return (sim.galaxy.control[sectorId] ??= { owner: galaxyIndex(sim.galaxy).sectors.get(sectorId)?.genFaction ?? null, since: 0 });
}

/**
 * Drop the sector's entry when it says nothing the generated state does not (its generated owner, no pressure): `control` holds only what differs.
 * An entry that records a flip stays while the sector cools down (coarse.ts), so a sector cannot flip back at once.
 */
export function tidyControl(sim: Sim, sectorId: string): void {
  const c = sim.galaxy.control[sectorId];
  if (!c || c.pressure || c.owner !== (galaxyIndex(sim.galaxy).sectors.get(sectorId)?.genFaction ?? null)) return;
  if (c.since === 0 || sim.galaxy.turn - c.since >= FLIP_COOLDOWN * COARSE_TURNS) delete sim.galaxy.control[sectorId];
}
