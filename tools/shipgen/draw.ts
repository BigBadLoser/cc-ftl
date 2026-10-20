/**
 * Ship layout viewer core (dev tool, not shipped): renders generated layouts top-down into an RGBA buffer, plus an
 * ASCII dump and a validation summary. Used by the node CLI (PNG contact sheets) and the live page.
 */
import { content } from '../../src/content';
import {
  accessTile, adjacencyDistance, adjacencySignature, footprintTiles, generateShip, meanPairwise, profileDistance, rotatedSize, silhouetteDistance, silhouetteMask, type GenResult, type ModuleDef, type RoomRole,
} from '../../src/sim';
import { drawAssemblies, drawSilhouette, drawStructure } from './views';

export type View = 'detail' | 'silhouette' | 'assembly' | 'structure';

type RGB = [number, number, number];

export class Raster {
  readonly data: Uint8ClampedArray;
  constructor(readonly width: number, readonly height: number, bg: RGB = [16, 18, 24]) {
    this.data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) this.data.set([...bg, 255], i * 4);
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let j = Math.max(0, y); j < Math.min(this.height, y + h); j++) {
      for (let i = Math.max(0, x); i < Math.min(this.width, x + w); i++) this.data.set(c, (j * this.width + i) * 4);
    }
  }
  frame(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
    this.rect(x, y, w, t, c); this.rect(x, y + h - t, w, t, c); this.rect(x, y, t, h, c); this.rect(x + w - t, y, t, h, c);
  }
  text(s: string, x: number, y: number, c: RGB, scale = 1): void {
    let cx = x;
    for (const ch of s.toUpperCase()) {
      const g = GLYPHS[ch] ?? GLYPHS['?'] as string;
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') this.rect(cx + i * scale, y + j * scale, scale, scale, c);
      cx += 4 * scale;
    }
  }
}

/** 3x5 pixel font, rows top to bottom. */
const GLYPHS: Record<string, string> = Object.fromEntries(Object.entries({
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', '-': '000000111000000', '.': '000000000000010', ':': '000010000010000', '/': '001001010100100',
  '#': '101111101111101', ' ': '000000000000000', ',': '000000000010100', '(': '010100100100010', ')': '010001001001010', '?': '110001010000010', '=': '000111000111000', '+': '000010111010000',
}));

const ROLE_TINT: Record<RoomRole, RGB> = {
  bridge: [52, 92, 140], engine: [120, 70, 40], reactor: [120, 110, 40], weapons: [120, 50, 70], shields: [40, 110, 120],
  cargo: [88, 80, 60], quarters: [70, 100, 60], core: [100, 60, 130], hangar: [70, 70, 90], hall: [58, 60, 66],
  dock: [140, 140, 150], support: [50, 105, 90],
};

/** Short labels and colours per module. */
const MOD: Record<string, { label: string; c: RGB }> = {
  'module.engine': { label: 'ENG', c: [255, 120, 40] }, 'module.reactor': { label: 'R', c: [240, 220, 60] },
  'module.helm': { label: 'HLM', c: [90, 170, 255] }, 'module.weaponsConsole': { label: 'WC', c: [90, 170, 255] },
  'module.shieldConsole': { label: 'SC', c: [90, 170, 255] }, 'module.burstLaser': { label: 'BL', c: [255, 70, 140] },
  'module.massDriver': { label: 'MD', c: [255, 70, 140] }, 'module.missileLauncher': { label: 'MSL', c: [255, 70, 140] },
  'module.ionCannon': { label: 'ION', c: [255, 70, 140] }, 'module.incendiaryLauncher': { label: 'INC', c: [255, 70, 140] },
  'module.shieldGen': { label: 'SH', c: [60, 230, 230] }, 'module.shieldGenSmall': { label: 'sh', c: [60, 230, 230] },
  'module.aiCore': { label: 'AI', c: [200, 110, 255] }, 'module.pointDefense': { label: 'PD', c: [200, 110, 255] },
  'module.bed': { label: 'B', c: [150, 200, 120] }, 'module.lifeSupport': { label: 'LS', c: [120, 230, 160] },
  'module.storage': { label: 'C', c: [200, 170, 110] }, 'module.fabricator': { label: 'FAB', c: [200, 170, 110] },
  'module.vehicle_bay': { label: 'BAY', c: [180, 180, 210] }, 'module.airlock': { label: 'A', c: [255, 255, 255] },
  'module.light': { label: '', c: [255, 250, 200] },
  'module.galley': { label: 'GAL', c: [255, 190, 120] }, 'module.mess_table': { label: 'TB', c: [235, 205, 160] },
  'module.chair': { label: 'h', c: [235, 205, 160] }, 'module.storage_locker': { label: 'L', c: [170, 190, 210] },
  'module.storage_rack': { label: 'RK', c: [210, 160, 90] }, 'module.storage_pallet': { label: 'PAL', c: [210, 160, 90] },
  'module.med_bed': { label: 'MED', c: [255, 140, 140] }, 'module.battery': { label: 'BT', c: [240, 220, 60] },
  'module.hydroponics': { label: 'HY', c: [110, 230, 90] }, 'module.console': { label: 'CN', c: [90, 170, 255] },
};

