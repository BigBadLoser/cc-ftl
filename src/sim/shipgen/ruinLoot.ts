import { bfs, modTiles, moduleMap, N4, shuffle, touchesSpace, walkable } from './ruinGrid';
import type { RuinCache, RuinCtx, RuinItem, RuinRoom } from './ruinTypes';

/**
 * Loot: storage keeps part of its stock (a fresh wreck more, an old derelict was picked over), loose salvage and dropped
 * hand weapons lie about (near the blasts on a combat wreck), and one or two caches sit deep inside, in sealed rooms
 * whose doors are jammed shut. Each cache records how a boarding party reaches it (see `cacheAccess`).
 */
export function lootStage(c: RuinCtx): void {
  const combat = c.meta.cause === 'combat';
  c.modules.forEach((m, i) => {
    const def = c.defs[m.def];
    if (!def?.storage) return;
    const state = c.meta.modules.find((r) => r.index === i)?.state;
    const keep = state === 'destroyed' ? 0 : combat ? 0.3 + c.rng.next() * 0.5 : c.rng.next() * 0.35;
    const stock = (m.stock ?? [{ item: 'item.scrap', count: 10 }, { item: 'item.metal', count: 6 }, { item: 'item.parts', count: 3 }])
      .map((s) => ({ item: s.item, count: Math.floor(s.count * keep) })).filter((s) => s.count > 0);
    if (stock.length) m.stock = stock;
    else delete m.stock;
  });
  const used = new Set<number>();
  const mods = moduleMap(c);
  const free = (i: number): boolean => c.cells[i] === '_' && (mods[i] as number) < 0 && !used.has(i);
  const floor = shuffle(c, c.cells.map((_, i) => i).filter(free));
  const drop = (i: number, item: string, count: number, into: RuinItem[]): void => {
    used.add(i);
    into.push({ x: i % c.width, y: Math.floor(i / c.width), item, count });
  };
  // Loose salvage: debris near blasts on a combat wreck, anywhere on an old one.
  const near = (i: number): number => Math.min(99, ...c.meta.impacts.map((p) => Math.hypot((i % c.width) - p.x, Math.floor(i / c.width) - p.y) - p.r));
  const piles = combat ? floor.filter((i) => near(i) < 4) : floor;
  const n = Math.round(3 + c.intensity * 6);
  for (const i of piles.slice(0, n)) {
    if (!free(i)) continue;
    const item = c.rng.pick(['item.scrap', 'item.scrap', 'item.metal', 'item.parts', 'item.electronics', 'item.polymer']);
    drop(i, item, c.rng.int(2, 12), c.meta.items);
  }
  const guns = combat ? c.rng.int(1, 3) : c.rng.int(0, 1);
  for (const i of floor.filter(free).slice(0, guns)) drop(i, c.rng.pick(['item.sidearm', 'item.rifle', 'item.blade', 'item.ion_pistol']), 1, c.meta.items);
  caches(c, free, drop);
  debris(c, free);
}

function entries(c: RuinCtx): { dock: number[]; breach: number[] } {
  const dock: number[] = [];
  c.modules.forEach((m, i) => {
    if (!c.defs[m.def]?.airlock) return;
    for (const t of modTiles(c, i)) for (const [dx, dy] of N4) {
      const j = (t.y + dy) * c.width + t.x + dx;
      if (walkable(c.cells[j] ?? '.')) dock.push(j);
    }
  });
  const breach = c.cells.map((_, i) => i).filter((i) => walkable(c.cells[i] as string) && touchesSpace(c, i % c.width, Math.floor(i / c.width)));
  return { dock, breach };
}

