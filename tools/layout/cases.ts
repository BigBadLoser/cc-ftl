/**
 * Feedback cases: a design's source, the layout it started as, the layout the user edited it into, the pins, and the change list,
 * as one readable JSON file (`tools/layout/cases/<slug>.json`). Tile rows are strings, one per line, so a diff reads like a picture.
 */
import type { Layout } from './layout';
import type { Pin } from './pins';
import type { Source } from './source';

/** Where a design came from, with what produced it. */
export interface Provenance extends Source {
  /** The generator spec string (what the CLI takes), '' for a blank grid. */
  spec: string;
  /** The generator's version; the generators have none, so the commit the dev server was started on. */
  generator: string;
}
export interface LayoutJson {
  name: string;
  width: number;
  height: number;
  immobile: boolean;
  /** One string per row: '.' space, '_' floor, '#' wall, 'D' door, '=' beam. */
  cells: string[];
  /** One string per row: the room id of each tile, '.' for none, separated by spaces. */
  roomOf: string[];
  rooms: Layout['rooms'];
  modules: Layout['modules'];
  moduleIds: number[];
  nextModuleId: number;
  extra: Layout['extra'];
}
export interface CaseFile {
  format: 'layout-lab-case';
  version: 1;
  name: string;
  source: Provenance;
  original: LayoutJson;
  edited: LayoutJson;
  notes: Pin[];
  changes: string[];
}

export function encodeLayout(l: Layout): LayoutJson {
  const roomOf: string[] = [];
  for (let y = 0; y < l.height; y++) roomOf.push(l.roomOf.slice(y * l.width, (y + 1) * l.width).map((r) => (r < 0 ? '.' : String(r))).join(' '));
  return { name: l.name, width: l.width, height: l.height, immobile: l.immobile, cells: [...l.cells], roomOf, rooms: l.rooms, modules: l.modules, moduleIds: l.moduleIds, nextModuleId: l.nextModuleId, extra: l.extra };
}
export function decodeLayout(j: LayoutJson): Layout {
  const roomOf = j.roomOf.flatMap((row) => row.split(' ').map((t) => (t === '.' ? -1 : Number(t))));
  if (j.cells.length !== j.height || roomOf.length !== j.width * j.height) throw new Error('the case file’s grid does not match its size');
  return { name: j.name, width: j.width, height: j.height, immobile: j.immobile, cells: [...j.cells], roomOf, rooms: j.rooms, modules: j.modules, moduleIds: j.moduleIds, nextModuleId: j.nextModuleId, extra: j.extra };
}

const hasRows = (v: unknown): boolean =>
  typeof v === 'object' && v !== null && ((Array.isArray(v) && v.length > 3 && v.every((x) => typeof x === 'string')) || Object.values(v).some(hasRows));

/** JSON with rows on their own lines: arrays of strings expand one per line, anything short stays on one line. */
export function pretty(v: unknown, ind = ''): string {
  const flat = JSON.stringify(v);
  if (flat === undefined || typeof v !== 'object' || v === null) return flat ?? 'null';
  if (flat.length <= 100 && !hasRows(v)) return flat;
  const next = `${ind}  `;
  if (Array.isArray(v)) return `[\n${v.map((x) => next + pretty(x, next)).join(',\n')}\n${ind}]`;
  const items = Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${next}${JSON.stringify(k)}: ${pretty(x, next)}`);
  return `{\n${items.join(',\n')}\n${ind}}`;
}

export function caseOf(name: string, source: Provenance, original: Layout, edited: Layout, notes: readonly Pin[], changes: readonly string[]): CaseFile {
  return { format: 'layout-lab-case', version: 1, name, source, original: encodeLayout(original), edited: encodeLayout(edited), notes: [...notes], changes: [...changes] };
}
export const serializeCase = (c: CaseFile): string => `${pretty(c)}\n`;
export function parseCase(text: string): CaseFile {
  const c = JSON.parse(text) as Partial<CaseFile>;
  if (c.format !== 'layout-lab-case' || c.version !== 1 || !c.original || !c.edited || !c.source) throw new Error('not a layout lab case file');
  return c as CaseFile;
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
/** The part of a case's file name that says where the design came from. */
export function sourceSlug(s: Source): string {
  if (s.kind === 'blank') return 'blank';
  if (s.kind === 'station') return slug(`${s.id.replace('station.', '')}-${s.size}${s.layout ? `-${s.layout}` : ''}-s${s.seed}`);
  if (s.kind === 'faction') return slug(`${s.id.replace('faction.', '')}${s.family ? `-${s.family}` : ''}-s${s.seed}-d${s.depth}`);
  return slug(`starter-${s.id.replace('ship.', '')}`);
}
/** `<source>--<name>`: the file name (without `.json`) a case saves under. */
export const caseSlug = (s: Source, name: string): string => `${sourceSlug(s)}--${slug(name) || 'untitled'}`;