const defs = content.modules as Record<string, ModuleDef>;

export const factionIds = (): string[] => Object.keys(content.factions);

/** `faction.drones:picket` keeps only that hull family (one family's sheet). */
export function gen(factionSpec: string, seed: number, depth: number): GenResult {
  const [faction, family] = factionSpec.split(':') as [string, string | undefined];
  const f0 = (content.factions as Record<string, (typeof content.factions)[keyof typeof content.factions]>)[faction];
  if (!f0) throw new Error(`unknown faction ${faction}; try ${factionIds().join(', ')}`);
  const f = family && f0.hullFamilies ? { ...f0, hullFamilies: f0.hullFamilies.filter((h) => h.id === family) } : f0;
  return generateShip(f as typeof f0, faction, seed, depth, defs);
}

/** Draw one layout at (ox, oy), `s` px per tile. */
export function drawShip(r: Raster, g: GenResult, ox: number, oy: number, s: number): void {
  const rows = g.template.rows;
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const c = rows[y]?.[x] ?? '.';
      if (c === '.') continue;
      const px = ox + x * s; const py = oy + y * s;
      if (c === '_') {
        const room = g.roomOf[y * g.width + x] ?? -1;
        r.rect(px, py, s, s, room >= 0 ? ROLE_TINT[g.rooms[room]?.role ?? 'hall'] : [60, 60, 60]);
        r.rect(px, py, 1, 1, [30, 30, 34]);
      } else if (c === 'D') r.rect(px + 1, py + 1, s - 2, s - 2, [230, 150, 40]);
      else if (c === '=') { r.rect(px, py, s, s, [120, 60, 120]); r.rect(px + 1, py + (s >> 1) - 1, s - 2, 2, [235, 70, 200]); }
      else {
        const hull = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => (rows[y + (dy as number)]?.[x + (dx as number)] ?? '.') === '.');
        r.rect(px, py, s, s, hull ? [150, 160, 175] : [100, 104, 112]);
      }
    }
  }
  for (const m of g.template.modules ?? []) {
    const def = defs[m.def];
    if (!def) continue;
    const style = MOD[m.def] ?? { label: '?', c: [255, 255, 255] as RGB };
    if (m.def === 'module.light') {
      r.rect(ox + m.x * s + (s >> 1) - 1, oy + m.y * s + (s >> 1) - 1, 3, 3, style.c);
      continue;
    }
    const [w, h] = rotatedSize(def, m.rot);
    const px = ox + m.x * s; const py = oy + m.y * s;
    if (def.solid) for (const t of footprintTiles(def, m.x, m.y, m.rot)) r.rect(ox + t.x * s + 2, oy + t.y * s + 2, s - 4, s - 4, style.c.map((v) => v * 0.35) as RGB);
    r.frame(px + 1, py + 1, w * s - 2, h * s - 2, style.c, def.weapon || def.engine ? 2 : 1);
    if (def.weapon) { // a cross marks weapons (their roof turret sits over the footprint)
      for (let k = 2; k < Math.min(w, h) * s - 2; k++) { r.rect(px + k, py + k, 1, 1, style.c); r.rect(px + w * s - 1 - k, py + k, 1, 1, style.c); }
    }
    if (def.engine) r.rect(px + w * s - 2, py + 2, 4, h * s - 4, [255, 200, 80]); // the bell side
    const label = style.label;
    const fs = s >= 24 ? 2 : 1;
    if (label && label.length * 4 * fs <= w * s) r.text(label, px + 3, py + 3, style.c, fs);
    // The access tile (where crew stand to use it, or a seat's facing edge): a small square in the module's colour.
    const a = accessTile(def, m.x, m.y, m.rot);
    if (a) r.rect(ox + a.x * s + (s >> 1) - 2, oy + a.y * s + (s >> 1) - 2, 4, 4, style.c);
    else if (m.def === 'module.chair') {
      const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][m.rot] as [number, number];
      r.rect(px + (s >> 1) - 1 + dx * (s >> 2), py + (s >> 1) - 1 + dy * (s >> 2), 3, 3, style.c);
    }
  }
}

