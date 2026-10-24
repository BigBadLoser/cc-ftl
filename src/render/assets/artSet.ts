/**
 * Which art set the game draws: `1x` (64x32 pixel art, drawn at half resolution so each art pixel is a hard 2x2 block on
 * the 128x64 tile grid) or `2x` (128x64 art, one art pixel per world pixel). The tile geometry (iso.ts TILE_W/TILE_H) is
 * 128x64 in both. Chosen by `?art=1x|2x` (which is also remembered), else the remembered choice, else 1x. Changing it
 * reloads the page: the sheet stores, built sprites and filters all hold textures of one set, and a reload is the one
 * way to drop them all (see `setArtScale`).
 */
export type ArtScale = 1 | 2;

export const DEFAULT_ART_SCALE: ArtScale = 1;
export const ART_SCALE_KEY = 'cc.artScale';

/** Directory (under assets/) of an art set. */
export const setDir = (s: ArtScale): string => `${s}x`;

const parse = (v: string | null | undefined): ArtScale | null => {
  const m = /^(1|2)x?$/.exec((v ?? '').trim().toLowerCase());
  return m ? (Number(m[1]) as ArtScale) : null;
};

/** URL query first, then the stored value, else the default. Pure: callers pass what they read. */
export function resolveArtScale(search: string, stored: string | null): ArtScale {
  return parse(new URLSearchParams(search).get('art')) ?? parse(stored) ?? DEFAULT_ART_SCALE;
}

function readStored(): string | null {
  try {
    return localStorage.getItem(ART_SCALE_KEY);
  } catch {
    return null;
  }
}

function writeStored(s: ArtScale): void {
  try {
    localStorage.setItem(ART_SCALE_KEY, String(s));
  } catch {
    /* private window or blocked storage: the choice just is not remembered */
  }
}

let cached: ArtScale | undefined;

/** The set in use. Fixed for the page's lifetime (a switch reloads). A `?art=` in the URL is remembered. */
export function currentArtScale(): ArtScale {
  if (cached) return cached;
  const search = typeof location === 'undefined' ? '' : location.search;
  cached = resolveArtScale(search, readStored());
  if (parse(new URLSearchParams(search).get('art'))) writeStored(cached);
  return cached;
}

/** Remember a set and reload the page into it (any `?art=` in the URL is replaced). No-op for the set already in use. */
export function setArtScale(s: ArtScale): void {
  if (s === currentArtScale()) return;
  writeStored(s);
  if (typeof location === 'undefined') return;
  const u = new URL(location.href);
  u.searchParams.set('art', setDir(s));
  location.replace(u.toString());
}

/** Pool budgets scale with the set's pixel count: 1x sheets decode to a quarter of the bytes. */
export function budgetFactor(s: ArtScale): number {
  return s === 1 ? 0.25 : 1;
}
