import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import type { VoxelModel } from './model';
import { PALETTE } from './palette';

export interface MeshResult {
  solid: BufferGeometry | null;
  emissive: BufferGeometry | null;
  /** Total quads emitted (both geometries). */
  quads: number;
}

interface Buf {
  pos: number[];
  nor: number[];
  col: number[];
  idx: number[];
}

const newBuf = (): Buf => ({ pos: [], nor: [], col: [], idx: [] });

/** Linear-space RGB per palette index. */
const LINEAR = PALETTE.map((e) => {
  const c = new Color(e.color);
  return [c.r, c.g, c.b] as const;
});

function toGeometry(b: Buf): BufferGeometry | null {
  if (!b.idx.length) return null;
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(b.nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(b.col, 3));
  g.setIndex(b.idx);
  return g;
}

/**
 * Greedy-mesh a voxel model. Per face direction, coplanar neighbouring faces of the same palette
 * index merge into rectangles; faces touching another voxel are culled. Output is in world units
 * (voxel coordinates times `scale`), emissive palette entries going to their own geometry.
 * No ambient occlusion: keeps merging maximal.
 */
export function meshModel(model: VoxelModel, scale: number): MeshResult {
  const dims = [model.sx, model.sy, model.sz];
  const solid = newBuf();
  const emissive = newBuf();
  let quads = 0;

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const du = dims[u] as number;
    const dv = dims[v] as number;
    const mask = new Uint8Array(du * dv);
    const at = (a: number, b: number, c: number): number => {
      const p = [0, 0, 0];
      p[d] = a;
      p[u] = b;
      p[v] = c;
      return model.get(p[0] as number, p[1] as number, p[2] as number);
    };

    for (const sign of [1, -1]) {
      for (let s = 0; s < (dims[d] as number); s++) {
        for (let j = 0; j < dv; j++)
          for (let i = 0; i < du; i++) {
            const c = at(s, i, j);
            mask[i + du * j] = c && !at(s + sign, i, j) ? c : 0;
          }
        for (let j = 0; j < dv; j++) {
          for (let i = 0; i < du; ) {
            const c = mask[i + du * j] as number;
            if (!c) { i++; continue; }
            let w = 1;
            while (i + w < du && mask[i + w + du * j] === c) w++;
            let h = 1;
            outer: while (j + h < dv) {
              for (let k = 0; k < w; k++) if (mask[i + k + du * (j + h)] !== c) break outer;
              h++;
            }
            for (let jj = 0; jj < h; jj++) for (let ii = 0; ii < w; ii++) mask[i + ii + du * (j + jj)] = 0;
            emit(PALETTE[c]?.emissive ? emissive : solid, c, d, u, v, sign, s + (sign > 0 ? 1 : 0), i, j, w, h);
            quads++;
            i += w;
          }
        }
      }
    }
  }

  function emit(
    b: Buf, c: number, d: number, u: number, v: number, sign: number, plane: number,
    i: number, j: number, w: number, h: number,
  ): void {
    const base = b.pos.length / 3;
    const corners = sign > 0
      ? [[0, 0], [w, 0], [w, h], [0, h]]
      : [[0, 0], [0, h], [w, h], [w, 0]];
    const n = [0, 0, 0];
    n[d] = sign;
    const rgb = LINEAR[c] as readonly [number, number, number];
    for (const [a, bb] of corners as [number, number][]) {
      const p = [0, 0, 0];
      p[d] = plane * scale;
      p[u] = (i + a) * scale;
      p[v] = (j + bb) * scale;
      b.pos.push(p[0] as number, p[1] as number, p[2] as number);
      b.nor.push(n[0] as number, n[1] as number, n[2] as number);
      b.col.push(rgb[0], rgb[1], rgb[2]);
    }
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  return { solid: toGeometry(solid), emissive: toGeometry(emissive), quads };
}
