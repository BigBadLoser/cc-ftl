import { AllegianceC, CrewC, DeadC, MoodC, opinionOf, personOf, type BondReason, type Opinion, type Sim } from '../sim';
import { near } from '../sim/crew/bondMood';
import { BOND_FRIEND_MOOD, BOND_FRIEND_WORK_MULT, BOND_MAX_FRIENDS, BOND_MAX_RIVALS, BOND_RIVAL_MOOD } from '../sim/tuning';
import { TICK_HZ } from '../sim/time';
import type { UiBehaviour, UiHistoryLine, UiSocial, UiSocialRow } from '../ui/crewDetailApi';
import { placeNamer } from './bondSnapshot';
import { bondReasonText, bondWord } from './bondText';

type PlaceName = (node: string) => string | undefined;

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** One merged, oldest-first timeline of the reasons behind both directions of a bond. A reason both sides have, from the same event, is one line marked "both". */
export function historyOf(mine: Opinion | undefined, theirs: Opinion | undefined, now: number, place: PlaceName): UiHistoryLine[] {
  const lines: (UiHistoryLine & { tick: number })[] = [];
  const text = (r: BondReason): string => cap(bondReasonText(r.id, r.at ? place(r.at) : undefined));
  const used = new Set<BondReason>();
  for (const r of mine?.reasons ?? []) {
    const t = theirs?.reasons.find((x) => x.id === r.id && x.tick === r.tick && Math.sign(x.d) === Math.sign(r.d) && !used.has(x));
    if (t) used.add(t);
    lines.push({ who: t ? 'both' : 'me', text: text(r), good: r.d > 0, agoSec: Math.max(0, Math.round((now - r.tick) / TICK_HZ)), tick: r.tick });
  }
  for (const r of theirs?.reasons ?? []) if (!used.has(r)) lines.push({ who: 'them', text: text(r), good: r.d > 0, agoSec: Math.max(0, Math.round((now - r.tick) / TICK_HZ)), tick: r.tick });
  return lines.sort((a, b) => a.tick - b.tick).map((l) => ({ who: l.who, text: l.text, good: l.good, agoSec: l.agoSec }));
}

/** The one-line summary of a bond: "Friends since Fenix Alpha" (the earliest reason that has a named place), else the strongest reason, else the bare word. */
export function summaryOf(mine: Opinion | undefined, theirs: Opinion | undefined, place: PlaceName): string {
  const op = mine?.kind ? mine : theirs?.kind ? theirs : mine ?? theirs;
  const word = op?.kind === 'friend' ? 'Friends' : op?.kind === 'rival' ? 'Rivals' : bondWord(op?.score ?? 0);
  const all = [...(mine?.reasons ?? []), ...(theirs?.reasons ?? [])];
  const first = all.filter((r) => r.at && place(r.at)).sort((a, b) => a.tick - b.tick)[0];
  if (first) return `${word} since ${place(first.at!)}`;
  let best: BondReason | undefined;
  for (const r of all) if (!best || Math.abs(r.d) > Math.abs(best.d)) best = r;
  return best ? `${word}: ${bondReasonText(best.id)}` : word;
}

/** The stat effects of the bond for `me` now, read from tuning (friends and rivals only; a plain acquaintance has none). */
export function effectsOf(mine: Opinion | undefined, name: string): { text: string; good: boolean }[] {
  const sign = (n: number): string => `${n < 0 ? '−' : '+'}${Math.abs(n)}`;
  if (mine?.kind === 'friend') return [
    { text: `${sign(BOND_FRIEND_MOOD)} mood nearby`, good: true },
    { text: `×${BOND_FRIEND_WORK_MULT} work beside ${name}`, good: true },
  ];
  if (mine?.kind === 'rival') return [{ text: `${sign(BOND_RIVAL_MOOD)} mood nearby`, good: false }];
  return [];
}

/** What the pair does differently, from the spot choices that read bonds (meal, break spot, bed): friends pick spots together, rivals keep apart. */
export function behavioursOf(mine: Opinion | undefined, me: string, name: string): UiBehaviour[] {
  if (mine?.kind !== 'friend' && mine?.kind !== 'rival') return [];
  const friend = mine.kind === 'friend', pair = `${me} and ${name}`;
  return [
    { icon: 'food', text: `${pair} prefer to eat ${friend ? 'together' : 'apart'}` },
    { icon: 'cup', text: `${pair} prefer to take breaks ${friend ? 'together' : 'apart'}` },
    { icon: 'sleep', text: `${pair} prefer to sleep ${friend ? 'near each other' : 'apart'}` },
  ];
}

function rowOf(sim: Sim, me: number, other: number, place: PlaceName): UiSocialRow {
  const a = personOf(sim, me), b = personOf(sim, other);
  const mine = a && b ? opinionOf(sim, a, b) : undefined, theirs = a && b ? opinionOf(sim, b, a) : undefined;
  const name = sim.world.get(other, CrewC)?.name ?? 'Crew', myName = sim.world.get(me, CrewC)?.name ?? 'Crew';
  const label = mine?.kind ?? theirs?.kind;
  const section = mine?.kind === 'friend' ? 'friends' : mine?.kind === 'rival' ? 'rivals' : 'crew';
  return {
    id: other, name, myName, section, mine: Math.round(mine?.score ?? 0), theirs: Math.round(theirs?.score ?? 0),
    tag: !label ? null : mine?.kind === theirs?.kind ? 'mutual' : 'one-sided',
    summary: summaryOf(mine, theirs, place), history: historyOf(mine, theirs, sim.tick, place), effects: effectsOf(mine, name), behaviours: behavioursOf(mine, myName, name),
  };
}

/** The Social tab's data for one player crew member: everyone else aboard in three sections, the caps, and the live mood from people. */
export function buildSocial(sim: Sim, me: number, place: PlaceName = placeNamer(sim)): UiSocial {
  const rows = sim.world.query(CrewC).filter((o) => o !== me && !sim.world.has(o, DeadC) && sim.world.get(o, AllegianceC)?.faction === 'player'
    && !sim.content.species[sim.world.get(o, CrewC)!.species]?.mechanical).map((o) => rowOf(sim, me, o, place));
  const strength = (r: UiSocialRow): number => Math.abs(r.mine);
  const pick = (s: UiSocialRow['section']): UiSocialRow[] => rows.filter((r) => r.section === s).sort((x, y) => strength(y) - strength(x) || x.id - y.id);
  const crew = rows.filter((r) => r.section === 'crew').sort((x, y) => x.name.localeCompare(y.name));
  const names = (kind: 'friend' | 'rival'): string[] => near(sim, me, kind).map((e) => sim.world.get(e, CrewC)?.name ?? 'Crew');
  const mood = sim.world.get(me, MoodC)?.factors ?? [];
  // The factor is flat however many are near (+4 for any friend), so the names share one entry.
  const moodLine = [['withFriend', 'friend'], ['nearRival', 'rival']].flatMap(([key, kind]) => {
    const f = mood.find((x) => x.key === key), who = names(kind as 'friend' | 'rival');
    return f && f.value !== 0 && who.length ? [{ who: who.join(', '), value: Math.round(f.value * 10) / 10 }] : [];
  });
  return { friends: pick('friends'), rivals: pick('rivals'), crew, caps: { friends: BOND_MAX_FRIENDS, rivals: BOND_MAX_RIVALS }, moodLine };
}