export function ascii(g: GenResult): string {
  const grid = g.template.rows.map((row) => row.split(''));
  for (const m of g.template.modules ?? []) {
    const def = defs[m.def];
    if (!def) continue;
    const ch = m.def === 'module.light' ? '*' : (MOD[m.def]?.label[0] ?? '?');
    for (const t of footprintTiles(def, m.x, m.y, m.rot)) if (grid[t.y]?.[t.x] !== undefined) (grid[t.y] as string[])[t.x] = ch;
  }
  return grid.map((r) => r.join('')).join('\n');
}

/** One line per seed: size, rooms, power, weapons, attempts and problems. */
export function summary(g: GenResult, seed: number): string {
  const mods = g.template.modules ?? [];
  const n = (pred: (d: ModuleDef) => boolean): number => mods.filter((m) => defs[m.def] && pred(defs[m.def] as ModuleDef)).length;
  let supply = 0; let demand = 0;
  for (const m of mods) { const p = defs[m.def]?.power ?? 0; if (p > 0) supply += p; else demand -= p; }
  const roles = g.rooms.map((r) => r.role).filter((r) => r !== 'hall');
  return `seed ${seed}: ${g.role}/${g.archetype} (${g.topology}) ${g.width}x${g.height} ${roles.length} rooms, power ${demand}/${supply}, weapons ${n((d) => !!d.weapon)}, ` +
    `shields ${n((d) => !!d.shieldGen)}, engines ${n((d) => !!d.engine)}, crew ${g.template.crew?.length ?? 0}, ` +
    `${g.metrics ? `metrics ${JSON.stringify(g.metrics)}, ` : ''}attempts ${g.attempts}, ${g.problems.length === 0 ? 'OK' : `INVALID: ${g.problems.join('; ')}`}` +
    (g.failures.length > 0 ? ` [rejected: ${g.failures.join(', ')}]` : '');
}

/** Mean door openings (runs of touching door tiles) per non-hall room. */
export function doorsPerRoom(g: GenResult): number {
  const rows = g.template.rows;
  const at = (x: number, y: number): string => rows[y]?.[x] ?? '.';
  const seen = new Set<number>();
  const count = new Map<number, number>();
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      if (at(x, y) !== 'D' || seen.has(y * g.width + x)) continue;
      const rooms = new Set<number>();
      const stack = [[x, y] as [number, number]];
      seen.add(y * g.width + x);
      while (stack.length > 0) {
        const [cx, cy] = stack.pop() as [number, number];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx; const ny = cy + dy;
          const c = at(nx, ny);
          if (c === 'D' && !seen.has(ny * g.width + nx)) { seen.add(ny * g.width + nx); stack.push([nx, ny]); }
          if (c === '_') rooms.add(g.roomOf[ny * g.width + nx] ?? -1);
        }
      }
      for (const r of rooms) count.set(r, (count.get(r) ?? 0) + 1);
    }
  }
  const rooms = g.rooms.filter((r) => r.role !== 'hall' && r.tiles.length > 0);
  return rooms.reduce((t, r) => t + (count.get(r.id) ?? 0), 0) / Math.max(1, rooms.length);
}

