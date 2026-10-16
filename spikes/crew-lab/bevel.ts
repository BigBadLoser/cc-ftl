import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import type { VoxelModel } from '../../src/render/voxel/model';

type V3 = [number, number, number];
const DIRS: readonly V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/**
 * Non-greedy voxel mesher with chamfered convex edges. Every exposed face is pulled in by `c` voxels along
 * its convex edges, and a 45-degree strip (plus a corner triangle) closes the gap to the neighbouring face.
 * Concave and flat joins stay sharp, so the result keeps the voxel grid but loses the razor edges.
 */
export function bevelMesh(m: VoxelModel, colors: readonly Color[], scale: number, c = 0.3): BufferGeometry {
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  const solid = (p: V3, d: V3 = [0, 0, 0]): boolean => m.get(p[0] + d[0], p[1] + d[1], p[2] + d[2]) !== 0;

  /** Lattice corner L of face (p, i), pulled in along each convex in-plane edge it touches. */
  const corner = (p: V3, i: number, L: V3): V3 => {
    const a = i >> 1;
    const out: V3 = [...L];
    for (const ax of [(a + 1) % 3, (a + 2) % 3]) {
      const s = L[ax]! > p[ax]! ? 1 : -1;
      const q: V3 = [...p];
      q[ax] += s;
      if (!solid(q) && !solid(q, DIRS[i]!)) out[ax] -= s * c;
    }
    return out;
  };

  const tri = (a: V3, b: V3, d: V3, ref: V3, rgb: Color): void => {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const cr = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    const flip = cr[0]! * ref[0] + cr[1]! * ref[1] + cr[2]! * ref[2] < 0;
    const len = Math.hypot(...ref);
    for (const v of flip ? [a, d, b] : [a, b, d]) {
      pos.push(v[0] * scale, v[1] * scale, v[2] * scale);
      nor.push(ref[0] / len, ref[1] / len, ref[2] / len);
      col.push(rgb.r, rgb.g, rgb.b);
    }
  };
  const quad = (a: V3, b: V3, d: V3, e: V3, ref: V3, rgb: Color): void => {
    tri(a, b, d, ref, rgb);
    tri(a, d, e, ref, rgb);
  };
  const add = (...v: V3[]): V3 => [v.reduce((s, x) => s + x[0], 0), v.reduce((s, x) => s + x[1], 0), v.reduce((s, x) => s + x[2], 0)];

  for (let z = 0; z < m.sz; z++)
    for (let y = 0; y < m.sy; y++)
      for (let x = 0; x < m.sx; x++) {
        const idx = m.get(x, y, z);
        if (!idx) continue;
        const p: V3 = [x, y, z];
        const rgb = colors[idx] as Color;
        for (let i = 0; i < 6; i++) {
          if (solid(p, DIRS[i]!)) continue;
          const a = i >> 1, u = (a + 1) % 3, w = (a + 2) % 3;
          const base: V3 = [...p];
          if (DIRS[i]![a]! > 0) base[a] += 1;
          const Ls = ([[0, 0], [1, 0], [1, 1], [0, 1]] as const).map(([du, dv]) => {
            const L: V3 = [...base];
            L[u] += du;
            L[w] += dv;
            return L;
          });
          const P = Ls.map((L) => corner(p, i, L));
          quad(P[0]!, P[1]!, P[2]!, P[3]!, DIRS[i]!, rgb);
          // Edge k joins corners k and k+1; [axis, side] says which neighbour it borders.
          const edges: [number, number][] = [[w, -1], [u, 1], [w, 1], [u, -1]];
          const owner = edges.map(([ax, s]) => {
            const q: V3 = [...p];
            q[ax] += s;
            return solid(q) || solid(q, DIRS[i]!) ? -1 : ax * 2 + (s > 0 ? 0 : 1);
          });
          for (let k = 0; k < 4; k++) {
            const j = owner[k]!;
            if (j <= i) continue;
            const L0 = Ls[k]!, L1 = Ls[(k + 1) % 4]!;
            quad(P[k]!, P[(k + 1) % 4]!, corner(p, j, L1), corner(p, j, L0), add(DIRS[i]!, DIRS[j]!), rgb);
          }
          for (let k = 0; k < 4; k++) {
            const j1 = owner[(k + 3) % 4]!, j2 = owner[k]!;
            if (j1 <= i || j2 <= i) continue;
            tri(P[k]!, corner(p, j1, Ls[k]!), corner(p, j2, Ls[k]!), add(DIRS[i]!, DIRS[j1]!, DIRS[j2]!), rgb);
          }
        }
      }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}
