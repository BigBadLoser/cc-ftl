/**
 * The labelled view (dev tool, not shipped): one layout per image, drawn large, every room named at its middle and every
 * piece of furniture marked with a two-letter code, with a key beside it (room colours, then the codes in use). For
 * reading a layout room by room; the contact sheets are for comparing many at a glance.
 *   node tools/shipgen/cli.js station.trading --size station --layout assembly.bazaar --views labels --count 2
 * writes <base>-labels-s<seed>.png per seed.
 */
import type { GenResult, ModuleDef, RoomRole } from '../../src/sim';
import { content } from '../../src/content';
import { footprintTiles, rotatedSize } from '../../src/sim/modules/footprint';
import { templateCable } from '../../src/sim/cable';
import { E, edgeMarkings, MARK_INSET, N, S, W, type EdgeMarkings } from '../../src/sim/shipgen/markings';
import { gen, Raster, ROLE_TINT, type RGB } from './draw';

export const defs = content.modules as Record<string, ModuleDef>;

/** Room names on the view (corridors stay unnamed). Keyed by role id, so roles a branch adds later (shop, medbay, plant) are named already. */
export const NAMES: Record<string, string> = {
  quarters: 'cabin', support: 'mess', cargo: 'cargo', dock: 'dock', bridge: 'office', armoury: 'armoury', plaza: 'court',
  garden: 'garden', drill: 'drill', shop: 'shop', medbay: 'medbay', reactor: 'reactor', shields: 'shields', core: 'core',
  weapons: 'guns', plant: 'plant', industry: 'industry', farm: 'farm', hangar: 'hangar', engine: 'engine',
};

/**
 * What a room is, by its role and what it holds, in one word: the one place a tool names a room ("pantry", "brig", "barracks"),
 * since one role covers several kinds (a cargo room is a hold, a pantry or a tank farm). `mods` are module ids.
 */
export function roomKind(role: string, mods: readonly string[]): string {
  const has = (m: string): boolean => mods.includes(`module.${m}`);
  const sleepers = mods.filter((m) => m === 'module.bed').length + 2 * mods.filter((m) => m === 'module.bunk').length;
  if (role === 'hall') return 'corridor';
  // A ship's bridge holds the helm; a prefab base's command room the consoles without it.
  if (role === 'bridge') return has('helm') ? 'bridge' : has('weaponsConsole') ? 'command' : 'office';
  if (role === 'plaza' && has('mess_table')) return 'customs';
  // A prefab base's market hall: trade counters in a court.
  if (role === 'plaza' && has('console')) return 'market';
  if (has('galley')) return 'mess';
  if (has('bed') && has('mess_table') && sleepers === 1) return 'chief';
  if (role === 'quarters') return sleepers > 1 ? 'barracks' : 'cabin';
  if (has('stasis_wheel')) return 'brig';
  if (has('storage_armory')) return 'quartermaster';
  if (has('research')) return 'lab';
  if (has('scrapper')) return 'breaker';
  if (has('fabricator')) return 'workshop';
  if (has('storage_tank')) return 'tanks';
  // A market stall: racks and a counter (console), not cold stores.
  if (role === 'cargo' && has('storage_rack') && has('console') && !has('storage_cold')) return 'stall';
  if (has('storage_cold') || (role === 'cargo' && has('storage_rack'))) return 'pantry';
  // Gun bays and engine rooms carry a battery bank too: they keep their role's name.
  if (role !== 'weapons' && role !== 'engine' && has('battery') && !has('reactor') && !has('reactor.mk2') && !has('reactor.mk3') && !has('shieldGen')) return 'batteries';
  if (has('recovery') && mods.filter((m) => m === 'module.med_bed').length <= 1) return 'trauma';
  if (has('droneBay')) return 'drones';
  if (has('vehicle_bay')) return 'shuttle';
  if (has('pod_bay')) return 'pods';
  if (has('refinery')) return 'refinery';
  if (has('storage_ore') || has('storage_ore_large')) return 'ore';
  if (has('exercise')) return 'gym';
  if (has('arcade')) return 'rec';
  if (role === 'support' && has('storage_locker')) return 'suits';
  return NAMES[role] ?? role;
}

