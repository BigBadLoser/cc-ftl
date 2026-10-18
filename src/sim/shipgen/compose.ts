import type { Builder, Rect } from './builder';
import type { AccessKind, AsmRecord, CompDebug, JoinKind, JoinRecord, PortRecord } from './types';

/**
 * Assembly bookkeeping for assembly-driven generation, shared by every faction's composer: which stamped parts belong
 * to which functional assembly, its access requirement, its ports, and the structural joins between assemblies.
 * Ports are checked when assemblies meet: a bulkhead opens only where both sides have floor; an unmatched port makes
 * the arrangement infeasible, and the composer revises it.
 */
export class Composer {
  readonly asms: (AsmRecord & { keys: Set<string> })[] = [];
  readonly ports: PortRecord[] = [];
  readonly joins: JoinRecord[] = [];
  private open: { id: number; from: number } | null = null;

  constructor(readonly b: Builder) {}

  /** Start an assembly: everything stamped until `end` belongs to it. */
  begin(kind: string, label: string, access: AccessKind): number {
    const id = this.asms.length;
    this.asms.push({ id, kind, label, access, x: 0, y: 0, w: 0, h: 0, keys: new Set() });
    this.open = { id, from: this.b.cv.stamped.length };
    return id;
  }

  /** Close the open assembly; its bounds are the union of its parts (chunks count by their stamped area). */
  end(bounds?: Rect): number {
    if (!this.open) return -1;
    const a = this.asms[this.open.id] as AsmRecord & { keys: Set<string> };
    for (const k of this.b.cv.stamped.slice(this.open.from)) a.keys.add(k);
    const rects = this.b.parts.filter((p) => a.keys.has(p.key));
    const all = bounds ? [...rects, bounds] : rects;
    if (all.length > 0) {
      const x0 = Math.min(...all.map((r) => r.x));
      const y0 = Math.min(...all.map((r) => r.y));
      a.x = x0;
      a.y = y0;
      a.w = Math.max(...all.map((r) => r.x + r.w)) - x0;
      a.h = Math.max(...all.map((r) => r.y + r.h)) - y0;
    }
    this.open = null;
    return a.id;
  }

  join(kind: JoinKind, a: number, b: number, tiles: { x: number; y: number }[] = []): void {
    this.joins.push({ kind, a, b, tiles });
  }

  /**
   * A frame bulkhead between assembly `a` (west) and `b` (east) along column x: each access row opens as a door when
   * floor lies on both sides. Records the ports; returns false if any port found no counterpart.
   */
  bulkhead(a: number, b: number, x: number, rows: number[], access: AccessKind): boolean {
    let ok = true;
    const tiles: { x: number; y: number }[] = [];
    for (const y of rows) {
      const cv = this.b.cv;
      const matched = cv.at(x - 1, y) === '_' && cv.at(x + 1, y) === '_' && (cv.at(x, y) === '#' || cv.at(x, y) === 'D');
      if (matched) cv.setDoor(x, y);
      ok &&= matched;
      this.ports.push({ asm: a, x, y, dir: 'e', access, matched }, { asm: b, x, y, dir: 'w', access, matched });
      tiles.push({ x, y });
    }
    this.join('frame', a, b, tiles);
    return ok;
  }

  /** Debug data in the frame of the cropped template (origin ox, oy), with the room label of each tile. */
  debug(ox: number, oy: number, width: number, height: number, roomOf: Int16Array, rows: string[], profile: string): CompDebug {
    const labels = this.b.cv.labels;
    const asmOf = new Int16Array(width * height).fill(-1);
    const byKey = new Map<string, number>();
    for (const a of this.asms) for (const k of a.keys) byKey.set(k, a.id);
    for (let i = 0; i < asmOf.length; i++) {
      const l = roomOf[i] ?? -1;
      if (l >= 0) asmOf[i] = byKey.get(labels[l]?.chunk ?? '') ?? -1;
    }
    // Walls and doors take the assembly whose bounds hold them (the first, so shared bulkheads go west).
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (asmOf[i] !== -1 || (rows[y]?.[x] ?? '.') === '.') continue;
        const wx = x + ox;
        const wy = y + oy;
        const a = this.asms.find((r) => wx >= r.x && wy >= r.y && wx < r.x + r.w && wy < r.y + r.h);
        if (a) asmOf[i] = a.id;
      }
    }
    const traversal: CompDebug['traversal'] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const c = rows[y]?.[x];
        const l = roomOf[i] ?? -1;
        const hall = c === 'D' || (c === '_' && l >= 0 && labels[l]?.letter === 'h');
        if (hall) traversal.push({ x, y, access: this.asms[asmOf[i] ?? -1]?.access ?? 'human' });
      }
    }
    const shift = <T extends { x: number; y: number }>(t: T): T => ({ ...t, x: t.x - ox, y: t.y - oy });
    return {
      assemblies: this.asms.map((a) => shift({ id: a.id, kind: a.kind, label: a.label, access: a.access, x: a.x, y: a.y, w: a.w, h: a.h })),
      asmOf,
      ports: this.ports.map(shift),
      joins: this.joins.map((j) => ({ ...j, tiles: j.tiles.map(shift) })),
      traversal,
      profile,
    };
  }
}
