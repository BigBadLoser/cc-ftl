/**
 * Per-role room expectations for the station bench (section 4 of docs/STATIONGEN2.md). A room is "within expectation"
 * when all three hold:
 *   - density: footprint tiles of its modules (lights excluded) over its floor tiles lies inside [lo, hi];
 *   - aspect: bounding box long side / short side is at most `aspect`;
 *   - minSide: its thickness (median over its tiles of the shorter of the horizontal and vertical run through the tile)
 *     is at least `minSide`.
 * The numbers are first guesses, to be tuned against rooms that look right. Roles not listed use DEFAULT_EXPECT.
 */
export interface RoomExpect { density: readonly [number, number]; aspect: number; minSide: number }

export const DEFAULT_EXPECT: RoomExpect = { density: [0.1, 0.8], aspect: 4, minSide: 3 };

const court: RoomExpect = { density: [0, 0.25], aspect: 4, minSide: 4 };

export const ROOM_EXPECT: Record<string, RoomExpect> = {
  bridge: { density: [0.15, 0.6], aspect: 2.5, minSide: 3 },
  reactor: { density: [0.3, 0.8], aspect: 2.5, minSide: 3 },
  shields: { density: [0.25, 0.8], aspect: 2.5, minSide: 3 },
  core: { density: [0.2, 0.7], aspect: 2.5, minSide: 3 },
  weapons: { density: [0.2, 0.8], aspect: 3, minSide: 3 },
  hangar: { density: [0.1, 0.6], aspect: 3, minSide: 4 },
  cargo: { density: [0.3, 0.85], aspect: 4, minSide: 3 },
  quarters: { density: [0.2, 0.6], aspect: 3, minSide: 2 },
  support: { density: [0.15, 0.6], aspect: 3, minSide: 3 },
  medbay: { density: [0.15, 0.6], aspect: 3, minSide: 3 },
  armoury: { density: [0.2, 0.7], aspect: 3, minSide: 3 },
  industry: { density: [0.25, 0.75], aspect: 3, minSide: 3 },
  farm: { density: [0.4, 0.9], aspect: 4, minSide: 3 },
  plant: { density: [0.3, 0.8], aspect: 3, minSide: 3 },
  shop: { density: [0.1, 0.55], aspect: 4, minSide: 3 },
  dock: { density: [0, 1], aspect: 4, minSide: 2 },
  plaza: court, garden: court, drill: court,
};

export const expectFor = (role: string): RoomExpect => ROOM_EXPECT[role] ?? DEFAULT_EXPECT;

export function withinExpect(role: string, density: number, aspect: number, thickness: number): boolean {
  const e = expectFor(role);
  return density >= e.density[0] && density <= e.density[1] && aspect <= e.aspect && thickness >= e.minSide;
}
