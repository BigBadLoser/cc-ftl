/**
 * Ruin preview (dev tool): the derelict pass over generated ships, one sheet per faction and cause, rows by intensity.
 * Floors tinted by air (vacuum blue, thin green, stale brown), lost tiles as dark red ghosts, breaches framed red,
 * modules framed by state (green intact, amber damaged, red destroyed with a cross), doors by state, loot dots,
 * caches (gold square, letter = access: O open, F force a door, E EVA only), hooks (magenta egg sacs / nest, cyan robot
 * spawns), fires orange, impact centres as red crosses.
 */
import { content } from '../../src/content';
import { footprintTiles, type ModuleDef } from '../../src/sim';
import { ruin } from '../../src/sim/shipgen/ruin';
import type { RuinCause, RuinResult } from '../../src/sim/shipgen/ruinTypes';
import { drawContainer, gen, Raster } from './draw';
import { rotatedSize } from '../../src/sim/modules/footprint';

type RGB = [number, number, number];
const defs = content.modules as Record<string, ModuleDef>;
const AIR: Record<string, RGB> = { vacuum: [34, 44, 78], thin: [62, 96, 70], stale: [96, 82, 58] };
const STATE: Record<string, RGB> = { intact: [90, 220, 110], damaged: [240, 180, 50], destroyed: [240, 60, 60] };
const DOOR: Record<string, RGB> = { free: [230, 150, 40], stuckOpen: [250, 240, 120], stuckShut: [200, 30, 30] };
const ACCESS = { open: 'O', forceDoor: 'F', eva: 'E' } as const;

function label(def: string): string {
  const m: Record<string, string> = { reactor: 'R', engine: 'ENG', storage: 'C', bed: 'B', helm: 'HLM', airlock: 'A', lifeSupport: 'LS', shieldGen: 'SH', aiCore: 'AI' };
  const k = def.replace('module.', '');
  return m[k] ?? k.slice(0, 2).toUpperCase();
}

export function drawRuin(r: Raster, before: string[], res: RuinResult, ox: number, oy: number, s: number): void {
  const { template: t, meta } = res;
  const w = Math.max(...before.map((row) => row.length));
  const air = new Map<number, string>();
  for (const room of meta.rooms) for (const i of room.tiles) air.set(i, room.air);
  for (let y = 0; y < before.length; y++) {
    for (let x = 0; x < w; x++) {
      const was = before[y]?.[x] ?? '.';
      const c = t.rows[y]?.[x] ?? '.';
      const px = ox + x * s, py = oy + y * s;
      if (c === '.') { if (was !== '.') r.rect(px, py, s, s, [58, 18, 20]); continue; }
      if (c === '_') r.rect(px, py, s, s, AIR[air.get(y * w + x) ?? 'stale'] as RGB);
      else if (c === 'D') {
        const d = meta.doors.find((q) => q.x === x && q.y === y);
        r.rect(px, py, s, s, AIR[air.get(y * w + x) ?? 'stale'] as RGB);
        r.rect(px + 1, py + 1, s - 2, s - 2, DOOR[d?.state ?? 'free'] as RGB);
      } else if (c === '=') r.rect(px, py, s, s, [120, 60, 120]);
      else r.rect(px, py, s, s, [120, 124, 134]);
    }
  }
  for (const b of meta.breaches) if (b.kind !== 'floor') r.frame(ox + b.x * s, oy + b.y * s, s, s, [255, 70, 50], 2);
  for (const d of meta.decals) {
    const col: RGB = d.art.includes('growth') ? [150, 60, 150] : d.art.includes('debris') ? [150, 150, 150] : [20, 20, 20];
    r.rect(ox + d.x * s + 1, oy + d.y * s + s - 3, s - 2, 2, col);
  }
  for (const m of meta.modules) {
    const tm = t.modules?.[m.index];
    const def = tm && defs[tm.def];
    if (!tm || !def || def.container) continue;
    const c = STATE[m.state] as RGB;
    if (tm.def === 'module.light') { r.rect(ox + tm.x * s + (s >> 1) - 1, oy + tm.y * s + (s >> 1) - 1, 3, 3, m.state === 'destroyed' ? c : meta.power === 'off' ? [80, 80, 60] : [255, 250, 200]); continue; }
    const tiles = footprintTiles(def, tm.x, tm.y, tm.rot);
    const x0 = Math.min(...tiles.map((q) => q.x)), y0 = Math.min(...tiles.map((q) => q.y));
    const ww = (Math.max(...tiles.map((q) => q.x)) - x0 + 1) * s, hh = (Math.max(...tiles.map((q) => q.y)) - y0 + 1) * s;
    const px = ox + x0 * s, py = oy + y0 * s;
    if (m.state === 'destroyed') {
      r.rect(px + 1, py + 1, ww - 2, hh - 2, [40, 22, 18]);
      for (let k = 2; k < Math.min(ww, hh) - 2; k++) { r.rect(px + k, py + k, 1, 1, c); r.rect(px + ww - 1 - k, py + k, 1, 1, c); }
    }
    r.frame(px + 1, py + 1, ww - 2, hh - 2, c, 1);
    const l = label(tm.def);
    if (l.length * 4 <= ww - 2) r.text(l, px + 3, py + 3, c);
  }
  // Containers: sealed orange (grey patch plate and frame: patched), breached rust with a red frame, destroyed dark with a cross; torn ones drift outside the
  // hull (cyan frame, a tick along their drift).
  for (const k of meta.containers) {
    const def = defs[k.def];
    if (!def) continue;
    const [w, h] = rotatedSize(def, k.rot);
    const px = Math.round(ox + (k.x - w / 2) * s), py = Math.round(oy + (k.y - h / 2) * s);
    const tint: RGB = k.fate === 'destroyed' ? [52, 34, 28] : k.fate === 'breached' ? [150, 74, 40] : k.stock.length ? [214, 128, 54] : [120, 124, 132];
    const tm = k.index !== undefined ? t.modules?.[k.index] : undefined;
    drawContainer(r, px, py, w, h, s, (tm as { clamp?: string } | undefined)?.clamp ?? 'none', k.stock.length > 0, tint);
    if (k.fate === 'breached') r.frame(px, py, w * s, h * s, [255, 60, 50], 2);
    if (k.patched) { r.rect(px + 3, py + 3, s, s, [150, 156, 166]); r.frame(px + 1, py + 1, w * s - 2, h * s - 2, [150, 156, 166], 1); }
    if (k.fate === 'destroyed') for (let q = 2; q < Math.min(w, h) * s - 2; q++) { r.rect(px + q, py + q, 1, 1, [240, 60, 60]); r.rect(px + w * s - 1 - q, py + q, 1, 1, [240, 60, 60]); }
    if (k.fate === 'torn') {
      r.frame(px, py, w * s, h * s, [60, 230, 255], 1);
      const cx = px + (w * s) / 2, cy = py + (h * s) / 2, sp = Math.hypot(k.vx, k.vy) || 1;
      for (let q = 0; q < 2 * s; q++) r.rect(Math.round(cx + (k.vx / sp) * q), Math.round(cy + (k.vy / sp) * q), 2, 2, [60, 230, 255]);
    }
  }
  for (const f of meta.fires) r.rect(ox + f.x * s + 2, oy + f.y * s + 2, s - 4, s - 4, [255, 120, 20]);
  for (const it of meta.items) r.rect(ox + it.x * s + (s >> 1) - 1, oy + it.y * s + (s >> 1) - 1, 3, 3, it.count === 1 ? [80, 230, 255] : [235, 235, 235]);
  for (const k of meta.caches) {
    for (const it of k.items) r.frame(ox + it.x * s + 1, oy + it.y * s + 1, s - 2, s - 2, [255, 210, 40], 2);
    r.text(ACCESS[k.access], ox + k.x * s + 3, oy + k.y * s + 3, [255, 210, 40]);
  }
  for (const h of meta.hooks) {
    const c: RGB = h.kind === 'robotSpawn' ? [60, 230, 255] : [255, 60, 220];
    const z = h.size * s;
    if (h.kind === 'nest') r.rect(ox + h.x * s, oy + h.y * s, s, s, c);
    else r.frame(ox + h.x * s + 2, oy + h.y * s + 2, z - 4, z - 4, c, 2);
  }
  for (const p of meta.impacts) {
    if (meta.cause !== 'combat') continue;
    const cx = ox + p.x * s + (s >> 1), cy = oy + p.y * s + (s >> 1);
    r.rect(cx - 4, cy, 9, 1, [255, 40, 40]); r.rect(cx, cy - 4, 1, 9, [255, 40, 40]);
  }
}