/** Two-letter codes for furniture by module name; anything else takes its name's first two letters. */
export const CODES: Record<string, string> = {
  Bed: 'BD', Locker: 'LK', 'Mess table': 'TB', Chair: 'CH', Galley: 'GA', 'Life support': 'LS', Fabricator: 'FB',
  'Storage crate': 'CR', 'Storage rack': 'RK', 'Cargo pallet': 'PA', 'Freight container': 'FC', 'Holo column': 'HO', Planter: 'PL',
  'Tree planter': 'TR', Bench: 'BE', Console: 'CO', Helm: 'HE', 'Weapons console': 'WC', 'Shield console': 'SC',
  'Shield generator': 'SG', 'AI core': 'AI', 'Point defence': 'PD', 'Burst laser': 'BL', 'Mass driver': 'MD', 'Ion cannon': 'IC',
  'Missile launcher': 'ML', 'Game table': 'GT', 'Cold store': 'CS', 'Storage tank': 'TK', 'Stasis wheel': 'SW', 'Vending machine': 'VM', 'Vending machine (red)': 'VR', 'Recovery pod': 'RP', 'Battery bank': 'BT', 'Medical bed': 'MB', Airlock: 'AK', Refinery: 'RF', Hydroponics: 'HY', 'Large ore bin': 'OL',
};
/** Lamps (floor lights, cage lamps, light masts) are dots, not coded pieces. */
export const isLamp = (d: ModuleDef | undefined): boolean => !!d && !!d.light && /lamp|light/i.test(d.name);

export const WALL: RGB = [120, 126, 138], DOOR: RGB = [230, 140, 40], HALL: RGB = [52, 56, 66], INK: RGB = [235, 235, 235], DARK: RGB = [30, 32, 40], LAMP: RGB = [255, 230, 120];

/** Roles the generators on other branches add; tinted here so the view needs no change when they land. */
const EXTRA_TINT: Record<string, RGB> = { shop: [170, 120, 160], medbay: [200, 200, 210], plant: [150, 110, 60] };
/** Floor colour of a room role (corridors and unknown roles take the corridor grey). */
export const roleTint = (role: string): RGB => (role === 'hall' ? HALL : (ROLE_TINT as Record<string, RGB>)[role] ?? EXTRA_TINT[role] ?? HALL);

/** The code a module carries on the view: its table entry, else its name's first two letters. */
export function moduleCode(name: string): string {
  return CODES[name] ?? name.slice(0, 2).toUpperCase();
}

/** Text with a black outline, so it reads over any floor. */
function outlined(r: Raster, s: string, x: number, y: number, c: RGB, ts: number): void {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]] as const) r.text(s, x + dx * ts, y + dy * ts, [0, 0, 0], ts);
  r.text(s, x, y, c, ts);
}

/** One layout as a labelled image: tiles `t` pixels square, the key in a column on the right; with `marks`, its edge markings drawn on the floor. */
export function labelView(spec: string, seed: number, depth = 4, t = 16, marks = false): Raster {
  const g = gen(spec, seed, depth);
  return labelOf(g, `${spec.split(':')[0]} ${g.role.toUpperCase()} seed ${seed} d${depth}`, t, [], true, marks ? edgeMarkings(g, defs) : undefined);
}

/** Line colour of each edge marking on the view (the hazard band alternates with black, as chevrons would). */
const MARK_INK: Record<keyof EdgeMarkings, RGB> = { walkway: [235, 235, 235], apron: [90, 200, 255], keepClear: [255, 210, 0], hazard: [255, 170, 0] };

/** Draw edge-marking masks: a line along each set edge of a tile, its kind's inset in from that edge. */
function drawMarks(r: Raster, marks: EdgeMarkings, W0: number, t: number, top: number): void {
  for (const [kind, mask] of Object.entries(marks) as [keyof EdgeMarkings, Uint8Array][]) {
    mask.forEach((m, i) => {
      if (!m) return;
      const px = (i % W0) * t, py = top + Math.floor(i / W0) * t;
      const c: RGB = kind === 'hazard' && ((i % W0) + Math.floor(i / W0)) % 2 ? [20, 20, 20] : MARK_INK[kind];
      const k = kind === 'keepClear' || kind === 'hazard' ? 3 : 2, o = Math.max(1, Math.round(MARK_INSET[kind] * t - k / 2));
      // a line runs the tile's full length so lines on neighbouring tiles join, and stops at the line it meets at a corner
      const x0 = m & W ? px + o : px, x1 = m & E ? px + t - o : px + t, y0 = m & N ? py + o : py, y1 = m & S ? py + t - o : py + t;
      if (m & N) r.rect(x0, py + o, x1 - x0, k, c);
      if (m & S) r.rect(x0, py + t - o - k, x1 - x0, k, c);
      if (m & W) r.rect(px + o, y0, k, y1 - y0, c);
      if (m & E) r.rect(px + t - o - k, y0, k, y1 - y0, c);
    });
  }
}

