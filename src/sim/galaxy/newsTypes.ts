/**
 * What the news log reports (news.ts). `destroyed`: `who` destroyed `foe`; `driven`: `who` drove `foe` off; `clash`: `who` and `foe` fought to a bloody draw;
 * `raid`: `who` raided a den and destroyed `foe`; `cut`: a trade route is cut, `foe` (a trader) was lost near here; `loot`: `who` took `count` of `item`
 * from `foe`; `shortage`: the port here is short of `item`; `rebuilt`: `who` was launched from the port here; `hunt`: `who` set out from here after the player.
 * The coarse tier (coarse.ts) reports borders: `front`: fighting on the border of the sector `who` (`faction` presses, `foeFaction` defends); `fell`: the sector `who` fell to `faction` from `foeFaction`;
 * `held`: `faction` held the sector `who` against `foeFaction`; `war`: `faction` went to war with `foeFaction`; `peace`: the war between them ended (war.ts).
 */
export type NewsKind = 'destroyed' | 'driven' | 'clash' | 'raid' | 'cut' | 'loot' | 'shortage' | 'rebuilt' | 'hunt' | 'front' | 'fell' | 'held' | 'war' | 'peace' | 'joined' | 'taken' | 'seized';

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