/** Sheet: one faction, one cause; rows are intensities, columns seeds. */
export function ruinSheet(faction: string, from: number, count: number, depth: number, s: number, cause: RuinCause, levels: number[]): { raster: Raster; text: string } {
  const ships = Array.from({ length: count }, (_, i) => ({ seed: from + i, g: gen(faction, from + i, depth) }));
  // A margin round each ship for torn-off containers drifting beside it.
  const M = 9;
  const cellW = (Math.max(...ships.map((x) => x.g.width)) + 2 * M) * s + 16;
  const cellH = (Math.max(...ships.map((x) => x.g.height)) + 2 * M) * s + 24;
  const r = new Raster(count * cellW + 70, levels.length * cellH + 40);
  r.text(`${faction} ruin ${cause}  O open F force E eva  magenta eggsac/nest  cyan robot/weapon  gold cache`, 8, 8, [230, 230, 230], 2);
  const text: string[] = [];
  levels.forEach((lv, row) => {
    r.text(`I${lv}`, 4, 40 + row * cellH + 14, [230, 230, 230], 2);
    ships.forEach(({ seed, g }, i) => {
      const res = ruin(g.template, seed, { intensity: lv, cause, defs, origin: faction, infest: faction.includes('drone') ? 'robot' : 'alien' });
      const m = res.meta;
      const ox = 60 + i * cellW, oy = 40 + row * cellH;
      const dead = m.modules.filter((q) => q.state === 'destroyed').length;
      r.text(`#${seed} ${m.power} lost ${m.sheared} br ${m.breaches.length} x${dead}/${m.modules.length}`, ox, oy, [200, 200, 200]);
      drawRuin(r, g.template.rows, res, ox + M * s, oy + 10 + M * s, s);
      text.push(`seed ${seed} I${lv} ${cause}: ${JSON.stringify({ power: m.power, sheared: m.sheared, breaches: m.breaches.length, destroyed: dead, modules: m.modules.length, rooms: m.rooms.map((q) => q.air[0]).join(''), caches: m.caches.map((k) => k.access), hooks: m.hooks.length, fires: m.fires.length, containers: m.containers.map((q) => q.fate[0]).join('') })}`, res.template.rows.join('\n'), '');
    });
  });
  return { raster: r, text: text.join('\n') };
}