const GROUND: RGB = [46, 42, 40], PAD: RGB = [255, 210, 0], CABLE: RGB = [90, 200, 255];

/**
 * A template's ground cable (cable.ts): a duct down the middle of each cabled tile, out to every side it joins (four ways): another
 * cabled tile, a wall it plugs into, or the ground module it feeds. False when it has none.
 */
function drawCable(r: Raster, g: GenResult, t: number, top: number): boolean {
  const tiles = templateCable(g.template);
  if (tiles.length === 0) return false;
  const on = new Set(tiles.map((c) => `${c.x},${c.y}`));
  const ground = new Set<string>();
  for (const m of g.template.modules ?? []) {
    const def = defs[m.def];
    if (m.ground && def) for (const f of footprintTiles(def, m.x, m.y, m.rot)) ground.add(`${f.x},${f.y}`);
  }
  const k = Math.max(2, t >> 2), mid = (t - k) >> 1;
  for (const { x, y } of tiles) {
    const px = x * t, py = top + y * t;
    r.rect(px + mid, py + mid, k, k, CABLE);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = `${x + dx},${y + dy}`;
      if (!on.has(n) && !ground.has(n) && g.template.rows[y + dy]?.[x + dx] !== '#') continue;
      if (dx !== 0) r.rect(dx > 0 ? px + mid : px, py + mid, mid + k, k, CABLE);
      else r.rect(px + mid, dy > 0 ? py + mid : py, k, mid + k, CABLE);
    }
  }
  return true;
}

/** Any layout as a labelled image (a generated one, or a hand-made mock), with captions at tiles when given. */
/**
 * `rooms`: what each room holds where the layout has no furniture placed yet (an outline), to name it by; a filler room
 * is hatched.
 */
