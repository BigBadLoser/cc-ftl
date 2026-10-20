import { modTiles, moduleMap, N4, shuffle } from './ruinGrid';
import type { RuinCtx } from './ruinTypes';

/**
 * Hooks for later (data only): where aliens could nest (egg sacs in dark sealed rooms, a nest in the biggest one, with
 * growth creeping round it) or where a rogue AI's robots would come from (beside fabricators, robot bays and cores).
 */
const ALIEN_WRECKS = ['civilian', 'scrapper'];

export function hooksStage(c: RuinCtx): void {
  if (c.infest === 'none') return;
  const mods = moduleMap(c);
  const items = new Set(c.meta.items.map((t) => t.y * c.width + t.x));
  for (const k of c.meta.caches) for (const t of k.items) items.add(t.y * c.width + t.x);
  const floor = (i: number): boolean => c.cells[i] === '_' && (mods[i] as number) < 0 && !items.has(i);
  const sealed = c.meta.rooms.filter((r) => r.air !== 'vacuum').sort((a, b) => b.tiles.length - a.tiles.length || a.id - b.id);
  if (c.infest === 'robot') {
    c.modules.forEach((m, i) => {
      if (!['module.robotFabricator', 'module.robotBay', 'module.aiCore', 'module.fabricator'].includes(m.def)) return;
      const spot = modTiles(c, i).flatMap((t) => N4.map(([dx, dy]) => (t.y + dy) * c.width + t.x + dx)).find(floor);
      if (spot !== undefined) c.meta.hooks.push({ kind: 'robotSpawn', x: spot % c.width, y: Math.floor(spot / c.width), size: 1 });
    });
    for (const r of sealed.slice(0, 2)) {
      const t = r.tiles.find(floor);
      if (t !== undefined) c.meta.hooks.push({ kind: 'robotSpawn', x: t % c.width, y: Math.floor(t / c.width), size: 1, art: 'decay.ai.scrap' });
    }
    return;
  }
  // Aliens move into old derelicts, and into civilian and scrapper wrecks of any age; a fresh navy wreck has none yet.
  if (c.meta.cause === 'combat' && !ALIEN_WRECKS.some((f) => c.origin.endsWith(f))) return;
  const nest = sealed[0];
  if (nest) {
    const t = nest.tiles.filter(floor)[Math.floor(nest.tiles.length / 2) % Math.max(1, nest.tiles.filter(floor).length)];
    if (t !== undefined) {
      c.meta.hooks.push({ kind: 'nest', x: t % c.width, y: Math.floor(t / c.width), size: 1, art: 'decay.eggs' });
      for (const i of nest.tiles) if (floor(i) && c.rng.chance(0.45)) c.meta.decals.push({ x: i % c.width, y: Math.floor(i / c.width), art: `decay.growth.floor.v${c.rng.int(0, 2)}` });
    }
  }
  const want = Math.round(2 + c.intensity * 4);
  const taken = new Set<number>();
  for (const r of shuffle(c, sealed.slice())) {
    if (c.meta.hooks.filter((h) => h.kind === 'eggsac').length >= want) break;
    const big = r.tiles.find((i) => [i, i + 1, i + c.width, i + c.width + 1].every((j) => floor(j) && !taken.has(j)) && i % c.width < c.width - 1);
    if (big !== undefined && c.rng.chance(0.5)) {
      for (const j of [big, big + 1, big + c.width, big + c.width + 1]) taken.add(j);
      c.meta.hooks.push({ kind: 'eggsac', x: big % c.width, y: Math.floor(big / c.width), size: 2, art: 'decay.eggsac.2x2' });
      continue;
    }
    const one = shuffle(c, r.tiles.filter((i) => floor(i) && !taken.has(i)))[0];
    if (one === undefined) continue;
    taken.add(one);
    c.meta.hooks.push({ kind: 'eggsac', x: one % c.width, y: Math.floor(one / c.width), size: 1, art: 'decay.eggsac.1x1' });
  }
}
