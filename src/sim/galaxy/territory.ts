import type { GalaxyFactionDef } from './defs';
import { inDanger } from './defs';
import { unit } from './hash';
import { DANGER_MAX, DANGER_STEP, TERRITORY_CELL, TERRITORY_REACH, TERRITORY_REACH_BOOST, TERRITORY_SCALE } from './tuning';

const CELL = TERRITORY_CELL * TERRITORY_SCALE;

/** Weight of a territory seed claiming no faction (open space between the powers). */
const OPEN_SPACE_WEIGHT = 1.2;

/** Danger tier at a map position: rises with distance from the start (0, 0). */
export function dangerAt(x: number, y: number): number {
  return Math.min(DANGER_MAX, Math.floor(Math.hypot(x, y) / DANGER_STEP));
}

interface TerritorySeed {
  x: number;
  y: number;
  faction: string | null;
  reach: number;
}

/**
 * Faction space as a deterministic field: one seed per TERRITORY_CELL x TERRITORY_SCALE cell (jittered, faction drawn by territory weight
 * at the seed's danger tier, or open space), and a point belongs to the seed nearest relative to its reach. The start
 * cell's seed sits at (0, 0) and belongs to the `home` faction. Pure in (seed, cell), so chunks agree at the seams.
 */
export class TerritoryField {
  private seeds = new Map<string, TerritorySeed>();

  constructor(
    readonly seed: number,
    private readonly factions: Readonly<Record<string, GalaxyFactionDef>>,
  ) {}

  private seedAt(tx: number, ty: number): TerritorySeed {
    const key = `${tx},${ty}`;
    let s = this.seeds.get(key);
    if (!s) {
      const home = tx === 0 && ty === 0;
      const x = home ? 0 : (tx - 0.5 + unit(this.seed, tx, ty, 11)) * CELL;
      const y = home ? 0 : (ty - 0.5 + unit(this.seed, tx, ty, 12)) * CELL;
      const danger = dangerAt(x, y);
      let faction: string | null = null;
      if (home) faction = Object.keys(this.factions).find((id) => this.factions[id]?.home) ?? null;
      else {
        const pool: { id: string | null; weight: number }[] = [{ id: null, weight: OPEN_SPACE_WEIGHT }];
        for (const [id, f] of Object.entries(this.factions)) {
          if (f.territory && f.territory.weight > 0 && inDanger(f.territory.danger, danger)) pool.push({ id, weight: f.territory.weight });
        }
        let roll = unit(this.seed, tx, ty, 13) * pool.reduce((t, p) => t + p.weight, 0);
        faction = (pool.find((p) => (roll -= p.weight) < 0) ?? pool[pool.length - 1])?.id ?? null;
      }
      const base = faction ? this.factions[faction]?.territory?.reach ?? TERRITORY_REACH : TERRITORY_REACH;
      s = { x, y, faction, reach: TERRITORY_SCALE * TERRITORY_REACH_BOOST * base * (0.8 + 0.4 * unit(this.seed, tx, ty, 14)) };
      this.seeds.set(key, s);
    }
    return s;
  }

  /** The faction whose space holds (x, y), or null for open space. */
  factionAt(x: number, y: number): string | null {
    const tx = Math.floor(x / CELL + 0.5);
    const ty = Math.floor(y / CELL + 0.5);
    let best: TerritorySeed | null = null;
    let bestScore = Infinity;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const s = this.seedAt(tx + dx, ty + dy);
        const score = Math.hypot(s.x - x, s.y - y) / s.reach;
        if (score < bestScore) {
          bestScore = score;
          best = s;
        }
      }
    }
    return best && bestScore < 1 ? best.faction : null;
  }
}
