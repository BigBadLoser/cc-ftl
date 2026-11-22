import type { Sim } from '../sim';
import { chunkOfId } from './generator';
import { COARSE_TURNS, CONTACT_GAP, FLIP_COOLDOWN, SIM_RING } from './tuningCoarse';
import { galaxyIndex, type GalaxyIndex } from './state';
import type { NodeData, SectorControl, SectorData, StructureRef } from './types';

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

const areaCache = new WeakMap<GalaxyIndex, Map<string, Set<string>>>();

/**
 * The sectors the coarse tick simulates: those in the chunks within SIM_RING of the chunk the player is in (cached per index and chunk). A pure function of where the
 * player is, so the same wherever the player has been; the rest of the explored map stands as it was left.
 */
export function simulatedSectors(sim: Sim): Set<string> {
  const index = galaxyIndex(sim.galaxy);
  const here = chunkOfId(sim.galaxy.current) ?? '0,0';
  let byChunk = areaCache.get(index);
  if (!byChunk) areaCache.set(index, (byChunk = new Map()));
  let area = byChunk.get(here);
  if (area) return area;
  const [cx, cy] = here.split(',').map(Number) as [number, number];
  area = new Set();
  for (const s of index.sectors.values()) {
    const [x, y] = s.chunk.split(',').map(Number) as [number, number];
    if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= SIM_RING) area.add(s.id);
  }
  byChunk.set(here, area);
  return area;
}

const neighboursCache = new WeakMap<GalaxyIndex, Map<string, string[]>>();

/**
 * Sector -> the sectors it borders, sorted (cached per galaxy index): joined by a hyperlane, or close enough that their space touches (within CONTACT_GAP of
 * each other's edge). Territory is blobs of sectors with free space between them, and gates are few, so lanes alone would leave almost no fronts.
 */
export function sectorNeighbours(index: GalaxyIndex): Map<string, string[]> {
  let m = neighboursCache.get(index);
  if (m) return m;
  m = new Map();
  const link = (x: string, y: string): void => {
    for (const [p, q] of [[x, y], [y, x]] as const) {
      const list = m?.get(p) ?? [];
      if (!list.includes(q)) list.push(q);
      m?.set(p, list);
    }
  };
  for (const e of index.edges.values()) {
    const a = index.nodes.get(e.a)?.sector;
    const b = index.nodes.get(e.b)?.sector;
    if (e.kind === 'hyperlane' && a && b && a !== b) link(a, b);
  }
  // Bucketed by a grid as wide as the longest reach of a pair, so each sector only meets its own and the eight surrounding buckets.
  const all = [...index.sectors.values()];
  const cell = 2 * all.reduce((r, s) => Math.max(r, s.r), 0) + CONTACT_GAP;
  const grid = new Map<string, SectorData[]>();
  for (const s of all) {
    const k = `${Math.floor(s.x / cell)},${Math.floor(s.y / cell)}`;
    const list = grid.get(k);
    if (list) list.push(s);
    else grid.set(k, [s]);
  }
  for (const a of all) {
    const gx = Math.floor(a.x / cell);
    const gy = Math.floor(a.y / cell);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const b of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
          if (a.id < b.id && Math.hypot(a.x - b.x, a.y - b.y) <= a.r + b.r + CONTACT_GAP) link(a.id, b.id);
        }
      }
    }
  }
  for (const list of m.values()) list.sort();
  neighboursCache.set(index, m);
  return m;
}