/** Room interiors as role, size and module layout relative to the room's corner (lights left out). */
function interiors(g: GenResult): { key: string; sig: string }[] {
  const out: { key: string; sig: string }[] = [];
  for (const room of g.rooms) {
    if (room.role === 'hall' || room.tiles.length === 0) continue;
    const xs = room.tiles.map((i) => i % g.width); const ys = room.tiles.map((i) => Math.floor(i / g.width));
    const x0 = Math.min(...xs); const y0 = Math.min(...ys);
    const mods = (g.template.modules ?? []).filter((m) => m.def !== 'module.light' && g.roomOf[m.y * g.width + m.x] === room.id);
    if (mods.length === 0) continue;
    out.push({
      key: `${room.role} ${Math.max(...xs) - x0}x${Math.max(...ys) - y0} ${room.tiles.length}`,
      sig: mods.map((m) => `${m.def}@${m.x - x0},${m.y - y0},${m.rot}`).sort().join(' '),
    });
  }
  return out;
}

/**
 * Interior repetition: of the furnished rooms that have a same-role, same-shape twin on another ship of the sheet,
 * the share laid out identically to one of them.
 */
export function interiorDups(gs: GenResult[]): { share: number; rooms: number; byRole: string } {
  const all = gs.map(interiors);
  let twins = 0; let same = 0;
  const per = new Map<string, [number, number]>();
  all.forEach((rs, i) => {
    for (const r of rs) {
      const others = all.flatMap((o, j) => (j === i ? [] : o.filter((q) => q.key === r.key)));
      if (others.length === 0) continue;
      twins++;
      const dup = others.some((q) => q.sig === r.sig);
      if (dup) same++;
      const role = r.key.split(' ')[0] as string;
      const p = per.get(role) ?? [0, 0];
      per.set(role, [p[0] + (dup ? 1 : 0), p[1] + 1]);
    }
  });
  const byRole = [...per].sort().map(([k, [a, b]]) => `${k} ${a}/${b}`).join(', ');
  return { share: twins ? same / twins : 0, rooms: twins, byRole };
}

