/**
 * Room sheets (dev tool, not shipped): rooms of one role across seeds, each drawn large on its own, top-down, so the
 * room engine's output reads at a glance (on a phone too). Every module is a coloured box with a short label, its front
 * marked by a bar on the side it faces (a chair's on the side it faces); doors are orange, other rooms' floor is dimmed.
 * A module that breaks a use rule (shipgen/rooms/usage.ts) is framed red, with the rule in the caption. A caption per room gives the
 * seed, size, floor and fill, and the modules by count; the legend lists only the modules on the sheet.
 */
import { content } from '../../src/content';
import { accessTile, checkUse, footprintTiles, rotatedSize, type GenResult, type ModuleDef, type RoomRole } from '../../src/sim';
import { gen, MOD, Raster, ROLE_TINT, type RGB } from './draw';

const defs = content.modules as Record<string, ModuleDef>;

/** Labels and colours for modules the ship sheets do not list. */
const EXTRA: Record<string, { label: string; c: RGB }> = {
  'module.light_cage': { label: 'LC', c: [255, 240, 170] }, 'module.light_mast': { label: 'LM', c: [255, 240, 170] },
  'module.planter': { label: 'PL', c: [90, 190, 90] }, 'module.planter_large': { label: 'TREE', c: [90, 190, 90] },
  'module.bench': { label: 'BN', c: [220, 210, 180] }, 'module.deck_inlay': { label: '', c: [120, 110, 80] },
  'module.deck_hazard': { label: '', c: [180, 160, 40] }, 'module.storage_ore': { label: 'ORE', c: [180, 120, 90] },
  'module.storage_ore_large': { label: 'ORE', c: [180, 120, 90] }, 'module.research': { label: 'LAB', c: [140, 200, 255] },
};
const style = (id: string): { label: string; c: RGB } => EXTRA[id] ?? MOD[id] ?? { label: id.replace('module.', '').slice(0, 3), c: [200, 200, 200] };
const short = (id: string): string => id.replace('module.', '').replace('storage_', '').replace(/_/g, ' ');

interface Pick { g: GenResult; seed: number; room: GenResult['rooms'][number] }

/** Up to `count` rooms of `role` from seeds `from`.., at most `perSeed` from one layout (largest first). */
function pickRooms(spec: string, role: RoomRole, from: number, count: number, depth: number, perSeed: number): Pick[] {
  const out: Pick[] = [];
  for (let seed = from; out.length < count && seed < from + count * 4; seed++) {
    const g = gen(spec, seed, depth);
    const mine = g.rooms.filter((r) => r.role === role && r.tiles.length > 0).sort((a, b) => b.tiles.length - a.tiles.length);
    for (const room of mine.slice(0, perSeed)) if (out.length < count) out.push({ g, seed, room });
  }
  return out;
}

