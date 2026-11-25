/** The NPC fleet record of the starmap view data (split from starmapApi.ts). Plain data; map units, y down. */
/** A theme colour by token name (`--cyan`...): the view maps it through `starmapStyle.ts`; the data holds no CSS. */
export type Tone = 'cyan' | 'amber' | 'green' | 'red' | 'text' | 'dim';

/** An NPC fleet the sensors can see: drawn beside its node, heading for `next` (null while resting). */
export interface UiStarFleet {
  id: number;
  node: string;
  x: number;
  y: number;
  /** The next node on its route (position), or null when it rests or is stranded. */
  tx: number | null;
  ty: number | null;
  /** The fleet's name (its first ship, "+n" for the rest), e.g. "CNS Valiant +1". */
  name: string;
  /** Faction name, role label ("Trader", "Patrol", "Raider"), ship count, tone by faction kind, and whether it is hostile to the player. */
  faction: string;
  role: string;
  /** The role id, for its icon (`starmap.fleet.<kind>.d0..d7`). */
  kind: string;
  ships: number;
  tone: Tone;
  hostile: boolean;
  damaged: boolean;
  /** What it is doing: "Resting at X", "Trading run to X", "Returning home to X", "Adrift"... */
  heading: string;
  /** Where it was before this turn's jump (position), or null when it did not move this turn: the slide that lands it on `node`. */
  fx: number | null;
  fy: number | null;
  /** Jumps left on its route (0 while it rests or is stranded). It takes the next one when the turn ends. */
  hops: number;
  /** Its home port's node. */
  home: string;
  /** What it carries ("20 Metal, 4 Ice"), or empty. */
  cargo?: string;
}
