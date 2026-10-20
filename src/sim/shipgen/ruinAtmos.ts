import { components, touchesSpace, walkable } from './ruinGrid';
import type { RuinCtx, RuinRoom } from './ruinTypes';

/**
 * Atmosphere: air regions are walkable tiles joined through floors and stuck-open doors (a closed or jammed-shut door
 * seals). A region touching space is vacuum. A sealed region of a fresh combat wreck holds thin, cooling air; an old
 * derelict's sealed rooms are stale and frozen. A shut door takes the air of its worse side. Combat wrecks may still
 * burn where a sealed room has the oxygen for it.
 */
export function atmosphereStage(c: RuinCtx): void {
  const open = new Set(c.meta.doors.filter((d) => d.state === 'stuckOpen').map((d) => d.y * c.width + d.x));
  const { label, sizes } = components(c, (i) => c.cells[i] === '_' || open.has(i));
  const combat = c.meta.cause === 'combat';
  const rooms: RuinRoom[] = sizes.map((_, id) => ({ id, tiles: [], air: 'stale', o2: 0, co2: 0, temp: 0 }));
  for (let i = 0; i < label.length; i++) if ((label[i] as number) >= 0) rooms[label[i] as number]?.tiles.push(i);
  for (const r of rooms) {
    const vac = r.tiles.some((i) => touchesSpace(c, i % c.width, Math.floor(i / c.width)));
    if (vac) Object.assign(r, { air: 'vacuum', o2: 0, co2: 0, temp: combat ? -40 : -100 });
    else if (combat) Object.assign(r, { air: 'thin', o2: round1(9 + c.rng.next() * 8 * (1 - c.intensity * 0.5)), co2: round1(0.5 + c.rng.next() * 1.5), temp: Math.round(2 + c.rng.next() * 14) });
    else Object.assign(r, { air: 'stale', o2: round1(2 + c.rng.next() * 6), co2: round1(1.5 + c.rng.next() * 3), temp: Math.round(-60 + c.rng.next() * 40) });
  }
  // Closed doors join the worse neighbouring room.
  for (let i = 0; i < c.cells.length; i++) {
    if (c.cells[i] !== 'D' || open.has(i)) continue;
    const x = i % c.width;
    const ns = [i - 1, i + 1, i - c.width, i + c.width].filter((j) => (x > 0 || j !== i - 1) && (x < c.width - 1 || j !== i + 1));
    const adj = ns.map((j) => rooms[label[j] ?? -1]).filter((r): r is RuinRoom => !!r);
    const worst = adj.sort((a, b) => a.o2 - b.o2)[0];
    if (worst) worst.tiles.push(i);
    else if (walkable(c.cells[i] as string)) rooms.push({ id: rooms.length, tiles: [i], air: 'vacuum', o2: 0, co2: 0, temp: -100 });
  }
  c.meta.rooms = rooms;
  if (!combat) return;
  for (const r of rooms) {
    if (r.air !== 'thin' || r.o2 < 12) continue;
    for (const i of r.tiles) {
      const x = i % c.width, y = Math.floor(i / c.width);
      const hot = c.meta.impacts.some((p) => Math.hypot(x - p.x, y - p.y) < p.r + 3);
      if (hot && c.cells[i] === '_' && c.rng.chance(0.25 * c.intensity)) c.meta.fires.push({ x, y, level: c.rng.int(60, 200) });
    }
  }
}

const round1 = (v: number): number => Math.round(v * 10) / 10;
