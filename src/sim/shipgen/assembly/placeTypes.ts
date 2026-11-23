import type { Pair } from './pairs';
import type { FrameGrid } from './frameGrid';
import type { RoomSpec } from '../plan';
import type { Frame, Row } from './frame';

/** The placed layout's shapes (`placeLayout.ts`): parts, pieces, blocks and what a placement returns. */

/** A rectangle of a piece: columns [x0, x1), floor rows r0..r1 (r1 Infinity: to the hull), a spec a side or open. */
export interface Part {
  x0: number; x1: number; r0: number; r1: number; spec: [RoomSpec | null, RoomSpec | null]; fill?: boolean; grown?: boolean;
  /** Its way in, where the layout fixed it: the dock's corridor, the battery's, or the room in front. */ via?: 'dock' | 'maint' | 'front';
  /** Its rows, where not out from the spine (a lane hull's side corridor). */ row?: Row;
}
export interface Piece { x0: number; x1: number; parts: Part[]; cabins?: boolean; /** Single cabins in a row, that many (a lane's strip). */ strip?: number }
/** A side's stretch between corridors and the drive: columns [a, b), its free runs (end exclusive) and its pieces. */
export interface Block { a: number; b: number; crossL: boolean; crossR: boolean; free: [number, number][]; pieces: Piece[] }
/** A corridor stub: a hall column from the spine to the hull. */
export interface Stub { x: number }
export interface Layout { blocks: Block[]; stern: Part | null; stubs: Stub[]; /** Program pairs placed out of turn (stacked with another). */ done: number[] }
export interface Placed {
  /** A layout part's own rooms, painted over the closed frame. */ paint?: (fg: FrameGrid) => void;
  fr: Frame; lay: Layout; score: number; viable: number; nodes: number; why: Map<string, number>; /** Gun pairs pinned to the outline's gun sites, of how many sites. */ pins: number; sites: number; /** The battery's gun pairs, a blister each (prototype). */ battery: Pair[] }
/** Filler rooms' specs (for the score and the prototype's metrics). */
export const fillers = new WeakSet<RoomSpec>(), repeats = new WeakSet<RoomSpec>();
export const clone = (l: Layout): Layout => ({
  blocks: l.blocks.map((b) => ({ ...b, free: b.free.map(([u, v]) => [u, v] as [number, number]), pieces: b.pieces.map((p) => ({ ...p, parts: p.parts.map((q) => ({ ...q, spec: [...q.spec] as Part['spec'] })) })) })),
  stern: l.stern ? { ...l.stern, spec: [...l.stern.spec] as Part['spec'] } : null, stubs: [...l.stubs], done: [...l.done],
});
