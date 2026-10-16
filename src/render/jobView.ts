import { Sprite } from "pixi.js";
import type { World } from "../sim/ecs";
import { JobC } from "../sim/crew/components";
import type { Grid } from "../sim/grid";
import { Struct } from "../sim/structure";
import type { Atlas } from "./assets/loader";
import { depthKey, iso } from "./iso";
import type { Layers } from "./layers";
import {
  floorChain,
  wallPieces,
  type Chain,
  type KindAt,
} from "./tiles";

export interface JobViewHost {
  target(): { grid: Grid } | null;
}

export interface JobView {
  update(): void;
  dispose(): void;
}

const BUILD = 0x22d3ee;
const DECON = 0xff3b3b;

/** Blueprints: the target tile's own sprite, tinted cyan (build, alpha rises with progress) or red (deconstruct). */
export function createJobView(
  world: World,
  atlas: Atlas,
  L: Layers,
  host: JobViewHost,
): JobView {
  const pool: Sprite[] = [];
  let used = 0;

  const sprite = (): Sprite => {
    let s = pool[used];
    if (!s) {
      s = new Sprite();
      L.sorted.addChild(s);
      pool[used] = s;
    }
    used++;
    s.visible = true;
    return s;
  };

  function draw(
    chains: Chain[],
    x: number,
    y: number,
    tint: number,
    alpha: number,
    key: number,
  ): void {
    for (const chain of chains) {
      const a = atlas.firstOf(chain);
      if (!a) continue;
      const s = sprite();
      const p = iso(x, y);
      s.texture = a.tex;
      s.position.set(Math.round(p.x - a.ax), Math.round(p.y - a.ay));
      s.tint = tint;
      s.alpha = alpha;
      s.zIndex = key;
    }
  }

  return {
    update() {
      const t = host.target();
      used = 0;
      if (t) {
        const { grid } = t;
        const jobs = [...world.query(JobC)].flatMap((id) => {
          const j = world.get(id, JobC);
          return j && j.gridId === grid.id && grid.inBounds(j.x, j.y)
            ? [j]
            : [];
        });
        // Pending walls and doors count as neighbours so a drawn line gets the right orientation.
        const pending = new Map<number, number>();
        for (const j of jobs)
          if (j.kind === "build") pending.set(j.y * grid.width + j.x, j.struct);
        const kindAt: KindAt = (x, y) => {
          if (!grid.inBounds(x, y)) return Struct.Space;
          const p = pending.get(y * grid.width + x);
          return p === Struct.Wall || p === Struct.Door
            ? p
            : grid.get("struct", x, y);
        };
        for (const j of jobs) {
          const build = j.kind === "build";
          const kind = build ? j.struct : grid.get("struct", j.x, j.y);
          const frac = j.work > 0 ? Math.min(1, j.progress / j.work) : 0;
          const tint = build ? BUILD : DECON;
          const alpha = build ? 0.3 + 0.5 * frac : 0.65;
          const key = depthKey(j.x, j.y) + 0.02;
          if (kind === Struct.Floor)
            draw([floorChain(j.x, j.y)], j.x, j.y, tint, alpha, key - 0.9);
          else if (kind === Struct.Wall || kind === Struct.Door) {
            for (const pc of wallPieces(kindAt, j.x, j.y, kind, "down", false))
              draw([pc.chain], j.x, j.y, tint, alpha, key + pc.order * 0.001);
          }
        }
      }
      for (let i = used; i < pool.length; i++)
        (pool[i] as Sprite).visible = false;
    },
    dispose() {
      for (const s of pool) s.destroy();
      pool.length = 0;
    },
  };
}
