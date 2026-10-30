import type { ModuleDef } from '../registry';
import { accessTile, footprintTiles, hullOutward, hullRow, hullSide, openTilesOf, type Tile } from '../modules/footprint';
import { airlockTiles } from '../modules/airlock';
import type { RoomRole } from './types';
import { CHAIR, SLEEP, TABLE, around, bedSides, chairFront, useKind } from './useTiles';

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
  /** Floor finish per tile (structure.ts `Finish`, 0 plain): courts pave their walkways and zones (rooms/courts.ts). */
  readonly finish: Uint8Array;
  /** 1 under the blocking part of a solid module (kept by push / pop, so `walkable` is a lookup). */
  private readonly solid: Uint8Array;
  readonly modules: PlacedModule[] = [];
  private readonly protects: number[][] = [];
  /** Tiles beside a placed bed's long sides (no other bed or table may cover them), and tiles a placed chair faces. */
  private readonly besideBed: Uint8Array;
  private readonly facedBy: Uint8Array;
  private readonly marks: { beside: number[]; faced: number[]; needs: number[] }[] = [];
  /** Per tile, the placed modules that need it as one of their use tiles (a bed's sides, a chair's front, a ring). */
  private readonly neededBy = new Map<number, number[]>();
  /** Per placed module with use tiles, those tiles (it needs one of them to stay usable floor). */
  private readonly needs = new Map<number, number[]>();
  readonly defs: Record<string, ModuleDef>;
  roles: RoomRole[];
  /** Rooms crew never enter (a drone's machinery bays): their pieces need no use tiles. */
  readonly sealed = new Set<number>();

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
    this.finish = new Uint8Array(this.w * this.h);
    this.solid = new Uint8Array(this.w * this.h);
    this.besideBed = new Uint8Array(this.w * this.h);
    this.facedBy = new Uint8Array(this.w * this.h);
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
    return (c === '_' || c === 'D') && this.solid[i] === 0;
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
    const useErr = this.useError(defId, def, x, y, rot, tiles);
    if (useErr) return useErr;
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
    const open = def.solid ? openTilesOf(def, pm.x, pm.y, pm.rot) : [];
    for (const t of footprintTiles(def, pm.x, pm.y, pm.rot)) {
      if (wallRow.some((w) => w.x === t.x && w.y === t.y)) continue;
      const i = t.y * this.w + t.x;
      this.occ[i] = idx;
      // Beds block walking at generation time: crew are not laid out to climb over them.
      this.solid[i] = (def.solid || SLEEP.has(pm.def)) && !open.some((o) => o.x === t.x && o.y === t.y) ? 1 : 0;
    }
    const mark = { beside: [] as number[], faced: [] as number[], needs: [] as number[] };
    if (SLEEP.has(pm.def)) for (const t of bedSides(def, pm.x, pm.y, pm.rot).flat()) if (this.inBounds(t.x, t.y)) mark.beside.push(t.y * this.w + t.x);
    if (pm.def === CHAIR) { const f = chairFront(pm.x, pm.y, pm.rot); if (this.inBounds(f.x, f.y)) mark.faced.push(f.y * this.w + f.x); }
    const kind = this.sealed.has(this.roomOf[pm.y * this.w + pm.x] ?? -1) ? null : useKind(pm.def, def, pm.x, pm.y, pm.rot);
    const need = kind === 'sides' ? bedSides(def, pm.x, pm.y, pm.rot).flat() : kind === 'front' ? [chairFront(pm.x, pm.y, pm.rot)] : kind === 'ring' ? around(def, pm.x, pm.y, pm.rot) : [];
    mark.needs = need.filter((t) => this.inBounds(t.x, t.y)).map((t) => t.y * this.w + t.x);
    if (mark.needs.length > 0) {
      this.needs.set(idx, mark.needs);
      for (const i of mark.needs) this.neededBy.set(i, [...(this.neededBy.get(i) ?? []), idx]);
    }
    for (const i of mark.beside) this.besideBed[i] = (this.besideBed[i] as number) + 1;
    for (const i of mark.faced) this.facedBy[i] = (this.facedBy[i] as number) + 1;
    this.marks.push(mark);
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
      if (this.occ[i] === this.modules.length) { this.occ[i] = -1; this.solid[i] = 0; }
    }
    for (const i of this.protects.pop() ?? []) this.keep[i] = (this.keep[i] as number) - 2;
    const mark = this.marks.pop();
    for (const i of mark?.beside ?? []) this.besideBed[i] = (this.besideBed[i] as number) - 1;
    for (const i of mark?.faced ?? []) this.facedBy[i] = (this.facedBy[i] as number) - 1;
    const gone = this.modules.length;
    this.needs.delete(gone);
    for (const i of mark?.needs ?? []) {
      const l = (this.neededBy.get(i) ?? []).filter((m) => m !== gone);
      if (l.length > 0) this.neededBy.set(i, l); else this.neededBy.delete(i);
    }
  }

  /** Usable floor: a floor tile crew can stand on to use something, holding nothing or only a floor light. */
  private usableFloor(i: number, room: number): boolean {
    if (this.cells[i] !== '_' || (room >= 0 && this.roomOf[i] !== room)) return false;
    const o = this.occ[i] as number;
    if (o < 0) return true;
    const d = this.defs[this.modules[o]?.def as string];
    return !!d && !d.solid && !!d.light;
  }

  /** Free floor: a floor tile of `room` (any room when -1) with no module on it. */
  private freeFloor(x: number, y: number, room: number): boolean {
    return this.inBounds(x, y) && this.usableFloor(y * this.w + x, room);
  }

  /**
   * Use rules (rooms/usage.ts) for a module about to go at (x, y): a bed needs free floor beside a long side and no bed
   * or table beside it; a chair faces free floor or what it serves; any other piece needs a free tile to be used or
   * serviced from; and no bed or table may cover a tile beside a bed, nor anything solid the tile a chair faces (unless
   * it is what the chair serves).
   */
  private useError(id: string, def: ModuleDef, x: number, y: number, rot: number, tiles: Tile[]): string | null {
    const idx = (t: Tile): number => t.y * this.w + t.x;
    const blocksWalk = def.solid || SLEEP.has(id);
    for (const t of tiles) {
      const i = idx(t);
      if ((SLEEP.has(id) || TABLE.has(id)) && this.besideBed[i]) return 'besideBed';
      if (blocksWalk && this.facedBy[i] && !TABLE.has(id)) {
        const a = accessTile(def, x, y, rot);
        const served = !!a && this.modules.some((m) => m.def === CHAIR && m.x === a.x && m.y === a.y);
        if (!served) return 'facesChair';
      }
    }
    // Covering a tile another piece is used from: fine while that piece keeps another.
    const covers = blocksWalk || id === CHAIR || (!def.light && tiles.length > 0);
    if (covers) {
      const mine = new Set(tiles.map(idx));
      const hit = new Set<number>();
      for (const i of mine) for (const m of this.neededBy.get(i) ?? []) hit.add(m);
      for (const m of hit) if (!(this.needs.get(m) ?? []).some((i) => !mine.has(i) && this.usableFloor(i, -1))) return 'blocksUse';
    }
    const room = this.roomOf[idx(tiles[0] as Tile)] ?? -1;
    const kind = this.sealed.has(room) ? null : useKind(id, def, x, y, rot);
    if (kind === 'sides') {
      const sides = bedSides(def, x, y, rot);
      for (const t of sides.flat()) {
        const o = this.inBounds(t.x, t.y) ? (this.occ[idx(t)] as number) : -1;
        const od = o >= 0 ? this.modules[o]?.def : undefined;
        if (od && (SLEEP.has(od) || TABLE.has(od))) return 'besideBed';
      }
      if (!sides.flat().some((t) => this.freeFloor(t.x, t.y, room))) return 'noUse';
    } else if (kind === 'front') {
      const f = chairFront(x, y, rot);
      if (!this.freeFloor(f.x, f.y, -1) && !this.serves(f.x, f.y, x, y)) return 'chairFacing';
    } else if (kind === 'ring') {
      if (!around(def, x, y, rot).some((t) => this.freeFloor(t.x, t.y, -1))) return 'boxedIn';
    }
    return null;
  }

  /** True if the module at (fx, fy) is something a chair at (cx, cy) is used at: a table, or a piece whose access tile it is. */
  private serves(fx: number, fy: number, cx: number, cy: number): boolean {
    if (!this.inBounds(fx, fy)) return false;
    const o = this.occ[fy * this.w + fx] as number;
    const m = o >= 0 ? this.modules[o] : undefined;
    if (!m) return false;
    if (TABLE.has(m.def)) return true;
    const a = accessTile(this.defs[m.def] as ModuleDef, m.x, m.y, m.rot);
    return !!a && a.x === cx && a.y === cy;
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
    return this.unreached() === 0;
  }

  /**
   * Walkable tiles not reachable from the first door, plus protected tiles that are not walkable. A ship with a
   * sealed room starts above 0; a placement is safe when it does not raise this.
   */
  unreached(): number {
    const n = this.cells.length;
    const W = this.w;
    let start = -1;
    let total = 0;
    let bad = 0;
    for (let i = 0; i < n; i++) {
      if (!this.walkable(i)) {
        if (this.keep[i]) bad++;
        continue;
      }
      total++;
      if (start < 0 && this.cells[i] === 'D') start = i;
    }
    if (start < 0) return n + bad;
    const seen = new Uint8Array(n);
    const stack = [start];
    seen[start] = 1;
    let count = 0;
    const visit = (j: number): void => {
      if (!seen[j] && this.walkable(j)) { seen[j] = 1; stack.push(j); }
    };
    while (stack.length > 0) {
      const i = stack.pop() as number;
      count++;
      const x = i % W;
      if (x > 0) visit(i - 1);
      if (x < W - 1) visit(i + 1);
      if (i >= W) visit(i - W);
      if (i + W < n) visit(i + W);
    }
    return total - count + bad;
  }

  /** Floor tiles of a room. */
  roomTiles(room: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.roomOf.length; i++) if (this.roomOf[i] === room && this.cells[i] === '_') out.push(i);
    return out;
  }
}
