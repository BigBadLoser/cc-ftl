/**
 * Stateless integer hashing for the galaxy generator. Every generated value is a pure function of the world seed and
 * integer coordinates, so any chunk can be built in any order and neighbours agree at the seams.
 */

/** Mix one 32-bit value into a running hash (murmur3 style). */
function mix(h: number, v: number): number {
  let k = Math.imul(v | 0, 0xcc9e2d51);
  k = (k << 15) | (k >>> 17);
  k = Math.imul(k, 0x1b873593);
  h ^= k;
  h = (h << 13) | (h >>> 19);
  return (Math.imul(h, 5) + 0xe6546b64) | 0;
}

/** Final avalanche. */
function fmix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** uint32 hash of any number of integers (negative values are fine). */
export function hash32(...parts: number[]): number {
  let h = 0x9747b28c;
  for (const p of parts) h = mix(h, p);
  return fmix(mix(h, parts.length));
}

/** A float in [0, 1) from integers. */
export function unit(...parts: number[]): number {
  return hash32(...parts) / 4294967296;
}

/** uint32 hash of a string (FNV-1a then the avalanche), for ids and content keys. */
export function strHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return fmix(h);
}
