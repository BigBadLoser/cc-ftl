/** Extra viewer renderings: hull silhouette, and the assembly / structure / traversal debug view. */
import type { AccessKind, GenResult, JoinKind } from '../../src/sim';
import type { Raster } from './draw';

type RGB = [number, number, number];

/** The hull outline filled in one colour. */
export function drawSilhouette(r: Raster, g: GenResult, ox: number, oy: number, s: number): void {
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) if ((g.template.rows[y]?.[x] ?? '.') !== '.') r.rect(ox + x * s, oy + y * s, s, s, [205, 214, 228]);
  }
}

/**
 * Structure: three flat colours, no labels. Exposed beams, crawlways and corridors (traversal), and everything
 * enclosed (pods, core, rooms). Walls take the colour of what they enclose (rooms before corridors).
 */
export function drawStructure(r: Raster, g: GenResult, ox: number, oy: number, s: number): void {
  const BEAM: RGB = [235, 70, 200];
  const WAY: RGB = [110, 200, 140];
  const BOX: RGB = [90, 130, 200];
  const at = (x: number, y: number): string => g.template.rows[y]?.[x] ?? '.';
  const role = (x: number, y: number): string | undefined => g.rooms[g.roomOf[y * g.width + x] ?? -1]?.role;
  const floor = (x: number, y: number): 'way' | 'box' | null => {
    const c = at(x, y);
    if (c !== '_' && c !== 'D') return null;
    return c === 'D' || role(x, y) === 'hall' ? 'way' : 'box';
  };
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const c = at(x, y);
      if (c === '.') continue;
      let k: 'way' | 'box' | null = c === '=' ? null : floor(x, y);
      if (c === '#') {
        const near = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => floor(x + dx, y + dy)));
        k = near.includes('box') ? 'box' : near.includes('way') ? 'way' : 'box';
      }
      r.rect(ox + x * s, oy + y * s, s, s, c === '=' ? BEAM : k === 'way' ? WAY : BOX);
    }
  }
}

const TINTS: RGB[] = [
  [90, 140, 200], [200, 120, 80], [110, 180, 110], [190, 90, 160], [200, 180, 80], [80, 180, 180], [160, 120, 220],
  [220, 140, 140], [120, 160, 90], [140, 140, 200], [210, 160, 110], [100, 130, 150],
];
const JOIN: Record<JoinKind, RGB> = { frame: [255, 230, 90], graft: [255, 140, 40], beam: [255, 60, 220] };
const ACCESS: Record<AccessKind, RGB> = { human: [80, 230, 255], robot: [120, 255, 140], external: [255, 255, 120] };

/**
 * Assemblies tinted and labelled, walls darker, beam tiles solid magenta; joins framed by kind (frame yellow, graft
 * orange, beam magenta); traversal dotted by access kind (human cyan, robot green, external yellow); ports green / red.
 */
/** Salvage origin hues (scrappers); pieces of one origin alternate lightness so separate donors stay apart. */
const DONOR: Record<string, RGB> = { navy: [70, 110, 210], civil: [200, 135, 40], habitat: [235, 215, 140], drone: [190, 70, 70], mining: [120, 175, 70], scrap: [150, 140, 130] };
function tint(d: NonNullable<GenResult['debug']>, a: number): RGB {
  const asm = d.assemblies[a];
  const o = asm?.label.includes('habitat') ? 'habitat' : asm?.donor;
  const base = o ? DONOR[o] : undefined;
  if (!base) return TINTS[a % TINTS.length] as RGB;
  return (a % 2 ? base : base.map((v) => Math.min(255, v * 1.25))) as RGB;
}

export function drawAssemblies(r: Raster, g: GenResult, ox: number, oy: number, s: number): void {
  const d = g.debug;
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const c = g.template.rows[y]?.[x] ?? '.';
      if (c === '.') continue;
      const a = d ? (d.asmOf[y * g.width + x] ?? -1) : -1;
      if (c === '=') { r.rect(ox + x * s, oy + y * s, s, s, [235, 70, 200]); continue; }
      const t = a >= 0 ? tint(d, a) : ([90, 90, 90] as RGB);
      const k = c === '#' ? 0.45 : 1;
      r.rect(ox + x * s, oy + y * s, s, s, t.map((v) => v * k) as RGB);
    }
  }
  if (!d) return;
  for (const t of d.traversal) r.rect(ox + t.x * s + (s >> 1) - 1, oy + t.y * s + (s >> 1) - 1, 2, 2, ACCESS[t.access]);
  for (const j of d.joins) for (const t of j.tiles) r.frame(ox + t.x * s, oy + t.y * s, s, s, JOIN[j.kind], 2);
  for (const p of d.ports) {
    const cx = ox + p.x * s + (p.dir === 'e' ? s - 3 : p.dir === 'w' ? 0 : (s >> 1) - 1);
    const cy = oy + p.y * s + (p.dir === 's' ? s - 3 : p.dir === 'n' ? 0 : (s >> 1) - 1);
    r.rect(cx, cy, 3, 3, p.matched ? [60, 255, 90] : [255, 40, 40]);
  }
  for (const a of d.assemblies) r.text(a.label.slice(0, Math.max(3, Math.floor((a.w * s) / 4) - 1)), ox + a.x * s + 2, oy + a.y * s + 2, [255, 255, 255]);
}
