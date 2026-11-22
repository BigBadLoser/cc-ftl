/**
 * What the news log reports (news.ts). `destroyed`: `who` destroyed `foe`; `driven`: `who` drove `foe` off; `clash`: `who` and `foe` fought to a bloody draw;
 * `raid`: `who` raided a den and destroyed `foe`; `cut`: a trade route is cut, `foe` (a trader) was lost near here; `loot`: `who` took `count` of `item`
 * from `foe`; `shortage`: the port here is short of `item`; `rebuilt`: `who` was launched from the port here; `hunt`: `who` set out from here after the player.
 */
export type NewsKind = 'destroyed' | 'driven' | 'clash' | 'raid' | 'cut' | 'loot' | 'shortage' | 'rebuilt' | 'hunt';

export interface NewsItem {
  id: number;
  turn: number;
  kind: NewsKind;
  /** Where it happened (a node id; for a clash on a lane, the end it was settled at). */
  node: string;
  who: string;
  faction: string;
  foe?: string;
  foeFaction?: string;
  item?: string;
  count?: number;
}