/** How a party gets to tile `i`: walking in from the airlock, cutting a jammed door on the way, or only in suits via a breach. */
export function cacheAccess(c: RuinCtx, i: number): RuinCache['access'] | null {
  const shut = new Set(c.meta.doors.filter((d) => d.state === 'stuckShut').map((d) => d.y * c.width + d.x));
  const { dock, breach } = entries(c);
  const walk = (k: number): boolean => walkable(c.cells[k] as string);
  if (dock.length && (bfs(c, dock, (k) => walk(k) && !shut.has(k))[i] as number) >= 0) return 'open';
  if (dock.length && (bfs(c, dock, walk)[i] as number) >= 0) return 'forceDoor';
  if ((bfs(c, breach, walk)[i] as number) >= 0) return 'eva';
  return null;
}

function caches(c: RuinCtx, free: (i: number) => boolean, drop: (i: number, item: string, count: number, into: RuinItem[]) => void): void {
  const { dock, breach } = entries(c);
  const all = bfs(c, [...dock, ...breach], (k) => walkable(c.cells[k] as string));
  const depth = (r: RuinRoom): number => Math.min(...r.tiles.map((i) => (all[i] as number) < 0 ? 1e9 : (all[i] as number)));
  const rooms = c.meta.rooms
    .filter((r) => r.tiles.filter((i) => c.cells[i] === '_').length >= 4 && depth(r) < 1e9)
    .sort((a, b) => (a.air === 'vacuum' ? 1 : 0) - (b.air === 'vacuum' ? 1 : 0) || depth(b) - depth(a) || a.id - b.id);
  const want = c.intensity > 0.5 || c.cells.length > 1500 ? 2 : 1;
  for (const r of rooms.slice(0, want)) {
    const inRoom = new Set(r.tiles);
    for (const d of c.meta.doors) {
      const k = d.y * c.width + d.x;
      if (inRoom.has(k) || [k - 1, k + 1, k - c.width, k + c.width].some((j) => inRoom.has(j) && c.cells[j] === '_')) d.state = 'stuckShut';
    }
    const spots = r.tiles.filter(free);
    if (!spots.length) continue;
    const items: RuinItem[] = [];
    const loot = shuffle(c, ['item.rifle', 'item.missile', 'item.electronics', 'item.parts', 'item.sidearm', 'item.metal']);
    const k = c.rng.int(2, 3);
    spots.slice(0, k).forEach((i, n) => {
      const item = loot[n] as string;
      drop(i, item, item === 'item.rifle' || item === 'item.sidearm' ? c.rng.int(1, 2) : c.rng.int(6, 20), items);
    });
    const at = items[0] as RuinItem;
    const access = cacheAccess(c, at.y * c.width + at.x) ?? 'eva';
    c.meta.caches.push({ room: r.id, x: at.x, y: at.y, items, access });
  }
}

/** Debris props by the breaches and impacts. */
function debris(c: RuinCtx, free: (i: number) => boolean): void {
  const kinds = ['plates', 'cables', 'pipe', 'chunks', 'crate', 'junction'];
  for (const b of c.meta.breaches) {
    if (!c.rng.chance(0.3)) continue;
    for (const [dx, dy] of N4) {
      const i = (b.y + dy) * c.width + b.x + dx;
      if (b.x + dx < 0 || b.x + dx >= c.width || !free(i)) continue;
      c.meta.decals.push({ x: b.x + dx, y: b.y + dy, art: `decay.debris.${c.rng.pick(kinds)}` });
      break;
    }
  }
  for (const p of c.meta.impacts) {
    if (c.meta.cause !== 'combat') break;
    const R = Math.ceil(p.r + 1);
    for (let y = p.y - R; y <= p.y + R; y++) for (let x = p.x - R; x <= p.x + R; x++) {
      if (x < 0 || x >= c.width || c.cells[y * c.width + x] !== '_' || Math.hypot(x - p.x, y - p.y) > p.r + 1 || !c.rng.chance(0.5)) continue;
      c.meta.decals.push({ x, y, art: c.rng.chance(0.3) ? 'decay.breach.roof' : `decay.scorch.floor.v${c.rng.int(0, 2)}` });
    }
  }
}
