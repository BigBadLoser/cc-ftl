import type { Block, BlockPort } from './arranger';
import { Builder } from './builder';
import { roleOfLetter } from './canvas';
import type { Rng } from '../rng';
import type { RoomSpec } from './plan';
import type { AccessKind, RoomRole } from './types';

/** Generic block making: draw an assembly with a local Builder, then freeze it into a Block with ports. */

/**
 * Private room chars of a frozen block. After the 59 ASCII ones come 256 Latin Extended letters: big blocks (station
 * lattices and rings) have more rooms and tubes than that, and a reused char would merge two rooms into one label.
 */
const CHARS = [...'abcefghijklmnopqrstuvwxyzABCEFGHIJKLMNOPQRSTUVWXYZ0123456789', ...Array.from({ length: 256 }, (_, i) => String.fromCharCode(0x100 + i))];

/** Ports given in the local builder's coordinates. */
export type LocalPort = BlockPort;

/** Freeze what a local builder drew into a Block (rooms keep roles and specs; engine rooms give engine faces). */
export function blockFrom(b: Builder, kind: string, label: string, access: AccessKind, ports: LocalPort[]): Block {
  const { rows, labels, width, ox, oy } = b.cv.crop();
  const byKey = new Map(b.parts.map((p) => [p.key, p]));
  const legend = new Map<string, { role: RoomRole; spec?: RoomSpec }>();
  const charOf = new Map<number, string>();
  const out = rows.map((row, y) => [...row].map((c, x) => {
    const l = labels[y * width + x] ?? -1;
    if (c !== '_' || l < 0) return c;
    let ch = charOf.get(l);
    if (!ch) {
      ch = CHARS[charOf.size % CHARS.length] as string;
      charOf.set(l, ch);
      const lab = b.cv.labels[l] as { chunk: string; letter: string };
      const part = byKey.get(lab.chunk);
      const role = part?.role ?? b.chunkRoles.get(`${lab.chunk}:${lab.letter}`) ?? roleOfLetter(lab.letter) ?? 'cargo';
      const spec = part?.spec ?? b.chunkSpecs.get(`${lab.chunk}:${lab.letter}`);
      legend.set(ch, spec ? { role, spec } : { role });
    }
    return ch;
  }).join(''));
  // Gun mounts and airlocks keep their outer (north / south) faces open: the space just outside their outer walls.
  const exposed: { x: number; y: number }[] = [];
  for (const p of b.parts.filter((q) => (q.role === 'weapons' || q.role === 'dock') && !q.spec?.sealed)) {
    for (let y = p.y; y < p.y + p.h; y++) {
      for (let x = p.x + 1; x < p.x + p.w - 1; x++) {
        if (x > p.x && x < p.x + p.w - 1 && y > p.y && y < p.y + p.h - 1) continue;
        // Navy mounts face north or south; only those faces are kept open.
        for (const [dx, dy] of [[0, -1], [0, 1]] as const) {
          if (b.cv.at(x + dx, y + dy) !== '.' || b.cv.at(x - dx, y - dy) === '.') continue;
          // Faces the block joins through (its ports) are meant to be covered.
          const onPort = ports.some((q) => !q.id.startsWith('r') && (q.side === 'n' || q.side === 's') && q.y === y && x >= q.x && x < q.x + q.len);
          // A dock room is wider than its single door: the wall row it joins its host through is covered end to end.
          const joinRow = p.role === 'dock' && ports.some((q) => !q.id.startsWith('r') && (q.side === 'n' || q.side === 's') && q.y === y);
          if (!onPort && !joinRow) exposed.push({ x: x + dx - ox, y: y + dy - oy });
        }
      }
    }
  }
  const faceE = b.parts.filter((p) => p.role === 'engine').map((p) => ({ x: p.x + p.w - 1 - ox, y0: p.y + 1 - oy, y1: p.y + p.h - 2 - oy }));
  return { kind, label, access, rows: out, legend, ports: ports.map((p) => ({ ...p, x: p.x - ox, y: p.y - oy })), faceE, origin: { x: ox, y: oy }, exposed };
}

/** A local builder for one block (axis on rows -1 / 0, like the ship). */
export const localBuilder = (rng: Rng): Builder => new Builder(rng, -1);

/** A corridor block: ports at both ends and along both long sides. */
export function hallBlock(rng: Rng, len: number, width: number, horiz: boolean, access: AccessKind = 'human'): Block {
  const b = localBuilder(rng);
  const r = horiz ? { x: 0, y: -1 - Math.floor(width / 2), w: len + 2, h: width + 2 } : { x: -1 - Math.floor(width / 2), y: 0, w: width + 2, h: len + 2 };
  b.place(r, 'hall');
  const ports: LocalPort[] = horiz
    ? [
      { id: 'w', side: 'w', x: r.x, y: r.y + 1, len: width, access }, { id: 'e', side: 'e', x: r.x + r.w - 1, y: r.y + 1, len: width, access },
      { id: 'n', side: 'n', x: r.x + 1, y: r.y, len, access }, { id: 's', side: 's', x: r.x + 1, y: r.y + r.h - 1, len, access },
    ]
    : [
      { id: 'n', side: 'n', x: r.x + 1, y: r.y, len: width, access }, { id: 's', side: 's', x: r.x + 1, y: r.y + r.h - 1, len: width, access },
      { id: 'w', side: 'w', x: r.x, y: r.y + 1, len, access }, { id: 'e', side: 'e', x: r.x + r.w - 1, y: r.y + 1, len, access },
    ];
  return blockFrom(b, 'hall', horiz ? 'strut' : 'outrigger', access, ports);
}