export function labelOf(
  g: GenResult, title: string, t = 16, captions: readonly { x: number; y: number; text: string }[] = [], names = true, marks?: EdgeMarkings,
  rooms?: readonly { mods: readonly string[]; filler?: boolean }[],
): Raster {
  const rows = g.template.rows;
  const H = rows.length, W = Math.max(...rows.map((row) => row.length));
  const roles = g.rooms.map((rm) => rm.role as RoomRole);
  const KEY = 320, TOP = 40;
  const r = new Raster(W * t + KEY, Math.max(H * t + TOP + 10, 760));
  r.text(title, 8, 12, INK, 3);
  const mid = new Map<number, [number, number, number]>();
  // What each room holds, by the tile a module stands on (for its name: roomKind).
  const mods: string[][] = roles.map(() => []);
  for (const m of g.template.modules ?? []) mods[g.roomOf[m.y * g.width + m.x] ?? -1]?.push(m.def);
  rooms?.forEach((rm, i) => mods[i]?.push(...rm.mods));
  const kinds = new Map<string, RoomRole>(roles.map((role, i) => [roomKind(role, mods[i] ?? []), role]));
  // A base on open ground (a prefab asteroid base): its levelled site as rock ground, its landing pads framed.
  const site = (g as { site?: { pads: { x: number; y: number; w: number; h: number }[] } }).site;
  if (site) {
    r.rect(0, TOP, W * t, H * t, GROUND);
    for (const p of site.pads) r.frame(p.x * t + 2, TOP + p.y * t + 2, p.w * t - 4, p.h * t - 4, PAD);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = rows[y]?.[x] ?? '.';
    if (c === '.') continue;
    const px = x * t, py = TOP + y * t;
    if (c === '#') { r.rect(px, py, t, t, WALL); continue; }
    if (c === 'D') { r.rect(px, py, t, t, DOOR); continue; }
    const room = g.roomOf[y * W + x] ?? -1;
    const role = roles[room] ?? 'hall';
    r.rect(px, py, t, t, rooms?.[room]?.filler && (x + y) % 3 === 0 ? (roleTint(role).map((v) => v * 0.6) as RGB) : roleTint(role));
    if (room >= 0) { const m = mid.get(room) ?? [0, 0, 0]; m[0] += x; m[1] += y; m[2]++; mid.set(room, m); }
  }
  if (marks) drawMarks(r, marks, g.width, t, TOP);
  const cable = drawCable(r, g, t, TOP);
  const used = new Map<string, string>();
  let lamps = false;
  for (const m of g.template.modules ?? []) {
    const def = defs[m.def];
    if (isLamp(def)) { lamps = true; r.rect(m.x * t + (t >> 1) - 2, TOP + m.y * t + (t >> 1) - 2, 4, 4, LAMP); continue; }
    const name = def?.name ?? m.def;
    const code = moduleCode(name);
    used.set(code, name);
    const [w, h] = def ? rotatedSize(def, m.rot ?? 0) : [1, 1];
    const x0 = m.x * t + 1, y0 = TOP + m.y * t + 1;
    r.rect(x0, y0, w * t - 2, h * t - 2, DARK);
    r.frame(x0, y0, w * t - 2, h * t - 2, m.ground ? CABLE : INK);
    r.text(code, x0 + ((w * t - 2) >> 1) - 7, y0 + ((h * t - 2) >> 1) - 5, INK, 2);
  }
  // Room names at the middle of every room big enough to carry one.
  for (const [room, [sx, sy, n]] of names ? mid : []) {
    const name = roomKind(roles[room] as string, mods[room] ?? []);
    if (!name || n < 10 || roles[room] === 'hall') continue;
    const cx = (sx / n) * t + (t >> 1), cy = TOP + (sy / n) * t + (t >> 1);
    outlined(r, name, Math.round(cx - name.length * 4), Math.round(cy - 5), [255, 255, 255], 2);
  }
  // Lamps again over the names, so a lamp in the middle of a room shows through its label.
  for (const m of g.template.modules ?? []) if (isLamp(defs[m.def])) r.rect(m.x * t + (t >> 1) - 2, TOP + m.y * t + (t >> 1) - 2, 4, 4, LAMP);
  for (const c of captions) outlined(r, c.text, c.x * t, TOP + c.y * t + 2, [255, 230, 120], 2);
  // The key: room colours, then the furniture codes in use.
  const kx = W * t + 16;
  let ky = TOP + 10;
  r.text('rooms', kx, ky, INK, 3); ky += 26;
  const swatch = (c: RGB, label: string): void => { r.rect(kx, ky, 18, 14, c); r.text(label, kx + 26, ky + 2, INK, 2); ky += 20; };
  for (const [kind, role] of [...kinds].sort((p, q) => p[0].localeCompare(q[0]))) if (role !== 'hall') swatch(roleTint(role), kind);
  swatch(HALL, 'corridor');
  swatch(DOOR, 'door');
  ky += 10;
  r.text('furniture', kx, ky, INK, 3); ky += 26;
  for (const [code, name] of [...used].sort((a, b) => a[1].localeCompare(b[1]))) { r.text(`${code} ${name}`, kx, ky, INK, 2); ky += 16; }
  if (lamps) { r.rect(kx + 4, ky + 3, 5, 5, LAMP); r.text('lamp', kx + 26, ky, INK, 2); ky += 16; }
  if (site || cable) {
    ky += 10;
    r.text('ground', kx, ky, INK, 3); ky += 26;
    if (site) { swatch(GROUND, 'rock ground'); r.frame(kx, ky, 18, 14, PAD); r.text('landing pad', kx + 26, ky + 2, INK, 2); ky += 20; }
    if (cable) { r.rect(kx, ky + 5, 18, 4, CABLE); r.text('cable', kx + 26, ky + 2, INK, 2); ky += 20; r.frame(kx, ky, 18, 14, CABLE); r.text('ground turret', kx + 26, ky + 2, INK, 2); ky += 20; }
  }
  if (marks) { ky += 26; r.text('markings', kx, ky, INK, 3); ky += 26; for (const [k, c] of Object.entries(MARK_INK)) swatch(c, k); }
  return r;
}
