import type { Rng } from '../../rng';
import { SPACE } from './regions';
import type { Built, Ctx, Port } from './model';
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
  constructor(readonly ctx: Ctx, readonly spacing: number) {}

  add(b: Built): Port[] {
    const owner = this.elements.push(b) - 1;
    const ps = b.ports.map((p) => ({ ...p, owner, used: false }));
    this.ports.push(...ps);
    return ps;
  }

  /** Everything needed to take a run of placements back. */
  checkpoint(): () => void {
    const { g } = this.ctx;
    const m = g.mark(), held = [...this.ctx.reserved], np = this.ports.length, ne = this.elements.length, used = this.ports.map((p) => p.used), s = this.sections, c = this.corridors;
    return () => {
      g.reset(m);
      this.ctx.reserved.clear();
      for (const k of held) this.ctx.reserved.add(k);
      this.ports.length = np;
      this.elements.length = ne;
      this.ports.forEach((p, i) => { p.used = used[i] as boolean; });
      this.sections = s;
      this.corridors = c;
    };
  }

  /** Try one element at a port. `joined`: regions it may stand against (what it is joined to); its own are added. */
  place(port: Port, joined: Set<number>, make: () => Built | null): Port[] | null {
    const { g } = this.ctx;
    const undo = this.checkpoint(), was = g.mark().own;
    const W = 72, px = port.frame.x, py = port.frame.y;
    const before = g.blocks(px - W, py - W, px + W, py + W);
    const b = make();
    if (!b || g.blocks(px - W, py - W, px + W, py + W) > before) { undo(); return null; }
    // Clear ground between it and whatever it is not joined to: `spacing` tiles of it, two round anything gated; and
    // where sections may stand wall to wall, never a single tile of space between two of them.
    const mine = new Set(b.regions), S = this.spacing;
    const old = (x: number, y: number): number => { const i = x + g.half, j = y + g.half; return i < 0 || j < 0 || i >= g.size || j >= g.size ? SPACE : (was[j * g.size + i] as number); };
    const foreign = (o: number): boolean => o >= 0 && !joined.has(o);
    for (let y = b.box[1] - 1; y <= b.box[3]; y++) for (let x = b.box[0] - 1; x <= b.box[2]; x++) {
      if (!mine.has(g.at(x, y))) continue;
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
    for (const id of b.regions) joined.add(id);
    return this.add(b);
  }
}
