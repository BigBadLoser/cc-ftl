import { describe, expect, it } from 'vitest';
import { CombatC, ShipC, deserialize, galaxyIndex, newGame, playerShip, serialize, tierOf, type Sim } from '../sim';
import { wreckShip } from '../sim/combat/wreck';
import { addNotoriety, clearBlocker, clearCost, grudgeOf, tallyLosses } from '../sim/galaxy/heat';
import { dispatchHunters, huntPressure } from '../sim/galaxy/hunters';
import { encounterKind } from '../sim/galaxy/encounters';
import { portsAt } from '../sim/galaxy/portIndex';
import { ensureAround } from '../sim/galaxy/state';
import { onTurn } from '../sim/galaxy/turn';
import { HUNT_TURNS, KILL_NOTORIETY, MAX_HUNTERS, WANTED_AT } from '../sim/galaxy/tuningHeat';
import { content } from '.';

/** Spawn a generated ship next to the player's and return its id. */
function spawn(sim: Sim, faction: string): number {
  const before = new Set(sim.world.query(ShipC));
  for (const [cx, cy] of [[sim.sector.width - 40, sim.sector.height - 40], [40, sim.sector.height - 40], [sim.sector.width - 40, 40], [40, 40]] as const) {
    sim.enqueue({ type: 'debug.spawnGenerated', faction, depth: 1, seed: 7, cx: Math.round(cx), cy: Math.round(cy) });
    sim.step();
    const id = sim.world.query(ShipC).find((s) => !before.has(s));
    if (id !== undefined) return id;
  }
  throw new Error(`nothing spawned: ${JSON.stringify(sim.events.drain().filter((e) => e.type === 'command.rejected'))}`);
}

/** Point the player's guns at a ship. */
function target(sim: Sim, ship: number): void {
  const c = sim.world.get(playerShip(sim), CombatC);
  if (c) c.target = { ship, moduleId: 0 };
}

describe('notoriety', () => {
  it('counts a ship the player destroyed once, by the victim faction tier, and costs that faction reputation', () => {
    const sim = newGame(3, content);
    const pirate = spawn(sim, 'faction.scrapper');
    target(sim, pirate);
    wreckShip(sim, pirate);
    expect(sim.world.get(pirate, ShipC)?.killedBy).toBe('player');
    tallyLosses(sim);
    tallyLosses(sim);
    // Pirates are hostile from the start: killing one is nearly free, but they remember it.
    expect(sim.galaxy.heat.notoriety).toBe(KILL_NOTORIETY.hostile);
    expect(grudgeOf(sim, 'pirates')).toBe(1);
  });

  it('does not count a ship the player was not shooting at', () => {
    const sim = newGame(3, content);
    const ship = spawn(sim, 'faction.scrapper');
    wreckShip(sim, ship);
    tallyLosses(sim);
    expect(sim.galaxy.heat.notoriety).toBe(0);
  });

  it('makes the law hostile from WANTED_AT, and decays every turn', () => {
    const sim = newGame(3, content);
    expect(tierOf(sim, 'navy')).not.toBe('hostile');
    addNotoriety(sim, WANTED_AT);
    expect(tierOf(sim, 'navy')).toBe('hostile');
    expect(tierOf(sim, 'meridian')).not.toBe('hostile');
    for (let t = 1; t <= 10; t++) onTurn(sim, ++sim.galaxy.turn);
    expect(sim.galaxy.heat.notoriety).toBeLessThan(WANTED_AT);
    expect(tierOf(sim, 'navy')).not.toBe('hostile');
  });

  it('is saved with the galaxy', () => {
    const sim = newGame(3, content);
    addNotoriety(sim, 12.5);
    sim.galaxy.heat.hunted.navy = 4;
    const back = deserialize(serialize(sim), content);
    expect(back.galaxy.heat).toEqual({ notoriety: 12.5, hunted: { navy: 4 } });
  });

  it('can be paid off only at a pirate den, for credits', () => {
    const sim = newGame(3, content);
    addNotoriety(sim, 5);
    sim.trade.credits = 100000;
    // The start is not a den.
    expect(clearBlocker(sim)).toBe('noDen');
    expect(clearCost(sim)).toBeGreaterThan(0);
  });
});

describe('hunters', () => {
  it('only a grudge makes pirates hunt: their hostile base standing alone does not', () => {
    const sim = newGame(3, content);
    expect(tierOf(sim, 'pirates')).toBe('hostile');
    expect(huntPressure(sim, 'pirates')).toBe(0);
    sim.story.reputation.pirates = -3;
    expect(huntPressure(sim, 'pirates')).toBe(3);
    // The navy only hunts a wanted player.
    expect(huntPressure(sim, 'navy')).toBe(0);
    addNotoriety(sim, WANTED_AT + 10);
    expect(huntPressure(sim, 'navy')).toBeGreaterThan(1);
  });

  it('a wanted player is hunted by the law: the fleet makes for them, interdicts, then stands down and disbands at home', () => {
    const sim = newGame(3, content);
    ensureAround(sim, sim.galaxy.current);
    // Make sure there is a navy port in reach of the start (the start is navy space in every seed).
    const navyPort = [...galaxyIndex(sim.galaxy).nodes.keys()].some((n) => portsAt(sim, n).some((p) => p.owner === 'navy'));
    expect(navyPort).toBe(true);
    addNotoriety(sim, 60);
    let hunter: number | null = null;
    for (let t = 0; t < 60 && hunter === null; t++) {
      dispatchHunters(sim, ++sim.galaxy.turn);
      hunter = sim.galaxy.fleets.find((f) => f.hunt && f.faction === 'navy')?.id ?? null;
    }
    expect(hunter).not.toBeNull();
    const f = sim.galaxy.fleets.find((x) => x.id === hunter)!;
    expect(f.hunt!.until).toBe(sim.galaxy.turn + HUNT_TURNS);
    expect(encounterKind(sim, f)).toBe('interdict');
    expect(sim.galaxy.news.some((n) => n.kind === 'hunt' && n.faction === 'navy')).toBe(true);
    expect(sim.galaxy.fleets.filter((x) => x.hunt).length).toBeLessThanOrEqual(MAX_HUNTERS);
    // Keep the player's notoriety up while the turns go by: the hunter closes in on the player's node.
    for (let t = 0; t < 6; t++) {
      addNotoriety(sim, 2);
      onTurn(sim, ++sim.galaxy.turn);
    }
    expect([f.node, ...f.route].includes(sim.galaxy.current) || f.node === sim.galaxy.current).toBe(true);
    // Past its time it heads home and is disbanded there.
    for (let t = 0; t < HUNT_TURNS + 40 && sim.galaxy.fleets.some((x) => x.id === hunter); t++) onTurn(sim, ++sim.galaxy.turn);
    expect(sim.galaxy.fleets.some((x) => x.id === hunter)).toBe(false);
  });

  it('is deterministic', () => {
    const run = () => {
      const sim = newGame(9, content);
      ensureAround(sim, sim.galaxy.current);
      sim.story.reputation.pirates = -6;
      addNotoriety(sim, 40);
      const out: string[] = [];
      for (let t = 0; t < 40; t++) {
        onTurn(sim, ++sim.galaxy.turn);
        for (const e of sim.events.drain()) if (e.type === 'galaxy.hunt') out.push(`${sim.galaxy.turn}:${e.faction}:${e.ships}`);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });
});
