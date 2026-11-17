import type { Rng } from '../../rng';
import { SPACE } from './regions';
import type { RoomSpec } from '../plan';
import type { Built, Ctx, Dir, Port } from './model';
import type { Roll } from './recipe';

export const roll = (rng: Rng, r: Roll): number => (typeof r === 'number' ? r : rng.int(r[0], r[1]));

/**
 * The assembly as it stands: the elements placed so far and their open ports. `place` tries one element at a port and
 * takes it back when it does not fit, builds a thick wall, or stands too near something it is not joined to.
 */
export class Asm {
  ports: Port[] = [];
  elements: Built[] = [];
  sections = 0;
  corridors = 0;
  /** Regions of gated branches: nothing that is not joined to them stands within two tiles. */
  sealed = new Set<number>();
  /** Rooms that keep open ground round them: nothing's rooms but their own branch's stand within that many tiles. */
  aloof = new Map<number, number>();
  /** Rooms an element left to its host, and the way the port it stands on heads: a ring's band takes them there. */
  spill: { spec: RoomSpec; dir: Dir }[] = [];
  constructor(readonly ctx: Ctx, readonly spacing: number) {}

  add(b: Built): Port[] {
    const owner = this.elements.push(b) - 1;
    const ps = b.ports.map((p) => ({ ...p, owner, used: false }));
    this.ports.push(...ps);
    return ps;
  }

  /** Everything needed to take a run of placements back. */
  checkpoint(): (() => void) & { was: Int16Array } {
    const { g } = this.ctx;
    const m = g.mark(), held = [...this.ctx.reserved], aloof = [...this.aloof], np = this.ports.length, ne = this.elements.length, used = this.ports.map((p) => p.used), s = this.sections, c = this.corridors, ns = this.spill.length;
    const undo = (): void => {
      g.reset(m);
      this.ctx.reserved.clear();
      for (const k of held) this.ctx.reserved.add(k);
      this.ports.length = np;
      this.elements.length = ne;
      this.ports.forEach((p, i) => { p.used = used[i] as boolean; });
      this.sections = s;
      this.spill.length = ns;
      this.aloof = new Map(aloof);
      this.corridors = c;
    };
    return Object.assign(undo, { was: m.own });
  }

  /**
   * Try one element at a port. `joined`: regions it may stand against (what it is joined to); its own are added.
   * `clear`: open ground its rooms keep from every room but other aloof ones (its host's included), and that later rooms
   * keep from them.
   */
  place(port: Port, joined: Set<number>, make: () => Built | null, clear = 0): Port[] | null {
    const { g } = this.ctx;
    const undo = this.checkpoint(), was = undo.was;
    const W = 72, px = port.frame.x, py = port.frame.y;
    const before = g.blocks(px - W, py - W, px + W, py + W);
    const b = make();
    if (!b || g.blocks(px - W, py - W, px + W, py + W) > before) { undo(); return null; }
    // Clear ground between it and whatever it is not joined to: `spacing` tiles of it, two round anything gated; and
    // where sections may stand wall to wall, never a single tile of space between two of them.
    const mine = new Set(b.regions), S = this.spacing;
    const old = (x: number, y: number): number => { const i = x + g.half, j = y + g.half; return i < 0 || j < 0 || i >= g.size || j >= g.size ? SPACE : (was[j * g.size + i] as number); };
    const foreign = (o: number): boolean => o >= 0 && !joined.has(o);
    const room = (o: number): boolean => o >= 0 && !g.regions[o]?.hall;
    for (let y = b.box[1] - 1; y <= b.box[3]; y++) for (let x = b.box[0] - 1; x <= b.box[2]; x++) {
      if (!mine.has(g.at(x, y))) continue;
      // Open ground round aloof rooms, theirs and this element's: room to room, either way.
      const R = room(g.at(x, y)) ? Math.max(clear, ...this.aloof.values()) : 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const o = old(x + dx, y + dy), d = Math.max(Math.abs(dx), Math.abs(dy)), keeps = this.aloof.get(o);
        if (!room(o) || mine.has(o)) continue;
        if (clear > 0 ? keeps === undefined && d <= clear : keeps !== undefined && d <= keeps) { undo(); return null; }
      }
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const o = old(x + dx, y + dy);
        if (!foreign(o)) continue;
        if (this.sealed.has(o) || Math.max(Math.abs(dx), Math.abs(dy)) <= S) { undo(); return null; }
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (foreign(old(x + 2 * dx, y + 2 * dy)) && g.at(x + dx, y + dy) === SPACE) { undo(); return null; }
      }
    }
    port.used = true;
    for (const spec of b.left ?? []) this.spill.push({ spec, dir: port.frame.dir });
    for (const id of b.regions) joined.add(id);
    if (clear > 0) for (const id of b.regions) if (room(id)) this.aloof.set(id, clear);
    return this.add(b);
  }
}
