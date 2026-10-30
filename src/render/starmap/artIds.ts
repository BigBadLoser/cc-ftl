/** Which `starmap.*` sprite stands for a map thing: ids and variant picks (ARCHITECTURE.md, "Starmap art"). */
import type { UiStarArt } from '../../ui/starmapApi';

/** A small stable string hash (FNV-1a), for picking variants by id. */
export function strHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** The sprite of a body kind (`body`, or the Cluster view's `mini`), its variant picked by `seed`; null if the art has none. */
export function bodyVariant(art: UiStarArt, family: 'body' | 'mini', kind: string, seed: string): string | null {
  const base = `starmap.${family}.${kind}`;
  const variants: string[] = [];
  for (let n = 0; art.frames[`${base}.v${n}`]; n++) variants.push(`${base}.v${n}`);
  if (variants.length) return variants[strHash(seed) % variants.length] as string;
  return art.frames[base] ? base : null;
}
