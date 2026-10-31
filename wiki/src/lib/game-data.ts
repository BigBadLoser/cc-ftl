import data from '../data/generated/game-data.json';

// Live numbers for handwritten guides, generated from the game's content definitions (scripts/generate-reference.ts).
export type DataKind = 'modules' | 'items' | 'weapons' | 'vehicles' | 'research';
export type DataEntry = { slug: string; name: string } & Record<string, unknown>;

const kinds = data as unknown as Record<DataKind, Record<string, DataEntry>> & { tuning: Record<string, unknown> };

/** A content entry; throws, failing the prerender, when a guide names an id the game no longer has. */
export function entryOf(kind: DataKind, id: string): DataEntry {
  const entry = kinds[kind][id];
  if (!entry) throw Error(`Guide references unknown ${kind} id "${id}"`);
  return entry;
}

/** A field of an entry (or of the sim's tuning constants when `kind` is 'tuning'), with the same failure rule. */
export function valueOf(kind: DataKind | 'tuning', id: string, field?: string): unknown {
  const value = kind === 'tuning' ? kinds.tuning[id] : entryOf(kind, id)[field ?? ''];
  if (value === undefined) throw Error(`Guide references missing field ${kind} ${id} ${field ?? ''}`.trim());
  return value;
}

export function entries(kind: DataKind): Array<[string, DataEntry]> {
  return Object.entries(kinds[kind]);
}
