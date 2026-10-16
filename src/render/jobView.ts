import { BoxGeometry, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial } from 'three';
import type { World } from '../sim/ecs';
import { JobC } from '../sim/crew/components';
import type { Grid } from '../sim/grid';
import { Struct } from '../sim/structure';
import { WALL_FULL_H } from './models/tiles';
import { VOXEL_SIZE } from './voxel/model';

export interface JobViewHost {
  target(): { grid: Grid; offsetX: number; offsetZ: number } | null;
}

export interface JobView {
  group: Group;
  update(): void;
  dispose(): void;
}

interface Ghost {
  root: Group;
  fill: Mesh;
  edges: LineSegments;
}

const unit = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const edgeGeo = new EdgesGeometry(unit);
const glowMat = (c: number, a: number) => {
  const m = new MeshBasicMaterial({ color: c, transparent: true, opacity: a, depthWrite: false, toneMapped: false });
  m.color.multiplyScalar(1.4);
  return m;
};
const buildFill = glowMat(0x22d3ee, 0.3);
const decFill = glowMat(0xff3b3b, 0.12);
const buildEdge = new LineBasicMaterial({ color: 0x22d3ee, toneMapped: false, transparent: true, opacity: 0.9 });
const decEdge = new LineBasicMaterial({ color: 0xff4040, toneMapped: false, transparent: true, opacity: 0.9 });

const WALL_H = WALL_FULL_H * VOXEL_SIZE;
/** Footprint [w, h, d] of a struct kind's ghost box. */
function dims(kind: number): [number, number, number] {
  if (kind === Struct.Wall) return [1, WALL_H, 1];
  if (kind === Struct.Door) return [0.95, WALL_H * 0.8, 0.3];
  return [1, 0.06, 1];
}

export function createJobView(world: World, host: JobViewHost): JobView {
  const group = new Group();
  const pool: Ghost[] = [];

  function ghost(i: number): Ghost {
    let g = pool[i];
    if (!g) {
      const root = new Group();
      const fill = new Mesh(unit, buildFill);
      const edges = new LineSegments(edgeGeo, buildEdge);
      fill.renderOrder = 5;
      root.add(fill, edges);
      group.add(root);
      pool[i] = g = { root, fill, edges };
    }
    return g;
  }

  return {
    group,
    update() {
      const t = host.target();
      group.visible = t !== null;
      if (!t) return;
      group.position.set(t.offsetX, 0, t.offsetZ);
      let n = 0;
      for (const id of world.query(JobC)) {
        const job = world.get(id, JobC);
        if (!job || job.gridId !== t.grid.id || !t.grid.inBounds(job.x, job.y)) continue;
        const build = job.kind === 'build';
        const [w, h, d] = dims(build ? job.struct : t.grid.get('struct', job.x, job.y));
        const g = ghost(n++);
        g.root.visible = true;
        g.root.position.set(job.x + 0.5, 0, job.y + 0.5);
        g.root.scale.set(w, h, d);
        const frac = job.work > 0 ? Math.min(1, job.progress / job.work) : 0;
        const fillFrac = build ? Math.max(0.06, frac) : 1;
        g.fill.scale.set(0.96, fillFrac, 0.96);
        g.fill.material = build ? buildFill : decFill;
        g.edges.material = build ? buildEdge : decEdge;
      }
      for (let i = n; i < pool.length; i++) (pool[i] as Ghost).root.visible = false;
    },
    dispose() {
      group.clear();
      pool.length = 0;
    },
  };
}
