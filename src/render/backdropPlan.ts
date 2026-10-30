/** The pure choices of the space backdrop (backdrop.ts draws them): which art the node's body uses and where it sits. */

/** FNV-1a of a string; the starmap picks a sector's body variant by this hash of the sector id (`starmap/artIds.ts`). */
export function strHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/**
 * The art ids to try for a body kind, best first, with the variant picked as the starmap picks it: `hash % n` of the `.v<n>` ids a
 * family has (three for most kinds, six for the gas giant), so the backdrop shows the same variant as the node's starmap body.
 * The dedicated `backdrop.body.*` art comes first when it exists; the starmap's body sprite stands in until then. Both share one
 * layout (square frame of any size, anchor at the centre, body radius 5/16 of the frame width), so only the id changes.
 */
export function backdropBodySprite(has: (id: string) => boolean, kind: string, hash: number): string[] {
  const ids: string[] = [];
  for (const family of ['backdrop', 'starmap']) {
    const base = `${family}.body.${kind}`;
    let n = 0;
    while (has(`${base}.v${n}`)) n++;
    if (n) ids.push(`${base}.v${hash % n}`);
    ids.push(base);
  }
  return ids;
}

/** Kinds whose starmap sprite carries prominence loops standing off the limb (they read as a pendant when scaled up). */
export const HAS_PROMINENCES: ReadonlySet<string> = new Set(['star', 'red_dwarf', 'blue_giant']);

/** Spots for the body as fractions of the screen (centre x, y): down the left side, clear of the top bar, the goals column and the tools. */
export const BODY_SPOTS: readonly (readonly [number, number])[] = [[0.08, 0.3], [0.07, 0.55], [0.08, 0.8]];

/** Where a node's body sits, as fractions of the screen: one of the left-side spots, nudged a little by the seed. */
export function bodySpot(seed: number): { fx: number; fy: number } {
  const spot = BODY_SPOTS[seed % BODY_SPOTS.length]!;
  return { fx: spot[0] + ((seed >>> 8) % 7) / 100, fy: spot[1] - ((seed >>> 12) % 5) / 100 };
}
