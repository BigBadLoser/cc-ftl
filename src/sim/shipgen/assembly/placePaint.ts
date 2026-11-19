import type { RoomSpec, ShipPlan } from '../plan';
import { BAND } from './frame';
import { closeFrame, frameGrid } from './frameGrid';
import { cabinsFor } from './cabinBlock';
import { crewRoom } from './roomSize';
import { SOLID, type RegionGrid } from './regions';
import type { Part, Placed } from './placeLayout';

/** PROTOTYPE (#581): paints a placed layout's room outlines (no fit-out): the frame's bridge, drive and corridors, then each part. */
export function paintPlaced(plan: ShipPlan, { fr, lay, battery }: Placed): RegionGrid {
  const { W, top, xS, dockAt, used, engine } = fr;
  const fg = frameGrid(fr, plan), { g, hall, docks, paint } = fg;
  const stubs = lay.stubs.map((s) => ({ ...s, id: g.hall('hall') })), maint = fr.maint ? g.hall('hall') : -1;
  const allParts = lay.blocks.flatMap((b) => b.pieces.flatMap((pc) => pc.parts));
  const frontOf = new Map<Part, [number, number]>();
  const rows = (q: Part, d: number): boolean => d >= (q.r0 === 1 ? BAND : BAND + q.r0) && d <= BAND + q.r1;
  for (const b of lay.blocks) for (const pc of b.pieces) {
    const front = new Map<Part, [number, number]>();
    const parts = [...pc.parts].filter((q) => q.x1 > q.x0 && q.spec.some((v) => v)).sort((p, q) => p.r0 - q.r0 || Number(isAnnex(p)) - Number(isAnnex(q)));
    function isAnnex(q: Part): boolean { return pc.parts.some((o) => o.spec.some((h, k) => !!h?.annex && h.annex === q.spec[k])); }
    for (const q of parts) {
      const ids = ([0, 1] as const).map((side) => {
        const h = q.spec[side], sign = side === 0 ? -1 : 1, d = (y: number): number => sign * y;
        if (!h) return -1;
        if (pc.cabins) {
          let rowsMin = Infinity;
          for (let tx = q.x0; tx < q.x1; tx++) rowsMin = Math.min(rowsMin, top(tx) - BAND - 1);
          const bl = cabinsFor(h, q.x1 - q.x0, rowsMin);
          if (!bl) { const id = g.room(h.role, { spec: h }); paint(id, q.x0, q.x1, (y) => d(y) >= BAND); return id; }
          const st = bl.stubs.map((s) => { const id = g.hall('hall'); paint(id, q.x0 + s.c0, q.x0 + s.c1, (y) => d(y) >= BAND + s.r0 && d(y) <= BAND + s.r1); return { id, s }; });
          for (const { rect: c, spec } of bl.cabins) {
            const own = st.find(({ s }) => s.c0 === c.c1 || s.c1 === c.c0)?.id ?? hall;
            paint(g.room('quarters', { spec, access: [own] }), q.x0 + c.c0, q.x0 + c.c1, (y) => d(y) >= BAND + c.r0 && d(y) <= BAND + c.r1);
          }
          for (const c of bl.rest) {
            const own = st.find(({ s }) => s.c0 >= c.c0 && s.c1 <= c.c1)?.id ?? hall, spec = crewRoom(['lounge', 'gym'], 30);
            paint(g.room(spec.role, { spec, access: [own] }), q.x0 + c.c0, q.x0 + c.c1, (y) => d(y) >= BAND + c.r0 && d(y) <= BAND + c.r1);
          }
          return hall;
        }
        // Its way in: the spine in front; behind, a cross corridor or stub it touches, else the room in front.
        const stub = stubs.find((s) => s.x === q.x0 - 1 || s.x === q.x1)?.id;
        const cross = (b.crossL && q.x0 === b.a) || (b.crossR && q.x1 === b.b) ? (dockAt < q.x0 ? docks[side] : docks[side]) : undefined;
        const host = parts.find((o) => o.spec[side]?.annex === h) ?? parts.find((o) => o.r0 < q.r0 && o.x0 <= q.x0 && q.x1 <= o.x1);
        const annexOf = parts.find((o) => o.spec[side]?.annex === h);
        const ahead = q.via === 'front' ? allParts.find((o) => o !== q && o.r0 < q.r0 && o.x0 <= q.x0 && q.x1 <= o.x1) : undefined;
        const fixed = q.via === 'dock' ? [docks[side]] : q.via === 'maint' ? [maint] : ahead ? [frontOf.get(ahead)?.[side] as number] : undefined;
        const access = fixed ?? (annexOf ? [front.get(annexOf)?.[side] as number] : q.r0 === 1 ? undefined : stub !== undefined ? [stub] : cross !== undefined ? [cross] : host ? [front.get(host)?.[side] as number] : undefined);
        const id = g.room(h.role, { spec: h, ...(access ? { access } : {}) });
        paint(id, q.x0, q.x1, (y) => rows(q, d(y)));
        return id;
      }) as [number, number];
      front.set(q, ids); frontOf.set(q, ids);
    }
  }
  const sternGrown = !lay.stern || !!lay.stern.grown;
  const engines: [number, number] = [g.room('engine', { spec: engine, doorFirst: true }), g.room('engine', { spec: engine, doorFirst: true })];
  paint(engines[0], xS + 1, W, (y) => y <= -BAND && (sternGrown || -y <= BAND + used));
  paint(engines[1], xS + 1, W, (y) => y >= BAND && (sternGrown || y <= BAND + used));
  const st = lay.stern;
  if (st?.spec[0]) for (const side of [0, 1] as const) {
    const h = st.spec[side] as RoomSpec, sign = side === 0 ? -1 : 1;
    paint(g.room(h.role, { spec: h, access: [engines[side]] }), st.x0, st.x1, (y) => sign * y >= BAND + st.r0);
  }
  // PROTOTYPE: the battery: each gun room from its blister in, chained to the next and to the dock by the maintenance
  // corridor along the hull between them (a door on each side the corridor reaches). A gun room gives way to its neighbours, so its walls are
  // its own and it stays a rectangle.
  const mt = fr.maint;
  if (mt) {
    const topAt = (x: number): number => { let y = 0; while (fr.inside(x, y + 1)) y++; return y; };
    const gun = (x: number): boolean => mt.guns.some(([s0, s1]) => x >= s0 && x < s1);
    // The corridor's row, plating outboard of it to the hull.
    for (let x = mt.a; x < mt.b; x++) if (!gun(x) && !(x >= fr.dockAt && x < fr.dockAt + fr.CW)) {
      paint(maint, x, x + 1, (y) => Math.abs(y) > mt.hallY(x) && Math.abs(y) <= mt.hallY(x) + 2);
      paint(SOLID, x, x + 1, (y) => Math.abs(y) > mt.hallY(x) + 2);
    }
    const outer: [number, number][] = [];
    mt.guns.forEach(([s0, s1], i) => {
      const pair = battery[i];
      if (!pair) return;
      outer[i] = [-1, -1];
      ([0, 1] as const).forEach((side) => {
        const h = pair[side], sign = side === 0 ? -1 : 1;
        paint((outer[i] as [number, number])[side] = g.room(h.role, { spec: h, access: [maint], doors: i === 0 || i === mt.guns.length - 1 ? 1 : 2, rank: -1 }), s0, s1, (y) => sign * y >= mt.hallY(s0) && sign * y <= topAt(s0));
      });
    });
    // A doubled column: the next gun pair inboard of the outer gun, the rest of the column, a door between them.
    mt.inner.forEach((site, j) => {
      const pair = battery[mt.guns.length + j], st = mt.guns[site], out = outer[site];
      if (!pair || !st || !out) return;
      ([0, 1] as const).forEach((side) => {
        const h = pair[side], sign = side === 0 ? -1 : 1;
        paint(g.room(h.role, { spec: h, rank: -2, access: [out[side]] }), st[0], st[1], (y) => sign * y >= BAND && sign * y < mt.hallY(st[0]));
      });
    });
  }
  closeFrame(fr, fg);
  for (const s of stubs) paint(s.id, s.x, s.x + 1, (y) => Math.abs(y) >= BAND);
  return g;
}
