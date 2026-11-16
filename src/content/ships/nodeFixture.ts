import { START_NODE, galaxyIndex, nodeOf, type Sim } from '../../sim';

/**
 * The first neighbour of a node (by id) that holds no structure: nothing is populated there on arrival, so a test about archives, cuts or
 * jumps sees an empty node whatever the generator's node content table rolled beside the start.
 */
export function emptyNeighbour(sim: Sim, from: string = START_NODE): string {
  const ids = (galaxyIndex(sim.galaxy).adjacent.get(from) ?? []).map((e) => (e.a === from ? e.b : e.a)).sort();
  const id = ids.find((n) => !nodeOf(sim, n)?.structures.length);
  if (!id) throw new Error(`no empty node beside ${from}`);
  return id;
}
