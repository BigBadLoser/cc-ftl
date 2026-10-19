/**
 * A structural profile: a depth (or strut length) along a run, t = 0 at the fore end .. 1 at the aft end. Hull spines
 * use it for band depth, decks for room depth, drone trusses for strut length: one designed outline curve for a
 * component instead of whatever each part's contents needed.
 */
export interface Profile {
  lo: number;
  hi: number;
  /** Where the run is broadest, and over how long a stretch (fractions of the run). */
  peak: number;
  plateau: number;
}

export function depthAt(p: Profile, t: number): number {
  const off = Math.max(0, Math.abs(t - p.peak) - p.plateau / 2);
  const reach = Math.max(1e-3, Math.max(p.peak, 1 - p.peak) - p.plateau / 2);
  return Math.round(p.hi - (p.hi - p.lo) * Math.min(1, off / reach));
}

/** A seeded profile in [lo, hi]. */
export function rollProfile(next: () => number, lo: number, hi: number, peak: [number, number] = [0.2, 0.7]): Profile {
  return { lo, hi, peak: peak[0] + next() * (peak[1] - peak[0]), plateau: next() * 0.5 };
}
