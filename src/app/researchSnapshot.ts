import { JobC, ResearchC, TICK_HZ, homeShip, isBlueprintKnown, isResearchDone, labsOf, stockOn, type Sim } from '../sim';
import type { UiResearch, UiResearchProject } from '../ui/api';

const NONE: UiResearch = { ship: 0, labs: 0, workers: 0, projects: [], queue: [] };

/** The home ship's research: every project with its cost against stock, its place in the queue and what it unlocks. Reads the sim only. */
export function buildResearch(sim: Sim): UiResearch {
  const defs = sim.content.research;
  if (!defs) return NONE;
  const ship = homeShip(sim);
  const r = sim.world.get(ship, ResearchC);
  const queue = r?.queue ?? [];
  const labs = labsOf(sim, ship);
  const workers = sim.world.query(JobC).filter((id) => {
    const j = sim.world.get(id, JobC);
    return j?.kind === 'research' && j.reservedBy !== 0 && labs.includes(j.target ?? 0);
  }).length;
  const name = (def: string): string => sim.content.modules[def]?.name ?? def;
  const projects = Object.entries(defs).map(([id, d]): UiResearchProject => {
    const pos = queue.indexOf(id);
    const active = pos === 0 && !!r?.paid;
    const missing = d.requires?.filter((q) => !isBlueprintKnown(sim, q)) ?? [];
    const status = active ? 'active' : pos >= 0 ? 'queued' : isResearchDone(sim, d) ? 'known' : missing.length ? 'locked' : 'open';
    return {
      id, name: d.name, status, pos: pos < 0 ? null : pos,
      cost: d.cost.map((c) => ({ item: c.item, name: sim.content.items[c.item]?.name ?? c.item, count: c.count, have: stockOn(sim, ship, c.item) })),
      seconds: Math.round(d.work / TICK_HZ),
      progress: active && r ? Math.min(1, r.progress / d.work) : 0,
      unlocks: d.unlocks.map(name),
      needs: missing.map(name),
    };
  });
  return { ship, labs: labs.length, workers, projects, queue };
}
