/**
 * Checks and the department view for the station assembly sheets (dev tool). Cores: each room's largest axis-aligned
 * floor rectangle, the space furniture can actually use. Departments: rooms tinted by department, walls a darker tint
 * of what they enclose, each connected department block named.
 */
import type { GenResult } from '../../src/sim';
import type { Raster, RGB } from './draw';

export interface Core { room: number; x: number; y: number; w: number; h: number; area: number; floor: number }

/** Each room's largest floor rectangle (histogram method), with its total floor. */
export function roomCores(g: GenResult): Core[] {
  const { width: W, height: H, roomOf } = g;
  const floor = new Map<number, number>();
  for (const k of roomOf) if (k >= 0) floor.set(k, (floor.get(k) ?? 0) + 1);
  const out: Core[] = [];
  for (const [room, n] of floor) {
    if (g.rooms[room]?.role === 'hall') continue;
    const hist = new Array<number>(W).fill(0);
    let best: Core = { room, x: 0, y: 0, w: 0, h: 0, area: 0, floor: n };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) hist[x] = roomOf[y * W + x] === room ? (hist[x] as number) + 1 : 0;
      const stack: number[] = [];
      for (let x = 0; x <= W; x++) {
        const hx = x < W ? (hist[x] as number) : 0;
        while (stack.length && (hist[stack[stack.length - 1] as number] as number) >= hx) {
          const top = stack.pop() as number, h = hist[top] as number;
          const left = stack.length ? (stack[stack.length - 1] as number) + 1 : 0, w = x - left;
          if (w * h > best.area) best = { room, x: left, y: y - h + 1, w, h, area: w * h, floor: n };
        }
        stack.push(x);
      }
    }
    out.push(best);
  }
  return out;
}

export const DEPT_TINT: Record<string, RGB> = {
  harbour: [80, 140, 225], habitation: [105, 185, 90], commons: [225, 135, 205], freight: [195, 150, 80],
  secure: [225, 85, 70], defence: [150, 95, 185], works: [235, 205, 70], circulation: [62, 66, 78],
  customs: [70, 190, 190], airlock: [200, 200, 205],
};
const shade = (c: RGB, f: number): RGB => c.map((v) => Math.round(v * f)) as RGB;

/**
 * Departments at `s` pixels a tile; names each connected block of 40+ tiles. With `names` (one a room, by region) it
 * names the rooms instead, in small letters.
 */
export function drawDepartments(r: Raster, g: GenResult, depts: string[], ox: number, oy: number, s: number, names?: readonly (string | undefined)[]): void {
  const { width: W, height: H, roomOf } = g;
  const rows = g.template.rows;
  const at = (x: number, y: number): string => rows[y]?.[x] ?? '.';
  const deptAt = new Array<string>(W * H).fill('');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y), i = y * W + x;
    if (c === '_') deptAt[i] = depts[roomOf[i] as number] ?? 'circulation';
    else if (c === 'D') deptAt[i] = 'door';
  }
  const wallDept = (x: number, y: number): string => {
    let hall = '';
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const d = deptAt[(y + dy) * W + (x + dx)] ?? '';
      if (x + dx < 0 || x + dx >= W || !d || d === 'door') continue;
      if (d !== 'circulation') return d;
      hall = d;
    }
    return hall || 'circulation';
  };
  const tile = new Array<string>(W * H).fill('');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y), i = y * W + x;
    if (c === '.') continue;
    // An open beam: structure, no floor.
    if (c === '=') { r.rect(ox + x * s, oy + y * s, s, s, [112, 118, 134]); continue; }
    const d = c === '#' ? wallDept(x, y) : deptAt[i] as string;
    tile[i] = d;
    const col = d === 'door' ? ([240, 150, 40] as RGB) : DEPT_TINT[d] ?? [200, 200, 200];
    r.rect(ox + x * s, oy + y * s, s, s, c === '#' ? shade(col, 0.6) : col);
  }
  if (names) {
    const sum = new Map<number, [number, number, number]>();
    for (let i = 0; i < W * H; i++) {
      const id = roomOf[i] as number;
      if (id < 0 || !names[id]) continue;
      const t = sum.get(id) ?? [0, 0, 0];
      t[0] += i % W; t[1] += Math.floor(i / W); t[2]++;
      sum.set(id, t);
    }
    for (const [id, [sx, sy, n]] of sum) {
      const d = names[id] as string, x = Math.round(ox + (sx / n) * s + s / 2 - d.length * 2), y = Math.round(oy + (sy / n) * s + s / 2 - 3);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) r.text(d, x + dx, y + dy, [0, 0, 0], 1);
      r.text(d, x, y, [255, 255, 255], 1);
    }
    return;
  }
  // Name each connected block of one department (floor and its walls): the biggest first, and none over another's name.
  const seen = new Uint8Array(W * H);
  const blocks: { d: string; n: number; cx: number; cy: number }[] = [];
  for (let i = 0; i < W * H; i++) {
    const d = tile[i] as string;
    if (seen[i] || !d || d === 'circulation' || d === 'door') continue;
    const q = [i];
    seen[i] = 1;
    let sx = 0, sy = 0;
    for (let k = 0; k < q.length; k++) {
      const j = q[k] as number, x = j % W, y = Math.floor(j / W);
      sx += x; sy += y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const xx = x + dx, yy = y + dy, n = yy * W + xx;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || seen[n] || tile[n] !== d) continue;
        seen[n] = 1;
        q.push(n);
      }
    }
    if (q.length >= 40) blocks.push({ d, n: q.length, cx: ox + (sx / q.length) * s + s / 2, cy: oy + (sy / q.length) * s + s / 2 });
  }
  const drawn: [number, number, number, number][] = [];
  for (const { d, cx, cy } of blocks.sort((p, q) => q.n - p.n)) {
    const x = Math.round(cx - d.length * 4), y = Math.round(cy - 5), box: [number, number, number, number] = [x - 3, y - 3, x + d.length * 8 + 3, y + 13];
    if (drawn.some((o) => box[0] < o[2] && o[0] < box[2] && box[1] < o[3] && o[1] < box[3])) continue;
    drawn.push(box);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) r.text(d, x + dx * 2, y + dy * 2, [0, 0, 0], 2);
    r.text(d, x, y, [255, 255, 255], 2);
  }
}

/** The department colour key in one row. */
export function drawDeptKey(r: Raster, x: number, y: number): void {
  for (const [d, c] of Object.entries(DEPT_TINT)) {
    r.rect(x, y, 18, 14, c);
    r.text(d, x + 24, y + 2, [235, 235, 235], 2);
    x += 24 + d.length * 8 + 24;
  }
}

/** Every solid 2x2 block of wall (top-left corners). */
export function wallBlocks(g: GenResult): { x: number; y: number }[] {
  const rows = g.template.rows, out: { x: number; y: number }[] = [];
  for (let y = 0; y + 1 < rows.length; y++) for (let x = 0; x + 1 < (rows[y]?.length ?? 0); x++) {
    if (rows[y]?.[x] === '#' && rows[y]?.[x + 1] === '#' && rows[y + 1]?.[x] === '#' && rows[y + 1]?.[x + 1] === '#') out.push({ x, y });
  }
  return out;
}
