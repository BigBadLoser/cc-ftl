import type { Sim } from '../sim';
import { Rng } from '../rng';
import { chunkKey, chunkOfId, galaxyGen } from './generator';
import { populate } from './roster';
import { pickWeighted } from './sector';
import { FRONTIER_RING, GENERATOR_VERSION } from './tuning';
import type { ChunkData, EdgeData, GalaxyState, NodeData, NodeState, SectorData } from './types';

/** The start node: the first node of the sector grown from cell (0, 0), pinned at the map origin. */
export const START_NODE = 's.0.0.n0';

export function newGalaxy(seed: number): GalaxyState {
  return {
    current: START_NODE, chunks: {}, discovered: {}, visited: {}, nodes: {}, rng: (seed ^ 0x6a1a7e5) >>> 0,
    nextArrival: 0, nextId: 1, jumps: 0, turn: 0, turnClock: 0, fleets: [], encounters: [], event: null, lastResult: null, nextFleet: 1, ports: {}, markets: {}, news: [], nextNews: 1, days: 0, travel: null, rev: 0,
  };
}

/** Run `fn` with the galaxy's own Rng and store its advanced state. */
export function withGalaxyRng<T>(g: GalaxyState, fn: (rng: Rng) => T): T {
  const rng = new Rng(g.rng);
  const out = fn(rng);
  g.rng = rng.getState();
  return out;
}

/** Lookup tables over the generated chunks. Derived, never saved; rebuilt when the chunk set changes. */
export interface GalaxyIndex {
  nodes: Map<string, NodeData>;
  sectors: Map<string, SectorData>;
  edges: Map<string, EdgeData>;
  /** Node id -> edges touching it whose other end is generated too, in ascending edge id order. */
  adjacent: Map<string, EdgeData[]>;
}

const indexes = new WeakMap<GalaxyState, { size: number; index: GalaxyIndex }>();

export function galaxyIndex(g: GalaxyState): GalaxyIndex {
  const size = Object.keys(g.chunks).length;
  const hit = indexes.get(g);
  if (hit && hit.size === size) return hit.index;
  const index: GalaxyIndex = { nodes: new Map(), sectors: new Map(), edges: new Map(), adjacent: new Map() };
  const keys = Object.keys(g.chunks).sort();
  for (const k of keys) {
    const c = g.chunks[k] as ChunkData;
    for (const n of c.nodes) index.nodes.set(n.id, n);
    for (const s of c.sectors) index.sectors.set(s.id, s);
  }
  for (const k of keys) {
    for (const e of (g.chunks[k] as ChunkData).edges) {
      if (index.edges.has(e.id) || !index.nodes.has(e.a) || !index.nodes.has(e.b)) continue;
      index.edges.set(e.id, e);
    }
  }
  for (const e of [...index.edges.values()].sort((p, q) => (p.id < q.id ? -1 : 1))) {
    for (const end of [e.a, e.b]) {
      const list = index.adjacent.get(end) ?? [];
      list.push(e);
      index.adjacent.set(end, list);
    }
  }
  indexes.set(g, { size, index });
  return index;
}

/** Generate a chunk if it is not there yet. Returns true when it was generated now. */
export function ensureChunk(sim: Sim, cx: number, cy: number): boolean {
  const key = chunkKey(cx, cy);
  if (sim.galaxy.chunks[key]) return false;
  const chunk = galaxyGen(sim.seed, sim.content.galaxy).chunk(cx, cy);
  sim.galaxy.chunks[key] = chunk;
  populate(sim, chunk);
  sim.galaxy.rev++;
  sim.events.emit({ type: 'galaxy.chunk', key });
  return true;
}

/** Generate the chunk holding a node id (and nothing else). */
export function ensureChunkOf(sim: Sim, id: string): void {
  const key = chunkOfId(id);
  if (!key) return;
  const [cx, cy] = key.split(',').map(Number) as [number, number];
  ensureChunk(sim, cx, cy);
}

/** The lazy frontier: generate every chunk within FRONTIER_RING of the node's chunk. */
export function ensureAround(sim: Sim, nodeId: string): void {
  const key = chunkOfId(nodeId);
  if (!key) return;
  const [cx, cy] = key.split(',').map(Number) as [number, number];
  for (let dy = -FRONTIER_RING; dy <= FRONTIER_RING; dy++) {
    for (let dx = -FRONTIER_RING; dx <= FRONTIER_RING; dx++) ensureChunk(sim, cx + dx, cy + dy);
  }
}

export const nodeOf = (sim: Sim, id: string): NodeData | undefined => galaxyIndex(sim.galaxy).nodes.get(id);
export const currentNode = (sim: Sim): NodeData | undefined => nodeOf(sim, sim.galaxy.current);

/** The node's mutable state, created from its generated contacts on first use. */
export function nodeState(sim: Sim, id: string): NodeState {
  const g = sim.galaxy;
  let s = g.nodes[id];
  if (!s) {
    const data = nodeOf(sim, id);
    const content = sim.content.galaxy;
    s = {
      entered: false,
      contacts: (data?.contacts ?? []).map((c) => {
        const shipgen = pickWeighted(content?.factions[c.faction]?.ships ?? [], (c.seed % 9973) / 9973) ?? '';
        return { id: g.nextId++, faction: c.faction, shipgen, seed: c.seed, depth: c.depth, since: 0 };
      }),
    };
    g.nodes[id] = s;
  }
  return s;
}

/** The persisted part of the galaxy: everything but the generated chunks, which are listed by key. */
export type GalaxySave = Omit<GalaxyState, 'chunks'> & {
  chunks: string[];
  /** GENERATOR_VERSION the chunk keys were generated under. */
  generatorVersion: number;
};

export function saveGalaxy(g: GalaxyState): GalaxySave {
  return { ...g, chunks: Object.keys(g.chunks).sort(), generatorVersion: GENERATOR_VERSION };
}

/**
 * Rebuild the state from a save, regenerating its chunks from the seed. Throws when the save was made under another
 * generator version: the same chunk keys would give a different galaxy, so such a save is refused (no migrations).
 */
export function loadGalaxy(sim: Sim, save: GalaxySave): GalaxyState {
  if (save.generatorVersion !== GENERATOR_VERSION) {
    throw new Error(`Galaxy generator version ${String(save.generatorVersion)} is not ${GENERATOR_VERSION}; the galaxy cannot be regenerated`);
  }
  const rest: Omit<GalaxySave, 'generatorVersion'> & { generatorVersion?: number } = { ...save };
  delete rest.generatorVersion;
  const gen = galaxyGen(sim.seed, sim.content.galaxy);
  const chunks: Record<string, ChunkData> = {};
  for (const key of save.chunks) {
    const [cx, cy] = key.split(',').map(Number) as [number, number];
    chunks[key] = gen.chunk(cx, cy);
  }
  return { ...rest, chunks };
}