/** Draw one room into a cell at (ox, oy) with `s` px a tile; returns the caption lines. */
function drawRoom(r: Raster, p: Pick, ox: number, oy: number, s: number, x0: number, y0: number): string[] {
  const { g, room } = p;
  const rows = g.template.rows;
  const W = g.width;
  const bx = (x: number): number => ox + (x - x0) * s;
  const by = (y: number): number => oy + (y - y0) * s;
  const xs = room.tiles.map((i) => i % W), ys = room.tiles.map((i) => Math.floor(i / W));
  const rx0 = Math.min(...xs) - 1, ry0 = Math.min(...ys) - 1, rx1 = Math.max(...xs) + 1, ry1 = Math.max(...ys) + 1;
  const mineTile = new Set(room.tiles);
  for (let y = ry0; y <= ry1; y++) {
    for (let x = rx0; x <= rx1; x++) {
      const c = rows[y]?.[x] ?? '.';
      const i = y * W + x;
      let col: RGB = [16, 18, 24];
      if (c === '#') col = [70, 74, 84];
      else if (c === 'D') col = [235, 140, 50];
      else if (c !== '.') col = mineTile.has(i) ? ROLE_TINT[room.role].map((v) => Math.round(v * 0.55 + 22)) as RGB : [34, 36, 42];
      r.rect(bx(x), by(y), s, s, col);
      if (c !== '.' && c !== '#') r.frame(bx(x), by(y), s, s, [0, 0, 0], 1);
    }
  }
  const counts = new Map<string, number>();
  const mods = (g.template.modules ?? []).map((m) => ({ ...m, rot: m.rot ?? 0 }));
  const issues = checkUse(rows, mods, defs, g.roomOf);
  const broken = new Map<number, string[]>();
  for (const b of issues) broken.set(b.module, [...(broken.get(b.module) ?? []), b.kind]);
  const mine: string[] = [];
  for (const [mi, m] of (g.template.modules ?? []).entries()) {
    const d = defs[m.def];
    if (!d) continue;
    const tiles = footprintTiles(d, m.x, m.y, m.rot ?? 0);
    if (!tiles.some((t) => mineTile.has(t.y * W + t.x))) continue;
    counts.set(m.def, (counts.get(m.def) ?? 0) + 1);
    const [w, h] = rotatedSize(d, m.rot ?? 0);
    const st = style(m.def);
    const lamp = !!d.light && !d.solid;
    if (lamp) { r.rect(bx(m.x) + s / 2 - 3, by(m.y) + s / 2 - 3, 6, 6, st.c); continue; }
    const bad = broken.get(mi);
    if (bad) mine.push(...bad.map((k) => `${st.label || short(m.def)} ${k}`));
    r.rect(bx(m.x) + 2, by(m.y) + 2, w * s - 4, h * s - 4, st.c);
    r.frame(bx(m.x) + 2, by(m.y) + 2, w * s - 4, h * s - 4, bad ? [230, 30, 30] : [0, 0, 0], bad ? 4 : 2);
    if (m.def === 'module.chair') {
      // A chair's front: the side a seated crew member faces (r0 -y, r1 +x, r2 +y, r3 -x).
      const rr = (m.rot ?? 0) % 4;
      if (rr === 0) r.rect(bx(m.x) + 4, by(m.y) + 2, s - 8, 4, [20, 20, 20]);
      else if (rr === 2) r.rect(bx(m.x) + 4, by(m.y + 1) - 6, s - 8, 4, [20, 20, 20]);
      else if (rr === 3) r.rect(bx(m.x) + 2, by(m.y) + 4, 4, s - 8, [20, 20, 20]);
      else r.rect(bx(m.x + 1) - 6, by(m.y) + 4, 4, s - 8, [20, 20, 20]);
    }
    // The front: a dark bar on the side the module is worked from.
    const a = accessTile(d, m.x, m.y, m.rot ?? 0);
    if (a) {
      if (a.y < m.y) r.rect(bx(m.x) + 4, by(m.y) + 2, w * s - 8, 4, [20, 20, 20]);
      else if (a.y >= m.y + h) r.rect(bx(m.x) + 4, by(m.y + h) - 6, w * s - 8, 4, [20, 20, 20]);
      else if (a.x < m.x) r.rect(bx(m.x) + 2, by(m.y) + 4, 4, h * s - 8, [20, 20, 20]);
      else r.rect(bx(m.x + w) - 6, by(m.y) + 4, 4, h * s - 8, [20, 20, 20]);
    }
    const ts = st.label.length * 4 * 2 <= w * s - 6 ? 2 : 1;
    r.text(st.label, bx(m.x) + Math.round((w * s - st.label.length * 4 * ts) / 2), by(m.y) + Math.round((h * s - 5 * ts) / 2), [10, 10, 10], ts);
  }
  const used = [...counts.entries()].filter(([id]) => !defs[id]?.light || defs[id]?.solid);
  let solidTiles = 0;
  for (const m of g.template.modules ?? []) {
    const d = defs[m.def];
    if (!d || (d.light && !d.solid)) continue;
    for (const t of footprintTiles(d, m.x, m.y, m.rot ?? 0)) if (mineTile.has(t.y * W + t.x)) solidTiles++;
  }
  const bw = Math.max(...xs) - Math.min(...xs) + 1, bh = Math.max(...ys) - Math.min(...ys) + 1;
  const tally = new Map<string, number>();
  for (const k of mine) tally.set(k, (tally.get(k) ?? 0) + 1);
  return [
    `seed ${p.seed}  ${bw}x${bh}  ${room.tiles.length} tiles  ${Math.round((100 * solidTiles) / room.tiles.length)}% full`,
    used.sort((a, b) => b[1] - a[1]).map(([id, n]) => `${style(id).label || short(id)} ${n}`).join('  '),
    [...tally].map(([k, n]) => `${n} ${k}`).join('  ') || 'no rule breaks',
  ];
}