/** A contact sheet of seeds [from, from + count) for one faction at one depth. */
export function contactSheet(
  faction: string, from: number, count: number, depth: number, s = 10, maxWidth = 1800, view: View = 'detail',
): { raster: Raster; text: string } {
  const ts = s >= 12 ? 2 : 1;
  const errors: string[] = [];
  const ships = Array.from({ length: count }, (_, i) => {
    try {
      return { seed: from + i, g: gen(faction, from + i, depth) };
    } catch (e) {
      errors.push(`seed ${from + i}: FAILED ${String(e).slice(0, 600)}`);
      return null;
    }
  }).filter((x): x is { seed: number; g: GenResult } => x !== null);
  if (ships.length === 0) return { raster: new Raster(200, 20), text: errors.join('\n') };
  const cellW = Math.max(...ships.map((x) => x.g.width)) * s + 16;
  const cellH = Math.max(...ships.map((x) => x.g.height)) * s + 18 * ts + 16;
  const cols = Math.min(count, Math.max(1, Math.floor(maxWidth / cellW)));
  const rowsN = Math.ceil(count / cols);
  const r = new Raster(cols * cellW + 8, rowsN * cellH + 30);
  const masks = ships.map((x) => silhouetteMask(x.g.template.rows));
  const sil = meanPairwise(masks, silhouetteDistance);
  // Near-duplicates: same-family pairs whose normalised silhouettes overlap with IoU above 0.9 and whose proportions
  // are within 10%.
  const dupPairs: string[] = [];
  ships.forEach((p, i) => ships.slice(i + 1).forEach((q, k) => {
    const j = i + 1 + k;
    const ar = (g: GenResult): number => g.metrics?.aspect ?? g.width / g.height;
    if (p.g.role === q.g.role && silhouetteDistance(masks[i] as Uint8Array, masks[j] as Uint8Array) < 0.1 && Math.abs(ar(p.g) / ar(q.g) - 1) < 0.1) dupPairs.push(`${p.seed}~${q.seed}`);
  }));
  const spines = ships.map((x) => x.g.metrics?.spine ?? 0);
  const spine = spines.reduce((t, v) => t + v, 0) / Math.max(1, spines.length);
  const arch = meanPairwise(ships.map((x) => x.g.debug?.profile ?? x.g.topology), profileDistance);
  const sigs = ships.filter((x) => x.g.debug).map((x) => ({ fam: x.g.role, gram: x.g.topology.split(' ')[0], sig: adjacencySignature(x.g.debug!) }));
  const adj = meanPairwise(sigs, (p, q) => adjacencyDistance(p.sig, q.sig));
  const within = meanPairwise(sigs, (p, q) => (p.fam === q.fam ? adjacencyDistance(p.sig, q.sig) : NaN));
  const pairsIn = sigs.flatMap((p, i) => sigs.slice(i + 1).filter((q) => q.fam === p.fam).map((q) => adjacencyDistance(p.sig, q.sig)));
  const pairsX = sigs.flatMap((p, i) => sigs.slice(i + 1).filter((q) => q.fam !== p.fam).map((q) => adjacencyDistance(p.sig, q.sig)));
  const mean = (xs: number[]): number => (xs.length ? xs.reduce((t, v) => t + v, 0) / xs.length : 0);
  void within;
  const gIn = sigs.flatMap((p, i) => sigs.slice(i + 1).filter((q) => q.gram === p.gram).map((q) => adjacencyDistance(p.sig, q.sig)));
  const gX = sigs.flatMap((p, i) => sigs.slice(i + 1).filter((q) => q.gram !== p.gram).map((q) => adjacencyDistance(p.sig, q.sig)));
  const dpr = ships.reduce((t, x) => t + doorsPerRoom(x.g), 0) / ships.length;
  const occ = ships.reduce((t, x) => t + (x.g.metrics?.occupancy ?? 0), 0) / ships.length;
  const idup = interiorDups(ships.map((x) => x.g));
  const roomText = `occupancy ${occ.toFixed(2)} doors/room ${dpr.toFixed(2)} interior dups ${(idup.share * 100).toFixed(0)}% of ${idup.rooms}`;
  const adjText = `${roomText} adjacency ${adj.toFixed(2)} (within family ${mean(pairsIn).toFixed(2)}, across ${mean(pairsX).toFixed(2)}; within grammar ${mean(gIn).toFixed(2)}, across ${mean(gX).toFixed(2)}) spine ${spine.toFixed(2)} dups ${dupPairs.length}`;
  r.text(`${faction} depth ${depth} seeds ${from}-${from + count - 1} ${view}  shape ${sil.toFixed(2)} sections ${arch.toFixed(2)} ${adjText}`, 8, 8, [230, 230, 230], 2);
  const text: string[] = [];
  ships.forEach(({ seed, g }, i) => {
    const ox = 8 + (i % cols) * cellW;
    const oy = 30 + Math.floor(i / cols) * cellH;
    r.text(`#${seed} ${g.role} / ${g.archetype} ${g.width}X${g.height}${g.problems.length ? ' BAD' : ''}`, ox, oy, g.problems.length ? [255, 80, 80] : [220, 220, 220], ts);
    const m = g.metrics;
    const ms = m ? ` C${m.compactness.toFixed(2)} O${m.occupancy.toFixed(2)} R${m.corridorRatio.toFixed(2)} N${m.narrowLinks.toFixed(2)}` : '';
    r.text(`${g.topology}${ms}`, ox, oy + 7 * ts, [150, 170, 200], ts);
    (view === 'silhouette' ? drawSilhouette : view === 'assembly' ? drawAssemblies : view === 'structure' ? drawStructure : drawShip)(r, g, ox, oy + 14 * ts + 4, s);
    text.push(summary(g, seed), ascii(g), '');
  });
  return { raster: r, text: [`diversity: shape ${sil.toFixed(3)}, sections ${arch.toFixed(3)}, ${adjText}`, `near-duplicates: ${dupPairs.join(' ') || 'none'}`, `interior dups by role: ${idup.byRole}`, ...errors, ...text].join('\n') };
}
