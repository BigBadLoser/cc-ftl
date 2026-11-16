import { Container, Sprite } from 'pixi.js';
import type { World } from '../sim/ecs';
import { BodyC } from '../sim/body';
import { ContainerC } from '../sim/containers/components';
import { rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import type { Atlas } from './assets/loader';
import { resolveArt } from './assets/fallback';
import { containerChain, containerLogo, containerVariant } from './moduleArt';
import { createContainerOverlay } from './containerPaint';
import { SCHEMES } from './roofArt';
import { boxState, containerBox } from './containerBox';
import type { Pt } from './iso';

export interface ContainerBodyHost {
  /** The shared world layer (bodies at hull height sort with every region's tiles by sector depth x + y). */
  layer: Container;
  project(sx: number, sy: number): Pt;
  /** The livery a container of this faction (a generator faction id) wears: scheme and seed (`liveryFor`); null = bare plating. */
  livery?(id: number, faction: string): { scheme: string; seed: number } | null;
}

export interface ContainerBodyView {
  update(): void;
  dispose(): void;
}

/**
 * Detached containers: free bodies drawn with the same art as a clamped one (`container.<W>x<H>[.rN][.damaged]`), its
 * footprint laid around the body's centre. Without the art, the stand-in is drawn tile by tile like the module's. Drift
 * moves the whole box; its heading (spin) is not shown yet (iso art turns in quarter steps only). A container with a faction wears its livery: the
 * art's paint and trim overlays recoloured to the scheme, and a company logo, as a clamped container does (moduleArt.moduleLayers).
 */
export function createContainerBodyView(world: World, atlas: Atlas, defs: Readonly<Record<string, ModuleDef>>, host: ContainerBodyHost): ContainerBodyView {
  const views = new Map<number, { root: Container; sig: string }>();
  const drop = (id: number): void => {
    views.get(id)?.root.destroy({ children: true });
    views.delete(id);
  };
  return {
    update() {
      const seen = new Set<number>();
      for (const id of world.query(ContainerC, BodyC)) {
        const c = world.get(id, ContainerC);
        const b = world.get(id, BodyC);
        const def = c && defs[c.def];
        if (!c || !b || !def || c.state !== 'drifting') continue;
        const { chain, key } = containerChain(def, c.rot, c.hp, c.clamp, containerVariant(id));
        const [w, h] = rotatedSize(def, c.rot);
        // PLACEHOLDER: the drawn box (no clamp: it is loose) until the container sheets land.
        const art = resolveArt(atlas, chain, key) ?? { s: containerBox(w, h, boxState(c.hp, def.maxHp), c.clamp, false), tint: 0xffffff, perTile: false };
        seen.add(id);
        const lv = c.faction && c.hp > 0 ? host.livery?.(id, c.faction) ?? null : null;
        const scheme = lv && SCHEMES[lv.scheme];
        const sig = `${c.def}|${c.rot}|${key}|${art.s.tex.uid}|${lv?.scheme ?? ''}`;
        let v = views.get(id);
        if (v && v.sig !== sig) { drop(id); v = undefined; }
        if (!v) {
          const root = new Container();
          root.sortableChildren = true;
          const o = host.project(0, 0);
          const tiles = art.perTile ? Array.from({ length: w * h }, (_, k) => [k % w, Math.floor(k / w)] as const) : [[w - 1, h - 1] as const];
          for (const [i, j] of tiles) {
            const p = host.project(i - w / 2 + 0.5, j - h / 2 + 0.5);
            const spr = new Sprite(art.s.tex);
            spr.tint = art.tint;
            spr.position.set(Math.round(p.x - o.x - art.s.ax), Math.round(p.y - o.y - art.s.ay));
            spr.zIndex = i + j;
            root.addChild(spr);
          }
          if (lv && scheme && atlas.firstOf(chain)) {
            // Livery overlays sit on the shell's one sprite (same anchor): paint, trim, logo; each only if the art has it.
            const at = host.project(w - 1 - w / 2 + 0.5, h - 1 - h / 2 + 0.5);
            const over = (suffix: string): string[] => chain.map((n) => n + suffix);
            const layers: [string[], 'paint' | 'lv' | null][] = [[over('.paint'), 'paint'], [over('.lv'), 'lv'], [over(`.logo.${containerLogo(id, lv.seed)}`), null]];
            layers.forEach(([names, kind], n) => {
              const o = atlas.firstOf(names);
              if (!o) return;
              const x = Math.round(at.x - host.project(0, 0).x - o.ax);
              const y = Math.round(at.y - host.project(0, 0).y - o.ay);
              const part = kind ? createContainerOverlay(kind, o, scheme.P, scheme.S) : new Sprite(o.tex);
              part.position.set(x, y);
              part.zIndex = w + h + 0.001 * (n + 1);
              root.addChild(part);
            });
          }
          host.layer.addChild(root);
          views.set(id, (v = { root, sig }));
        }
        const p = host.project(b.x, b.y);
        v.root.position.set(Math.round(p.x), Math.round(p.y));
        v.root.zIndex = b.x + b.y + Math.max(w, h) / 2;
      }
      for (const id of [...views.keys()]) if (!seen.has(id)) drop(id);
    },
    dispose() {
      for (const id of [...views.keys()]) drop(id);
    },
  };
}
