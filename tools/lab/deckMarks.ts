import { Graphics, Sprite, type Container } from 'pixi.js';
import type { Atlas } from '../../src/render/assets/loader';
import { CarpetSprite } from '../../src/render/carpetPaint';
import { DRAWN_MARKINGS, markPieces, WALKWAY_PAINT } from '../../src/render/deckMarks';
import { E, MARK_FILL, N, S, W, type EdgeMarking } from '../../src/sim/marks';
import type { LabCell, LabPanel } from './panel';

const TW = 64;
const TH = 32;
const PAD = 16;

/**
 * Test shapes (tools/blender/sprites/floor_marks_maps.py has the same ones): '#' wall, '.' floor, 'D' door, 'K' floor under a
 * keep-clear box, 'H' floor in a hazard room (the hall beside it, '.', has none).
 */
const MAPS: Record<string, string[]> = {
  run: ['############', '#....#######', '#....#######', '#..........#', '#..........#', '######..####', '######..####', '######D#####'],
  stairs: ['########', '#..#####', '#...####', '##...###', '###...##', '####...#', '#####..#', '########'],
  keep: ['##########', '#........#', '#.KKK..KK#', '#.KKK..KK#', '#........#', '##########'],
  room: ['##########', '#HHHH.....#', '#HHHH.....#', '#HHHH..#..#', '##########'],
};

const SIDES = [[N, 0, -1], [E, 1, 0], [S, 0, 1], [W, -1, 0]] as const;

/** Edge masks of the tiles `inside` selects: a bit where the tile across that edge is not inside and `draw` says so (the generator's `outline`). */
function outline(rows: string[], inside: (c: string) => boolean, draw: (across: string) => boolean = () => true): number[][] {
  const at = (x: number, y: number): string => rows[y]?.[x] ?? '#';
  return rows.map((row, y) => [...row].map((c, x) => (inside(c) ? SIDES.reduce((m, [bit, dx, dy]) => (!inside(at(x + dx, y + dy)) && draw(at(x + dx, y + dy)) ? m | bit : m), 0) : 0)));
}

/** The masks of one kind on one map: walkway and hazard run along the walls (hazard in the 'H' room only on `room`); keep-clear outlines the box and fills it. */
function masks(kind: EdgeMarking, name: string, rows: string[]): number[][] {
  if (kind === 'keepClear') {
    const m = outline(rows, (c) => c === 'K');
    return m.map((r, y) => r.map((v, x) => (rows[y]?.[x] === 'K' ? v | MARK_FILL : 0)));
  }
  const room = name === 'room';
  if (kind === 'hazard') return outline(rows, (c) => (room ? c === 'H' : c === '.' || c === 'K' || c === 'H'), (c) => c === '#');
  return outline(rows, (c) => c === '.' || c === 'K' || c === 'H', (c) => c === '#');
}

function diamond(g: Graphics, cx: number, cy: number, color: number): void {
  g.poly([cx, cy - TH / 2, cx + TW / 2, cy, cx, cy + TH / 2, cx - TW / 2, cy]).fill(color);
}

/** One map drawn as the game lays it: the plain deck plate, then every kind's decals from the stored masks (`kinds` of them). */
function drawMap(root: Container, atlas: Atlas, rows: string[], name: string, kinds: readonly EdgeMarking[], walkway: number): void {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const ox = PAD + (h * TW) / 2;
  const oy = PAD + TH / 2;
  const pos = (x: number, y: number) => ({ x: ox + ((x - y) * TW) / 2, y: oy + ((x + y) * TH) / 2 });
  const g = new Graphics();
  root.addChild(g);
  const plate = atlas.stat('tile.floor.a');
  const all = Object.fromEntries(kinds.map((k) => [k, masks(k, name, rows)] as const));
  const put = (id: string, x: number, y: number, paint?: number): void => {
    const s = atlas.stat(id);
    if (!s) return;
    const p = pos(x, y);
    const spr = paint === undefined ? new Sprite(s.tex) : new CarpetSprite(s.tex);
    if (paint !== undefined) spr.tint = paint;
    spr.position.set(Math.round(p.x - s.ax), Math.round(p.y - s.ay));
    root.addChild(spr);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = rows[y]?.[x] ?? '#';
      const p = pos(x, y);
      if (c === '#') diamond(g, p.x, p.y, 0x14171c);
      else if (c === 'D') diamond(g, p.x, p.y, 0x2c333b);
      else if (plate) put('tile.floor.a', x, y);
      if (c === '#' || c === 'D') continue;
      for (const kind of kinds) {
        const field = all[kind]!;
        for (const id of markPieces(kind, (dx, dy) => field[y + dy]?.[x + dx] ?? 0)) put(id, x, y, kind === 'walkway' ? walkway : undefined);
      }
    }
}

const size = (rows: string[]) => ({ w: (rows.length + Math.max(...rows.map((r) => r.length))) * (TW / 2) + PAD * 2, h: (rows.length + Math.max(...rows.map((r) => r.length))) * (TH / 2) + PAD * 2 });

/**
 * `?panel=deck-marks`: the deck markings joined from their quarter pieces on test shapes, from masks the panel sets the way the
 * generator will (an outline of a region; the game draws the same pieces through `markPieces`): a room with a T of corridor and a
 * door gap, a diagonal staircase corridor, a hazard room beside a hall (the band's square end), keep-clear boxes (free and against
 * a wall). Per kind (`kinds=walkway,hazard,keepClear`, default all) and all three together; `&paint=b0443a` tints the walkway line
 * (default cream).
 */
export const deckMarksPanel: LabPanel = {
  id: 'deck-marks',
  title: 'Deck markings: walkway, hazard band, keep-clear',
  zoom: 1,
  help: 'kinds=walkway,hazard,keepClear (default all) paint=d6d1c2 (the walkway line\'s colour)',
  async cells({ atlas, params }) {
    atlas.ids('tile.mark.').forEach((id) => atlas.stat(id));
    atlas.ids('tile.floor.').forEach((id) => atlas.stat(id));
    await atlas.whenIdle();
    const want = params.get('kinds')?.split(',') ?? DRAWN_MARKINGS;
    const kinds = DRAWN_MARKINGS.filter((k) => want.includes(k));
    const paint = params.has('paint') ? parseInt(params.get('paint') as string, 16) : WALKWAY_PAINT;
    const cells: LabCell[] = [];
    const add = (label: string, note: string, name: string, ks: readonly EdgeMarking[], newRow: boolean, pt = paint): void => {
      const rows = MAPS[name] as string[];
      cells.push({ label, note, ...size(rows), newRow, mount: (root) => (drawMap(root, atlas, rows, name, ks, pt), () => {}) });
    };
    const shapes: Record<EdgeMarking, string[]> = { walkway: ['run', 'stairs'], hazard: ['run', 'stairs', 'room'], keepClear: ['keep'], apron: [] };
    for (const kind of kinds)
      shapes[kind].forEach((name, i) => add(kind, name, name, [kind], i === 0));
    if (kinds.length > 1) {
      add('all kinds', 'run', 'run', kinds, true);
      add('walkway, faction paint', 'run, paint b0443a', 'run', ['walkway'], false, 0xb0443a);
    }
    return cells;
  },
};
