import type { Rng } from '../../rng';
import { accessTile, footprintTiles } from '../../modules/footprint';
import type { Layout, PlacedModule } from '../layout';

/**
 * Aisles (holds and stores): rows of stock in pairs, back to back, with a one-tile aisle between each pair, every piece
 * worked from its aisle; across the stripes, a cross aisle every so often so no row runs on unbroken. The stripe
 * pattern runs along the room's long axis at the offset that fits the most. The room's planned crates go into the rows
 * first, then the row piece (racks, or pallets two deep), then crates in the gaps it leaves, up to the room's fill
 * target. Works on any room shape: a slot is used only where the piece fits and the ship stays connected. Everything
 * placed or nothing: null, nothing placed, when a planned crate finds no slot.
 */

export interface AislePlan { piece: 'module.storage_rack' | 'module.storage_pallet'; crates: number; fill: number }

/** The pieces placed (indices into lay.modules), or null when the plan does not fit. */
export function planAisles(lay: Layout, rng: Rng, room: number, o: AislePlan): number[] | null {
  const tiles = lay.roomTiles(room);
  if (tiles.length < 12) return null;
  const W = lay.w;
  const xs = tiles.map((i) => i % W), ys = tiles.map((i) => Math.floor(i / W));
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const along: 0 | 1 = Math.max(...xs) - x0 >= Math.max(...ys) - y0 ? 0 : 1;
  const deep = o.piece === 'module.storage_pallet' ? 2 : 1;
  // Across the stripes (v): aisle, a row worked from the aisle before it, a row worked from the aisle after it.
  const period = 1 + 2 * deep;
  const cross = 9;
  const n0 = lay.modules.length;
  const base = lay.unreached();
  const placed: number[] = [];
  const undo = (): null => { while (lay.modules.length > n0) lay.pop(); return null; };
  const uv = (i: number): [number, number] => (along === 0 ? [i % W - x0, Math.floor(i / W) - y0] : [Math.floor(i / W) - y0, i % W - x0]);
  const vOf = (x: number, y: number): number => (along === 0 ? y - y0 : x - x0);
  const uOf = (x: number, y: number): number => (along === 0 ? x - x0 : y - y0);
  const fill = (): number => {
    let solid = 0;
    for (const m of lay.modules) {
      const d = lay.defs[m.def];
      if (!d?.solid) continue;
      for (const t of footprintTiles(d, m.x, m.y, m.rot)) if (lay.roomOf[t.y * W + t.x] === room) solid++;
    }
    return solid / tiles.length;
  };
  /** Slots for `def` in stripe offset `off`, cross-aisle offset `coff`: footprint in one row, access in its aisle. */
  const slots = (def: string, off: number, coff: number): PlacedModule[] => {
    const d = lay.defs[def];
    if (!d) return [];
    const out: PlacedModule[] = [];
    for (const i of tiles) {
      const [u] = uv(i);
      if ((((u + coff) % cross) + cross) % cross === 0) continue; // the cross aisle
      for (let rot = 0; rot < 4; rot++) {
        const pm = { def, x: i % W, y: Math.floor(i / W), rot };
        const fp = footprintTiles(d, pm.x, pm.y, rot);
        const a = accessTile(d, pm.x, pm.y, rot);
        if (!a) continue;
        const vs = fp.map((t) => (((vOf(t.x, t.y) + off) % period) + period) % period);
        const av = (((vOf(a.x, a.y) + off) % period) + period) % period;
        if (av !== 0) continue;
        // All in the row next to that aisle: rows 1..deep follow it, rows deep+1..2*deep precede the next one.
        const next = vs.every((v) => v >= 1 && v <= deep) && fp.every((t) => vOf(t.x, t.y) > vOf(a.x, a.y));
        const prev = vs.every((v) => v > deep) && fp.every((t) => vOf(t.x, t.y) < vOf(a.x, a.y));
        if (!next && !prev) continue;
        if (fp.some((t) => ((((uOf(t.x, t.y) + coff) % cross) + cross) % cross) === 0)) continue;
        out.push(pm);
      }
    }
    return out;
  };
  const tryPut = (pm: PlacedModule): boolean => {
    if (lay.fitError(pm.def, pm.x, pm.y, pm.rot, room)) return false;
    lay.push(pm);
    if (lay.unreached() > base) { lay.pop(); return false; }
    placed.push(lay.modules.length - 1);
    return true;
  };
  // The stripe and cross-aisle offsets that give the row piece the most slots (a little noise picks among equals).
  let best = { off: 0, coff: 0, n: -1 };
  for (let off = 0; off < period; off++) for (let coff = 0; coff < cross; coff += 3) {
    const n = slots(o.piece, off, coff).length + rng.next() * 0.5;
    if (n > best.n) best = { off, coff, n };
  }
  // Crates first (the planned stock), spread along the rows; then the row piece in reading order down each row.
  const crates = slots('module.storage', best.off, best.coff);
  for (let k = 0; k < o.crates; k++) {
    const order = crates.filter((c) => !lay.fitError(c.def, c.x, c.y, c.rot, room));
    const start = Math.floor(((k + 0.5) / o.crates) * order.length);
    let ok = false;
    for (const c of [...order.slice(start), ...order.slice(0, start)]) if (tryPut(c)) { ok = true; break; }
    if (!ok) return undo();
  }
  const rows = slots(o.piece, best.off, best.coff).sort((p, q) => vOf(p.x, p.y) - vOf(q.x, q.y) || uOf(p.x, p.y) - uOf(q.x, q.y));
  for (const pm of rows) {
    if (fill() >= o.fill) break;
    tryPut(pm);
  }
  // Crates close the gaps the row piece leaves (row ends, short runs between crates), aisles kept.
  for (const c of slots('module.storage', best.off, best.coff)) {
    if (fill() >= o.fill) break;
    tryPut(c);
  }
  return placed;
}
