/**
 * A fight between NPC ships in the player's node (#603; logic in galaxy/engagements.ts and galaxy/engagementFlow.ts). Plain data on
 * `Sector.engagements`, saved with the sector: it only ever exists in the grid the player is in, and is settled before the player leaves.
 *
 * - 'meeting': two fleets of factions at war met in the player's node (galaxy/meetings.ts): the fight plays out ship by ship instead of the
 *   stats mini-sim. Side 0 is the one that attacks (the armed or pirate fleet), side 1 the other.
 * - 'aid': ships of a faction that likes the player (side 0) take on a ship that fired on the player and the ships it came with (side 1).
 */
export interface Engagement {
  id: number;
  kind: 'meeting' | 'aid';
  /** Galaxy node it happens in (the news and the alert name it). */
  node: string;
  /** Tick it started; the galaxy turn it started in. */
  since: number;
  turn: number;
  /** Fleet ids on each side (a meeting: one each; aid: the aiders' fleets, and the attacker's fleet when it has one). */
  fleets: [number[], number[]];
  /** Every ship that has been real on each side, with its descriptor id when it has one (a fleet's ship lifted out with its fleet fled; a forgotten one was lost). */
  members: [EngagementMember[], EngagementMember[]];
  /** Display names and galaxy factions of the two sides, for the news and the alert. */
  names: [string, string];
  factions: [string, string];
  /** The side the player joined: the first side whose foes the player fired on or boarded. */
  joined?: 0 | 1;
  /** Sides the player fired on or boarded. */
  struck?: (0 | 1)[];
  /** The summed integrity of the ships in play at the last check, and the tick the fight last did damage (a stalemate is ENGAGE_STALE_SEC without). */
  hull?: number;
  calm?: number;
  /** The side that gave up a stalemate and is jumping away, and since when. */
  leaving?: { side: 0 | 1; since: number };
}

export interface EngagementMember {
  ship: number;
  contact?: number;
}

/** What the sim reports about these fights (part of `SimEvent`). `who` is side 0 (the attacker, or the aiders), `foe` side 1. */
export type EngagementEvent =
  /** A fight began here; `ship` is a ship of it already real (0 when none is yet). */
  | { type: 'engagement.started'; engagement: number; kind: Engagement['kind']; node: string; who: string; faction: string; foe: string; foeFaction: string; ship: number }
  /** It is over: `winner` the side that held the field (null: a stats draw, or both sides gone at once), `stats` when the stats fight settled it, `standing` what joining it earned (with `faction`). */
  | {
    type: 'engagement.ended'; engagement: number; kind: Engagement['kind']; node: string; who: string; foe: string; winner: 0 | 1 | null; stats: boolean;
    joined?: 0 | 1; standing?: number; faction?: string;
  };
