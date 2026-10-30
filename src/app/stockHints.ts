import { gatedBlueprints, portBlueprints, portsAt, type BlueprintOffer, type Port, type Sim } from '../sim';

/** How many hints a station or a node shows. */
const MAX_HINTS = 3;

/** "Shield gen Mk II" -> { line: "shield gen", mk: "Mk II" }; a name with no Mk suffix is its own line with no mark. */
function split(name: string): { line: string; mk: string } {
  const m = /^(.*) (Mk [IV]+)$/.exec(name);
  return m ? { line: (m[1] as string).toLowerCase(), mk: m[2] as string } : { line: name.toLowerCase(), mk: '' };
}

/** "Mk II shield gens": the best blueprint of each line among `offers`, best tier first (ties by name). */
function bestPerLine(offers: readonly BlueprintOffer[]): string[] {
  const best = new Map<string, BlueprintOffer>();
  for (const o of offers) {
    const line = split(o.name).line;
    const have = best.get(line);
    if (!have || o.tier > have.tier) best.set(line, o);
  }
  return [...best.entries()].sort(([an, a], [bn, b]) => b.tier - a.tier || (an < bn ? -1 : 1)).map(([line, o]) => `${split(o.name).mk} ${line}s`.trim());
}

/**
 * The notable stock of one port, as short phrases for the station inspector and the starmap node info: the best blueprint it still has to
 * teach you in each line from Mk II up ("Mk II shield gens"), a better tier held back by standing ("Mk III shield gens need standing"), and a
 * price perk of its owner ("Cheap fuel") when it trades. Empty when there is nothing worth a line.
 */
export function portHints(sim: Sim, port: Port): string[] {
  const out = bestPerLine(portBlueprints(sim, port).filter((o) => !o.known && o.tier >= 2));
  const gated = bestPerLine(gatedBlueprints(sim, port).filter((o) => !o.known));
  if (gated.length) out.push(`${gated[0]} need standing`);
  const perks = sim.content.galaxy?.factions[port.owner]?.specialities?.prices ?? {};
  if (port.trade) {
    for (const [key, mult] of Object.entries(perks).sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (mult >= 1) continue;
      const item = sim.content.items[key] ?? Object.values(sim.content.items).find((it) => it.tags.includes(key));
      if (item) out.push(`Cheap ${item.name.toLowerCase()}`);
    }
  }
  return out.slice(0, MAX_HINTS);
}

/** The notable stock of all the ports of a node (no repeats). */
export function nodeHints(sim: Sim, node: string): string[] {
  return [...new Set(portsAt(sim, node).flatMap((p) => portHints(sim, p)))].slice(0, MAX_HINTS);
}