/** A sheet of `count` rooms of `role` for a faction or `station.<kind>[:size]` spec, two to a row. */
export function roomSheet(spec: string, role: RoomRole, from: number, count: number, depth: number, perSeed = 1): { raster: Raster; text: string } {
  const picks = pickRooms(spec, role, from, count, depth, perSeed);
  const box = (p: Pick): [number, number, number, number] => {
    const xs = p.room.tiles.map((i) => i % p.g.width), ys = p.room.tiles.map((i) => Math.floor(i / p.g.width));
    return [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1];
  };
  // Each room scaled to fill its cell's width (a big tile for a small room, capped), rows as tall as their tallest room.
  const cols = 2;
  const cellW = 660;
  const tile = (p: Pick): number => { const [a, , c] = box(p); return Math.max(12, Math.min(40, Math.floor((cellW - 20) / (c - a + 1)))); };
  const roomH = (p: Pick): number => { const [, b, , d] = box(p); return (d - b + 1) * tile(p); };
  const CAP = 90;
  const rowH: number[] = [];
  for (let i = 0; i < picks.length; i += cols) rowH.push(Math.max(...picks.slice(i, i + cols).map(roomH)) + CAP + 24);
  // Legend: the modules on the sheet, with their full names.
  const onSheet = new Set<string>();
  for (const p of picks) for (const m of p.g.template.modules ?? []) {
    const d = defs[m.def];
    if (d && footprintTiles(d, m.x, m.y, m.rot ?? 0).some((t) => p.room.tiles.includes(t.y * p.g.width + t.x))) onSheet.add(m.def);
  }
  const legend = [...onSheet].sort();
  const per = 3;
  const head = 56 + Math.ceil(legend.length / per) * 30 + 16;
  const r = new Raster(cols * cellW + 20, head + rowH.reduce((t, h) => t + h, 0) + 10);
  r.text(`${role}: ${spec}`, 14, 14, [255, 255, 255], 4);
  legend.forEach((id, i) => {
    const x = 14 + (i % per) * Math.floor((cols * cellW) / per), y = 56 + Math.floor(i / per) * 30;
    const st = style(id);
    r.rect(x, y, 46, 22, st.c);
    r.text(st.label, x + 4, y + 4, [10, 10, 10], 3);
    r.text(short(id), x + 56, y + 4, [220, 220, 220], 3);
  });
  const text: string[] = [];
  let oy = head;
  picks.forEach((p, i) => {
    const ox = 10 + (i % cols) * cellW;
    const [x0, y0] = box(p);
    const lines = drawRoom(r, p, ox, oy + CAP, tile(p), x0, y0);
    r.text(lines[0] as string, ox, oy + 6, [255, 255, 255], 3);
    r.text(lines[1] as string, ox, oy + 30, [190, 200, 210], 3);
    r.text(lines[2] as string, ox, oy + 54, lines[2] === 'no rule breaks' ? [120, 200, 120] : [255, 90, 90], 2);
    text.push(...lines, '');
    if (i % cols === cols - 1) oy += rowH[Math.floor(i / cols)] as number;
  });
  return { raster: r, text: text.join('\n') };
}
