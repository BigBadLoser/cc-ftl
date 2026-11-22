import type { Stance } from './defs';

/**
 * A sector whose control differs from what was generated (control.ts). `owner` is its faction now (null = nobody) and `since` the turn it changed;
 * `pressure` is an enemy pushing on it (`by`), `value` building up over `ticks` coarse ticks in a row over the threshold (coarse.ts).
 */
export interface SectorControl {
  owner: string | null;
  since: number;
  pressure?: { by: string; value: number; ticks: number };
}

/**
 * How a pair of factions stands now, kept where it differs from the relations table's baseline or has history (war.ts); the key is the sorted ids joined by `|`.
 * `stance` is the stance now, `since` the turn it began (0 = the generated baseline), `tired` war weariness (time at war, sectors lost, ships lost; 0 at peace) and
 * `heat` the friction of recent fights between them (it decays). An entry with the baseline stance and nothing in `tired` or `heat` is dropped.
 */
export interface PairState {
  stance: Stance;
  since: number;
  tired: number;
  heat: number;
}
