import type { ModuleDef } from '../registry';
import { accessTile, footprintTiles, hullOutward, hullRow, hullSide, openTilesOf, type Tile } from '../modules/footprint';
import { airlockTiles } from '../portals/airlock';
import type { RoomRole } from './types';

export interface PlacedModule {
  def: string;
  x: number;
  y: number;
  rot: number;
}

/** Roof-mounted modules need a clear tile around them so their turrets, dishes and masts do not overlap. */
export const roofMounted = (d: ModuleDef): boolean => !!(d.weapon || d.pointDefense || d.roofAsset);

/**
 * A ship being fitted out: struct chars, room of each tile, module occupancy and tiles that must stay walkable.
 * All checks mirror the sim's placement rules (placementError) and the layout tests.
 */
export class Layout {
  readonly w: number;
  readonly h: number;
  readonly cells: string[];
  readonly roomOf: Int16Array;
  /** Module index per tile, -1 free. */
  readonly occ: Int16Array;
  /** Tiles crew must be able to stand on (door sides, access tiles, airlock insides). */
  readonly keep: Uint8Array;
  readonly modules: PlacedModule[] = [];
  private readonly protects: number[][] = [];
  readonly defs: Record<string, ModuleDef>;
  roles: RoomRole[];

  constructor(rows: string[], roomOf: Int16Array, roles: RoomRole[], defs: Record<string, ModuleDef>) {
    this.h = rows.length;
    this.w = Math.max(...rows.map((r) => r.length));
    this.cells = [];
    for (const r of rows) for (let x = 0; x < this.w; x++) this.cells.push(r[x] ?? '.');
    this.roomOf = roomOf;
    this.roles = roles;
    this.defs = defs;
    this.occ = new Int16Array(this.w * this.h).fill(-1);
    this.keep = new Uint8Array(this.w * this.h);
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] !== 'D') continue;
      for (const n of this.neighbours(i)) if (this.cells[n] === '_') this.keep[n] = 1;
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  at(x: number, y: number): string {
    return this.inBounds(x, y) ? (this.cells[y * this.w + x] as string) : '.';
  }

  neighbours(i: number): number[] {
    const x = i % this.w;
    const y = Math.floor(i / this.w);
    const out: number[] = [];
    if (x > 0) out.push(i - 1);
    if (x < this.w - 1) out.push(i + 1);
    if (y > 0) out.push(i - this.w);
    if (y < this.h - 1) out.push(i + this.w);
    return out;
  }

  /** True if crew can stand on tile i: floor or door, not under the blocking part of a solid module. */
  walkable(i: number): boolean {
    const c = this.cells[i];
    if (c !== '_' && c !== 'D') return false;
    const m = this.occ[i] as number;
    if (m < 0) return true;
    const pm = this.modules[m] as PlacedModule;
    const def = this.defs[pm.def] as ModuleDef;
    if (!def.solid) return true;
    const x = i % this.w;
    const y = Math.floor(i / this.w);
    return openTilesOf(def, pm.x, pm.y, pm.rot).some((t) => t.x === x && t.y === y);
  }

  /** Why the module cannot go here (null = it fits). `room` restricts the footprint to one room (-1 any). */
  fitError(defId: string, x: number, y: number, rot: number, room: number): string | null {
    const def = this.defs[defId];
    if (!def) return 'badDef';
    const tiles = footprintTiles(def, x, y, rot);
    const wallRow = hullRow(def, x, y, rot);
    const open = openTilesOf(def, x, y, rot);
    const side = hullSide(def, rot);
    const out = side ? hullOutward(side) : { x: 0, y: 0 };
    for (const t of tiles) {
      if (!this.inBounds(t.x, t.y)) return 'outOfBounds';
      const i = t.y * this.w + t.x;
      if (this.occ[i] !== -1) return 'occupied';
      const onWall = wallRow.some((w) => w.x === t.x && w.y === t.y);
      if (onWall) {
        if (this.cells[i] !== '#' || this.at(t.x + out.x, t.y + out.y) !== '.') return 'notOnHull';
        const inner = (t.y - out.y) * this.w + (t.x - out.x);
        if (room >= 0 && this.roomOf[inner] !== room) return 'otherRoom';
        continue;
      }
      if (this.cells[i] !== '_') return 'notFloor';
      if (room >= 0 && this.roomOf[i] !== room) return 'otherRoom';
      const blocks = def.solid && !open.some((o) => o.x === t.x && o.y === t.y);
      // The docking airlock's open tiles are its walkway: it may cover the tile crew need beside a door (it stays walkable).
      const walkway = !!def.airlock && !blocks;
      if (this.keep[i] && (blocks || (defId !== 'module.light' && !walkway))) return 'keepClear';
    }
    const access = accessTile(def, x, y, rot);
    if (access && !tiles.some((t) => t.x === access.x && t.y === access.y)) {
      if (!this.inBounds(access.x, access.y)) return 'noAccess';
      const ai = access.y * this.w + access.x;
      if (!this.walkable(ai) || (this.occ[ai] !== -1 && this.defs[this.modules[this.occ[ai] as number]!.def]?.solid)) return 'noAccess';
    }
    if (def.airlock) {
      const ins = this.airlockInside({ def: defId, x, y, rot });
      if (this.at(ins.x, ins.y) !== '_' || this.occ[ins.y * this.w + ins.x] !== -1) return 'noAccess';
      if (room >= 0 && this.roomOf[ins.y * this.w + ins.x] !== room) return 'otherRoom';
    }
    if (def.weapon && !tiles.some((t) => this.besideHull(t.x, t.y))) return 'offHull';
    if (roofMounted(def)) {
      for (const t of tiles) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!this.inBounds(t.x + dx, t.y + dy)) continue;
            const m = this.occ[(t.y + dy) * this.w + t.x + dx] as number;
            if (m >= 0 && roofMounted(this.defs[this.modules[m]!.def] as ModuleDef)) return 'roofClash';
          }
        }
      }
    }
    return null;
  }

  /** True if (x, y) is next to an exterior hull wall (a wall tile with space beyond it). */
  besideHull(x: number, y: number): boolean {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (this.at(x + dx, y + dy) === '#' && this.at(x + 2 * dx, y + 2 * dy) === '.') return true;
    }
    return false;
  }

  /** The tile just inside an airlock's inner door. */
  airlockInside(pm: PlacedModule): Tile {
    return airlockTiles(this.defs[pm.def] as ModuleDef, pm).inside;
  }

  /** Place the module and protect its access tiles; undo with `pop`. */
  push(pm: PlacedModule): void {
    const def = this.defs[pm.def] as ModuleDef;
    const idx = this.modules.length;
    this.modules.push(pm);
    const wallRow = hullRow(def, pm.x, pm.y, pm.rot);
    for (const t of footprintTiles(def, pm.x, pm.y, pm.rot)) {
      if (!wallRow.some((w) => w.x === t.x && w.y === t.y)) this.occ[t.y * this.w + t.x] = idx;
    }
    const prot = this.protectedTiles(pm).map((t) => t.y * this.w + t.x);
    this.protects.push(prot);
    for (const i of prot) this.keep[i] = (this.keep[i] as number) + 2;
  }

  pop(): void {
    const pm = this.modules.pop();
    if (!pm) return;
    const def = this.defs[pm.def] as ModuleDef;
    for (const t of footprintTiles(def, pm.x, pm.y, pm.rot)) {
      const i = t.y * this.w + t.x;
      if (this.occ[i] === this.modules.length) this.occ[i] = -1;
    }
    for (const i of this.protects.pop() ?? []) this.keep[i] = (this.keep[i] as number) - 2;
  }

  private protectedTiles(pm: PlacedModule): Tile[] {
    const def = this.defs[pm.def] as ModuleDef;
    const out: Tile[] = [];
    const a = accessTile(def, pm.x, pm.y, pm.rot);
    if (a && this.occ[a.y * this.w + a.x] === -1) out.push(a);
    if (def.airlock) out.push(this.airlockInside(pm));
    return out.filter((t) => this.inBounds(t.x, t.y));
  }

  /** True if every walkable tile and every protected tile is reachable from the first door. */
  connected(): boolean {
    const n = this.cells.length;
    let start = -1;
    let total = 0;
    for (let i = 0; i < n; i++) {
      if (!this.walkable(i)) {
        if (this.keep[i]) return false;
        continue;
      }
      total++;
      if (start < 0 && this.cells[i] === 'D') start = i;
    }
    if (start < 0) return false;
    const seen = new Uint8Array(n);
    const stack = [start];
    seen[start] = 1;
    let count = 0;
    while (stack.length > 0) {
      const i = stack.pop() as number;
      count++;
      for (const j of this.neighbours(i)) {
        if (!seen[j] && this.walkable(j)) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    return count === total;
  }

  /** Floor tiles of a room. */
  roomTiles(room: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.roomOf.length; i++) if (this.roomOf[i] === room && this.cells[i] === '_') out.push(i);
    return out;
  }
}
