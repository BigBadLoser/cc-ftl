/**
 * The labelled view (dev tool, not shipped): one layout per image, drawn large, every room named at its middle and every
 * piece of furniture marked with a two-letter code, with a key beside it (room colours, then the codes in use). For
 * reading a layout room by room; the contact sheets are for comparing many at a glance.
 *   node tools/shipgen/cli.js station.trading --size station --layout stationWheel --views labels --count 2
 * writes <base>-labels-s<seed>.png per seed.
 */
import type { ModuleDef, RoomRole } from '../../src/sim';
import { content } from '../../src/content';
import { rotatedSize } from '../../src/sim/modules/footprint';
import { gen, Raster, ROLE_TINT, type RGB } from './draw';

const defs = content.modules as Record<string, ModuleDef>;

/** Room names on the view (corridors stay unnamed). */
const NAMES: Partial<Record<RoomRole, string>> = {
  quarters: 'cabin', support: 'mess', cargo: 'cargo', dock: 'dock', bridge: 'office', armoury: 'armoury', plaza: 'court',
  garden: 'garden', drill: 'drill hall', shop: 'shop', medbay: 'medbay', reactor: 'reactor', shields: 'shields', core: 'ai core',
  weapons: 'gun bay', industry: 'industry', farm: 'farm', hangar: 'hangar', engine: 'engine',
};

/** Two-letter codes for furniture by module name; anything else takes its name's first two letters. */
const CODES: Record<string, string> = {
  Bed: 'BD', Locker: 'LK', 'Mess table': 'TB', Chair: 'CH', Galley: 'GA', 'Life support': 'LS', Fabricator: 'FB',
  'Storage crate': 'CR', 'Storage rack': 'RK', 'Cargo pallet': 'PA', 'Freight container': 'FC', 'Holo column': 'HO', Planter: 'PL',
  'Tree planter': 'TR', Bench: 'BE', Console: 'CO', Helm: 'HE', 'Weapons console': 'WC', 'Shield console': 'SC',
  'Shield generator': 'SG', 'AI core': 'AI', 'Point defence': 'PD', 'Burst laser': 'BL', 'Mass driver': 'MD', 'Ion cannon': 'IC',
  'Missile launcher': 'ML', 'Battery bank': 'BT', 'Medical bed': 'MB', Airlock: 'AK', Refinery: 'RF', Hydroponics: 'HY',
};
/** Lamps (floor lights, cage lamps, light masts) are dots, not coded pieces. */
const isLamp = (d: ModuleDef | undefined): boolean => !!d && !!d.light && /lamp|light/i.test(d.name);

const WALL: RGB = [120, 126, 138], DOOR: RGB = [230, 140, 40], HALL: RGB = [52, 56, 66], INK: RGB = [235, 235, 235], DARK: RGB = [30, 32, 40];

/** Text with a black outline, so it reads over any floor. */
function outlined(r: Raster, s: string, x: number, y: number, c: RGB, ts: number): void {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]] as const) r.text(s, x + dx * ts, y + dy * ts, [0, 0, 0], ts);
  r.text(s, x, y, c, ts);
}

/** One layout as a labelled image: tiles `t` pixels square, the key in a column on the right. */
export function labelView(spec: string, seed: number, depth = 4, t = 16): Raster {
  const g = gen(spec, seed, depth);
  const rows = g.template.rows;
  const H = rows.length, W = Math.max(...rows.map((row) => row.length));
  const roles = g.rooms.map((rm) => rm.role as RoomRole);
  const KEY = 320, TOP = 40;
  const r = new Raster(W * t + KEY, Math.max(H * t + TOP + 10, 760));
  r.text(`${spec} seed ${seed}`, 8, 12, INK, 3);
  const mid = new Map<number, [number, number, number]>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = rows[y]?.[x] ?? '.';
    if (c === '.') continue;
    const px = x * t, py = TOP + y * t;
    if (c === '#') { r.rect(px, py, t, t, WALL); continue; }
    if (c === 'D') { r.rect(px, py, t, t, DOOR); continue; }
    const room = g.roomOf[y * W + x] ?? -1;
    const role = roles[room] ?? 'hall';
    r.rect(px, py, t, t, role === 'hall' ? HALL : ROLE_TINT[role] ?? HALL);
    if (room >= 0) { const m = mid.get(room) ?? [0, 0, 0]; m[0] += x; m[1] += y; m[2]++; mid.set(room, m); }
  }
  const used = new Map<string, string>();
  let lamps = false;
  for (const m of g.template.modules ?? []) {
    const def = defs[m.def];
    if (isLamp(def)) { lamps = true; r.rect(m.x * t + (t >> 1) - 2, TOP + m.y * t + (t >> 1) - 2, 4, 4, [255, 230, 120]); continue; }
    const name = def?.name ?? m.def;
    const code = CODES[name] ?? name.slice(0, 2).toUpperCase();
    used.set(code, name);
    const [w, h] = def ? rotatedSize(def, m.rot ?? 0) : [1, 1];
    const x0 = m.x * t + 1, y0 = TOP + m.y * t + 1;
    r.rect(x0, y0, w * t - 2, h * t - 2, DARK);
    r.frame(x0, y0, w * t - 2, h * t - 2, INK);
    r.text(code, x0 + ((w * t - 2) >> 1) - 7, y0 + ((h * t - 2) >> 1) - 5, INK, 2);
  }
  // Room names at the middle of every room big enough to carry one.
  for (const [room, [sx, sy, n]] of mid) {
    const name = NAMES[roles[room] as RoomRole];
    if (!name || n < 10) continue;
    const cx = (sx / n) * t + (t >> 1), cy = TOP + (sy / n) * t + (t >> 1);
    outlined(r, name, Math.round(cx - name.length * 4), Math.round(cy - 5), [255, 255, 255], 2);
  }
  // The key: room colours, then the furniture codes in use.
  const kx = W * t + 16;
  let ky = TOP + 10;
  r.text('rooms', kx, ky, INK, 3); ky += 26;
  const swatch = (c: RGB, label: string): void => { r.rect(kx, ky, 18, 14, c); r.text(label, kx + 26, ky + 2, INK, 2); ky += 20; };
  for (const role of [...new Set(roles)].sort()) if (role !== 'hall') swatch(ROLE_TINT[role] ?? HALL, NAMES[role] ?? role);
  swatch(HALL, 'corridor');
  swatch(DOOR, 'door');
  ky += 10;
  r.text('furniture', kx, ky, INK, 3); ky += 26;
  for (const [code, name] of [...used].sort((a, b) => a[1].localeCompare(b[1]))) { r.text(`${code} ${name}`, kx, ky, INK, 2); ky += 16; }
  if (lamps) { r.rect(kx + 4, ky + 3, 5, 5, [255, 230, 120]); r.text('lamp', kx + 26, ky, INK, 2); }
  return r;
}
