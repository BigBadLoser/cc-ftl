import { Container, type Sprite, type Texture } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { ShipC, type ShipRuin } from '../sim/combat/components';
import { ModuleC } from '../sim/modules/components';
import { rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { Struct } from '../sim/structure';
import type { Atlas } from './assets/loader';
import { depthKey } from './iso';
import type { Layers } from './layers';
import { regionTiles } from './regionTiles';
import { outward, tileHash, touchesSpace, wallMask, type WallLevel } from './tiles';
import { addStatic } from './sprites';

/**
 * Derelict dressing (ARCHITECTURE "Derelict dressing"), drawn from `ShipC.ruin` over the normal tiles: breach pieces where a
 * wall or hull was torn out, deck holes, scorch and growth on floors and wall faces, burnt rings under wrecked modules,
 * debris props (the junction sparks), and static egg sacs, nests and AI spawns. Module art overrides (lights, dormant
 * fabricators) and darkening live in moduleView. The sprites are rebuilt when the struct, the modules, the wall level or
 * the roof change; only the junction sparks animate.
 */
export interface RuinView {
  update(): void;
  /** The wall view level of the art (up / cut / low). */
  setLevel(level: WallLevel): void;
  /** Roofed ships also get the roof marks (`decay.breach.roof`). */
  setRoofed(roofed: boolean): void;
  dispose(): void;
}

interface Spark {
  spr: Sprite;
  on: Texture;
  off: Texture;
  phase: number;
}

export function createRuinView(grid: Grid, atlas: Atlas, L: Layers, world: World, defs: Readonly<Record<string, ModuleDef>>, emergency: () => boolean = () => false): RuinView {
  const tiles = regionTiles(grid);
  const kindAt = tiles.kindAt;
  const flat = new Container();
  L.decal.addChild(flat);
  let owned: Sprite[] = [];
  let sparks: Spark[] = [];
  let level: WallLevel = 'cut';
  let roofed = false;
  let key = '';
  let em = false;

  function clear(): void {
    for (const s of owned) s.destroy();
    owned = [];
    sparks = [];
  }

  /** Put an asset (first existing id) on tile (x, y); returns its main sprite. */
  function put(chain: string[], x: number, y: number, k: number, parent?: Container): Sprite | undefined {
    const s = atlas.firstOf(chain);
    if (!s) return undefined;
    const made = addStatic(L, s, x, y, k, parent ?? L.sorted);
    owned.push(...made);
    return made[0];
  }

  function breachPieces(ruin: ShipRuin, off: number): void {
    const pre = level === 'up' ? 'full.' : '';
    for (const b of ruin.breaches) {
      const k = kindAt(b.x, b.y);
      if (k === Struct.Wall || k === Struct.Door) continue; // rebuilt
      if (b.kind === 'floor') {
        if (k === Struct.Space) put([b.art], b.x, b.y, 0, flat);
        continue;
      }
      const base = depthKey(b.x, b.y) + off;
      const fam = b.art.includes('hull') ? 'hull' : 'wall';
      const mask = wallMask(kindAt, b.x, b.y);
      put([`tile.${fam}.${pre}m${mask}.breach`, `tile.${fam}.m${mask}.breach`], b.x, b.y, base + 0.001);
      // Where the -x / -y neighbour is intact the tear needs an end face; cut partitions have none.
      if (fam === 'wall' && level !== 'up') continue;
      if (kindAt(b.x - 1, b.y) === Struct.Wall) put([`tile.${fam}.${pre}breach.end.w`, `tile.${fam}.breach.end.w`], b.x, b.y, base + 0.002);
      if (kindAt(b.x, b.y - 1) === Struct.Wall) put([`tile.${fam}.${pre}breach.end.n`, `tile.${fam}.breach.end.n`], b.x, b.y, base + 0.002);
    }
  }

  /** Scorch near combat impacts and growth near nests, on the camera-facing face of straight wall runs. */
  function wallFaces(ruin: ShipRuin, off: number): void {
    const nests = ruin.hooks.filter((h) => h.art?.startsWith('decay.eggs'));
    for (let y = 0; y < tiles.height; y++)
      for (let x = 0; x < tiles.width; x++) {
        if (kindAt(x, y) !== Struct.Wall || outward(kindAt, x, y) > 0) continue;
        const m = wallMask(kindAt, x, y);
        const axis = (m & 10) === 10 && !(m & 5) ? 'x' : (m & 5) === 5 && !(m & 10) ? 'y' : '';
        if (!axis) continue;
        const fam = touchesSpace(kindAt, x, y) ? 'hull' : 'wall';
        const h = tileHash(x, y);
        const base = depthKey(x, y) + off;
        const hot = ruin.impacts.some((p) => Math.hypot(x - p.x, y - p.y) <= p.r + 1.2);
        const grown = nests.some((n) => Math.hypot(x - n.x, y - n.y) <= 3.5);
        if (em && (x + y) % 2 === 0) {
          put([`decay.striplight.${fam}.${axis}`], x, y, base + 0.004);
          if (level === 'up') put([`decay.striplight.${fam}.${axis}.high`], x, y, base + 0.004);
        }
        if (hot && ruin.cause === 'combat' && h % 3 !== 0) put([`decay.scorch.${fam}.${axis}.${level}.v${(h >> 4) & 1}`], x, y, base + 0.003);
        else if (grown && h % 2 === 0) put([`decay.growth.${fam}.${axis}.${level}`], x, y, base + 0.003);
      }
  }

  function props(ruin: ShipRuin): void {
    for (const d of ruin.decals) {
      const k = kindAt(d.x, d.y);
      if (d.art === 'decay.breach.roof') {
        if (roofed && k !== Struct.Space) put([d.art], d.x, d.y, depthKey(d.x, d.y) + 0.93);
      } else if (d.art.startsWith('decay.debris.')) {
        if (k === Struct.Space || k === Struct.Wall) continue;
        const spr = put([d.art], d.x, d.y, depthKey(d.x, d.y) - 0.3);
        const spark = d.art === 'decay.debris.junction' ? atlas.stat('decay.debris.junction.spark') : undefined;
        const base = atlas.stat(d.art);
        if (spr && spark && base) sparks.push({ spr, on: spark.tex, off: base.tex, phase: tileHash(d.x, d.y) % 1000 });
      } else if (k === Struct.Floor || k === Struct.Door) put([d.art], d.x, d.y, 0, flat); // scorch / growth floor marks
    }
    for (const h of ruin.hooks) {
      const k = h.size - 1;
      put([h.art ?? ''], h.x + k, h.y + k, depthKey(h.x + k, h.y + k) - 0.2);
    }
  }

  /** Char rings under burnt-out modules. */
  function burnt(ruin: ShipRuin): void {
    for (const r of ruin.modules) {
      if (!r.art?.startsWith('decay.burnt.')) continue;
      const id = tiles.get('module', r.x, r.y);
      const m = id ? world.get(id, ModuleC) : undefined;
      const def = m && defs[m.def];
      if (!m || !def || m.hp > 0) continue;
      const [w, h] = rotatedSize(def, m.rot);
      put([r.art], m.x - grid.x0 + w - 1, m.y - grid.y0 + h - 1, 0, flat);
    }
  }

  function rebuild(ruin: ShipRuin): void {
    clear();
    // Roofed ships sort their walls a little earlier (gridView), so the dressing does too.
    const off = roofed ? -0.15 : 0;
    breachPieces(ruin, off);
    wallFaces(ruin, off);
    props(ruin);
    burnt(ruin);
  }

  return {
    update() {
      const ruin = world.get(grid.id, ShipC)?.ruin;
      if (!ruin) {
        if (owned.length) clear();
        key = '';
        return;
      }
      em = emergency();
      const k = `${em}|${grid.revision('struct')}|${grid.revision('module')}|${level}|${roofed}|${ruin.decals.length}`;
      if (k !== key) {
        key = k;
        rebuild(ruin);
      }
      const now = performance.now();
      for (const s of sparks) s.spr.texture = Math.floor(now / 140 + s.phase) % 5 === 0 ? s.on : s.off;
    },
    setLevel(l) {
      level = l;
    },
    setRoofed(r) {
      roofed = r;
    },
    dispose() {
      clear();
      flat.destroy({ children: true });
    },
  };
}
