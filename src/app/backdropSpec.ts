import { currentNode, galaxyIndex, type Sim } from '../sim';
import type { BackdropSpec } from '../render/backdrop';
import { strHash } from '../render/backdropPlan';
import { NEBULA_SAMPLES, nebulaAround } from './starmapNebula';

/** What the space behind the ships is made of at the current node: a seed, the galaxy's nebula density here, the sector's central body. */
export function backdropSpecOf(sim: Sim): BackdropSpec {
  const node = currentNode(sim);
  const seed = strHash(`${sim.seed}:${node?.id ?? 'none'}`);
  let density = 0;
  if (node) {
    const tiles = nebulaAround(sim, node.x, node.y);
    const mid = tiles[Math.floor(tiles.length / 2)];
    if (mid) {
      const cx = Math.floor(((node.x - mid.x) / mid.size) * mid.n);
      const cy = Math.floor(((node.y - mid.y) / mid.size) * mid.n);
      let sum = 0;
      let n = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const x = Math.max(0, Math.min(NEBULA_SAMPLES - 1, cx + dx));
        const y = Math.max(0, Math.min(NEBULA_SAMPLES - 1, cy + dy));
        sum += mid.data[y * mid.n + x]! / 255;
        n++;
      }
      density = sum / n;
    }
  }
  const body = node ? galaxyIndex(sim.galaxy).sectors.get(node.sector)?.body?.kind ?? null : null;
  return { seed, density, body, bodyHash: strHash(node?.sector ?? '') };
}
