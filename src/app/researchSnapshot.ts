import { JobC, ResearchC, TICK_HZ, homeShip, isBlueprintKnown, isResearchDone, labsOf, stockOn, type ModuleDef, type Sim } from '../sim';
import type { UiResearch, UiResearchNode, UiResearchStat } from '../ui/api';

const NONE: UiResearch = { ship: 0, labs: 0, workers: 0, bands: [], nodes: [], queue: [] };
const CATEGORY: Record<string, string> = { power: 'Power', defence: 'Defence', systems: 'Ship systems', life: 'Life support', production: 'Production', utility: 'Utility' };

interface Stat { label: string; value: number; unit: string; lowerBetter?: boolean }

/** The numbers a module is judged by in the research panel. */
function statsOf(d: ModuleDef): Stat[] {
  const out: Stat[] = [];
  if (d.power > 0) out.push({ label: 'Output', value: d.power, unit: '' });
  if (d.shieldGen) out.push({ label: 'Layers', value: Math.floor(Math.abs(d.power) * d.shieldGen.layersPerPower), unit: '' }, { label: 'Recharge', value: d.shieldGen.rechargeSec, unit: ' s', lowerBetter: true });
  if (d.engine) out.push({ label: 'Evasion', value: Math.round(Math.abs(d.power) * d.engine.evasionPerPower * 100), unit: '%' }, { label: 'Fuel use', value: Math.round((d.engine.fuelFactor ?? 1) * 100), unit: '%', lowerBetter: true });
  if (d.power < 0) out.push({ label: 'Draw', value: -d.power, unit: '', lowerBetter: true });
  out.push({ label: 'Hull', value: d.maxHp, unit: '' });
  return out;
}

function statLines(d: ModuleDef, below: ModuleDef | undefined): UiResearchStat[] {
  const prev = below ? statsOf(below) : [];
  return statsOf(d).map((s) => {
    const before = prev.find((p) => p.label === s.label);
    const diff = before ? s.value - before.value : 0;
    return {
      label: s.label, value: `${s.value}${s.unit}`,
      delta: diff ? `${diff > 0 ? '+' : '-'}${Math.abs(diff)}${s.unit}` : null,
      good: s.lowerBetter ? diff < 0 : diff > 0,
    };
  });
}

/** The home ship's research tree: the modules it starts with as roots, every project as a node, with status, cost against stock and queue place. Reads the sim only. */
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
  const mods = sim.content.modules;
  const unlockedBy = new Map<string, string>();
  for (const [id, d] of Object.entries(defs)) for (const u of d.unlocks) unlockedBy.set(u, id);
  const nodeOf = (def: string): string => unlockedBy.get(def) ?? `root:${def}`;
  const nodes = new Map<string, UiResearchNode>();
  const size = (d: ModuleDef | undefined): string => (d ? `${d.footprint[0]}x${d.footprint[1]}` : '');
  const sub = (d: ModuleDef | undefined): string => `${CATEGORY[d?.category ?? ''] ?? 'Module'} · ${size(d)}`;

  // Roots: modules some project requires that no project unlocks.
  for (const d of Object.values(defs)) {
    for (const q of d.requires ?? []) {
      if (unlockedBy.has(q) || nodes.has(`root:${q}`) || !mods[q]) continue;
      const m = mods[q] as ModuleDef;
      nodes.set(`root:${q}`, {
        id: `root:${q}`, name: m.name, band: d.category, parents: [], project: false, status: isBlueprintKnown(sim, q) ? 'known' : 'locked', pos: null,
        module: q, sub: sub(m), stats: statLines(m, undefined), cost: [], seconds: 0, progress: 0,
      });
    }
  }
  const status = new Map<string, UiResearchNode['status']>();
  const resolve = (id: string): UiResearchNode['status'] => {
    const known = status.get(id);
    if (known) return known;
    const n = nodes.get(id);
    if (n && !n.project) return n.status;
    const d = defs[id];
    if (!d) return 'locked';
    const pos = queue.indexOf(id);
    let st: UiResearchNode['status'];
    if (isResearchDone(sim, d)) st = 'known';
    else if (pos === 0 && r?.paid) st = 'active';
    else if (pos >= 0) st = 'queued';
    else st = (d.requires ?? []).every((q) => { const s = resolve(nodeOf(q)); return s === 'known' || s === 'queued' || s === 'active'; }) ? 'open' : 'locked';
    status.set(id, st);
    return st;
  };
  for (const [id, d] of Object.entries(defs)) {
    const unlocked = mods[d.unlocks[0] ?? ''] as ModuleDef | undefined;
    const below = mods[d.requires?.[0] ?? ''] as ModuleDef | undefined;
    const pos = queue.indexOf(id);
    const st = resolve(id);
    nodes.set(id, {
      id, name: d.name, band: d.category, parents: (d.requires ?? []).map(nodeOf), project: true, status: st, pos: pos < 0 ? null : pos,
      module: d.unlocks[0] ?? '', sub: sub(unlocked), stats: unlocked ? statLines(unlocked, below) : [],
      cost: d.cost.map((c) => ({ item: c.item, name: sim.content.items[c.item]?.name ?? c.item, count: c.count, have: stockOn(sim, ship, c.item) })),
      seconds: Math.round(d.work / TICK_HZ), progress: st === 'active' && r ? Math.min(1, r.progress / d.work) : 0,
      ...(d.col !== undefined ? { col: d.col } : {}), ...(d.row !== undefined ? { row: d.row } : {}),
    });
  }
  return { ship, labs: labs.length, workers, bands: sim.content.researchBands ?? [], nodes: [...nodes.values()], queue };
}
