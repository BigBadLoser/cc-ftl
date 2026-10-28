import { describe, expect, it } from 'vitest';
import {
  AllegianceC, BoarderC, CORE_RAID_HOLD_TICKS, CombatC, DeadC, DownedC, isHostile, rogueAlly, CoreRaidC, CoreRaiderC, CrewC, coreObjective, PositionC, ShipC, TerritoryField, augmentedCrew, captureReady, createCrew, crewSubdued,
  encounterKind, hailVerdict, hasLiveCore, homeShip, newGame, neverSurrenders, nodeOf, shipIdOf, spillSources, stanceBetween, standing, tierOf,
  type Fleet, type GalaxyContent, type Sim,
} from '../sim';
import { EquipC } from '../sim/fight/components';
import { ModuleC } from '../sim/modules/components';
import { firstFoe } from '../sim/systems/enemyAi';
import { spawnContact } from '../sim/galaxy/arrivals';
import { portsAt } from '../sim/galaxy/portIndex';
import { content } from '.';

const galaxy = content.galaxy as unknown as GalaxyContent;
const PIRATES = ['pirates', 'raiders', 'cartel', 'zealots', 'mercenaries'];

describe('pirate factions: relations', () => {
  it('lists every pirate pair; they are hostile to each other unless the design says otherwise', () => {
    for (const a of PIRATES) for (const b of PIRATES) {
      if (a >= b) continue;
      expect(galaxy.relations.some((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)), `${a} ${b} has a row`).toBe(true);
    }
    const war = (a: string, b: string): boolean => stanceBetween(galaxy, a, b) === 'war';
    expect(war('raiders', 'pirates') && war('raiders', 'zealots') && war('pirates', 'zealots') && war('cartel', 'zealots')).toBe(true);
    expect(war('cartel', 'raiders')).toBe(true);
    expect(stanceBetween(galaxy, 'cartel', 'pirates')).toBe('neutral');
  });

  it('keeps the mercenaries neutral to everyone and the zealots allied with the Rogue AI, which still fights everyone else', () => {
    for (const id of Object.keys(galaxy.factions)) {
      if (id === 'mercenaries' || id === 'rogue') continue; // the machines fight everyone (alwaysHostile)
      expect(stanceBetween(galaxy, 'mercenaries', id), id).not.toBe('war');
    }
    expect(stanceBetween(galaxy, 'zealots', 'rogue')).toBe('allied');
    expect(stanceBetween(galaxy, 'rogue', 'zealots')).toBe('allied');
    expect(stanceBetween(galaxy, 'rogue', 'raiders')).toBe('war');
    expect(stanceBetween(galaxy, 'rogue', 'navy')).toBe('war');
    // They fly on the machines' side in a fight, so drones and zealots never shoot at each other.
    expect(galaxy.factions['zealots']?.combatFaction).toBe(galaxy.factions['rogue']?.combatFaction);
  });

  it('puts the navy and the free traders at war with every pirate faction but the mercenaries', () => {
    for (const p of PIRATES.filter((x) => x !== 'mercenaries')) {
      expect(stanceBetween(galaxy, 'navy', p), `navy ${p}`).toBe('war');
      expect(stanceBetween(galaxy, 'traders', p), `traders ${p}`).toBe('war');
    }
  });

  it('gives each faction a standing key of its own', () => {
    const keys = PIRATES.map((p) => galaxy.factions[p]?.reputation);
    expect(new Set(keys).size).toBe(PIRATES.length);
  });
});

describe('pirate factions: standing', () => {
  it('lowers standing with a faction you fight and warms its rivals through the spill', () => {
    const sim = newGame(1, content);
    const before = Object.fromEntries(PIRATES.map((p) => [p, standing(sim, p)]));
    sim.story.reputation['raiders'] = -4; // four raider ships down (heat.ts: KILL_REPUTATION each)
    expect(standing(sim, 'raiders')).toBeCloseTo((before['raiders'] as number) - 4, 5);
    expect(standing(sim, 'cartel')).toBeGreaterThan(before['cartel'] as number);
    expect(standing(sim, 'pirates')).toBeGreaterThan(before['pirates'] as number);
    expect(standing(sim, 'mercenaries')).toBe(before['mercenaries']);
    expect(spillSources(galaxy, 'zealots')).toContainEqual({ faction: 'rogue', weight: 0.6 });
  });

  it('makes the cartel one favour from neutral, and the others hostile at the start', () => {
    const sim = newGame(1, content);
    expect(tierOf(sim, 'cartel')).toBe('hostile');
    sim.story.reputation['cartel'] = 1;
    expect(tierOf(sim, 'cartel')).toBe('neutral');
    for (const p of ['raiders', 'zealots']) expect(tierOf(sim, p)).toBe('hostile');
    expect(tierOf(sim, 'mercenaries')).toBe('neutral');
  });
});

describe('pirate factions: territory and fleets', () => {
  it('puts zealot space only beside the machines\'', () => {
    let zealots = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const field = new TerritoryField(seed, galaxy.factions);
      const rogue: { x: number; y: number }[] = [];
      const cult: { x: number; y: number }[] = [];
      for (let x = -40000; x <= 40000; x += 700) for (let y = -40000; y <= 40000; y += 700) {
        const f = field.factionAt(x, y);
        if (f === 'rogue') rogue.push({ x, y });
        else if (f === 'zealots') cult.push({ x, y });
      }
      zealots += cult.length;
      for (const c of cult) expect(rogue.some((r) => Math.hypot(r.x - c.x, r.y - c.y) < 20000), `seed ${seed}`).toBe(true);
    }
    expect(zealots).toBeGreaterThan(0);
  });

  it('fields the cartel with hired mercenary escorts, small raiders, and balanced mercenaries', () => {
    const seen = { escort: 0, cartelShips: 0, cartelFleets: 0, raiderFleets: 0, mercFleets: 0, zealotFleets: 0 };
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const sim = newGame(seed, content);
      sim.enqueue({ type: 'debug.galaxyReveal', radius: 6 });
      sim.step();
      for (const f of sim.galaxy.fleets) {
        if (f.faction === 'cartel') {
          seen.cartelFleets++;
          for (const c of f.ships) {
            if (c.hired) {
              seen.escort++;
              expect([c.faction, c.hired]).toEqual(['mercenaries', 'cartel']);
              expect(c.shipgen).toBe('faction.mercenary');
            } else {
              seen.cartelShips++;
              expect(c.shipgen).toBe('faction.cartel');
            }
          }
        }
        if (f.faction === 'raiders') {
          seen.raiderFleets++;
          for (const c of f.ships) expect(c.shipgen).toBe('faction.raider');
        }
        if (f.faction === 'mercenaries') seen.mercFleets++;
        if (f.faction === 'zealots') seen.zealotFleets++;
      }
    }
    expect(seen.escort).toBeGreaterThan(0);
    expect(seen.cartelShips).toBeGreaterThanOrEqual(seen.cartelFleets);
    expect(seen.raiderFleets).toBeGreaterThan(0);
    expect(seen.mercFleets).toBeGreaterThan(0);
    expect(seen.zealotFleets).toBeGreaterThan(0);
  }, 240000);

  it('gives every new faction a den (the existing pirate den placeholder) in its space', () => {
    const owners = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const sim = newGame(seed, content);
      sim.enqueue({ type: 'debug.galaxyReveal', radius: 6 });
      sim.step();
      for (const f of sim.galaxy.fleets) if (portsAt(sim, f.node).some((p) => p.id === f.home && p.kind === 'den')) owners.add(f.faction);
    }
    for (const p of ['raiders', 'cartel', 'zealots', 'mercenaries']) expect(owners.has(p), p).toBe(true);
  }, 240000);
});

describe('the cartel guards its routes', () => {
  it('interdicts in its own space and only hails elsewhere, unless it was sent to hunt the player', () => {
    const sim = newGame(1, content);
    const node = nodeOf(sim, sim.galaxy.current)!;
    const fleet = { id: 1, faction: 'cartel', role: 'pirate', node: node.id, ships: [], hunt: undefined } as unknown as Fleet;
    node.faction = 'cartel';
    expect(encounterKind(sim, fleet)).toBe('interdict');
    node.faction = 'navy';
    expect(encounterKind(sim, fleet)).toBe('hail');
    expect(encounterKind(sim, { ...fleet, hunt: { until: 99 } } as unknown as Fleet)).toBe('interdict');
    // A raider has no such manners.
    expect(encounterKind(sim, { ...fleet, faction: 'raiders' })).toBe('interdict');
  });
});

describe('zealots', () => {
  const zealotShip = (sim: Sim): number => {
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.zealot', seed: 12, depth: 3, cx: 130, cy: 70 });
    sim.step();
    return sim.world.query(ShipC).find((id) => sim.world.get(id, ShipC)?.gen?.faction === 'faction.zealot') as number;
  };

  it('fly on the machines\' side, are augmented, and a fight with them ends in a derelict, never a prize', () => {
    const sim = newGame(1, content);
    const id = zealotShip(sim);
    expect(id).toBeGreaterThan(0);
    const ship = sim.world.get(id, ShipC)!;
    expect(ship.faction).toBe('rogue');
    expect(neverSurrenders(sim, id)).toBe(true);
    expect(neverSurrenders(sim, homeShip(sim))).toBe(false);
    const crew = sim.world.query(CrewC).filter((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === id);
    expect(crew.length).toBeGreaterThan(0);
    for (const c of crew) expect(sim.content.species[sim.world.get(c, CrewC)!.species]?.fearless).toBe(true);
    expect(captureReady(sim, id)).toBe(false);
    // Crew down: the ship is given up as a derelict (a living rogue-side crew, unlike the drones', has nothing to replace them).
    expect(crewSubdued(sim, id, ship)).toBe(false);
    for (const c of crew) sim.world.add(c, DownedC, { bleed: 99, stabilized: false, bed: 0 });
    expect(crewSubdued(sim, id, ship)).toBe(true);
  });

  it('answer a hail only when standing is high (the augmentation check counts nobody until implants)', () => {
    const sim = newGame(1, content);
    const id = zealotShip(sim);
    sim.world.get(id, ShipC)!.gen!.owner = 'zealots';
    expect(augmentedCrew(sim)).toBe(0);
    expect(hailVerdict(sim, id).answers).toBe(false);
    sim.story.reputation['zealots'] = 3;
    expect(hailVerdict(sim, id).answers).toBe(true);
  });
});

describe('the machines and the zealots', () => {
  it('stay allies at any standing: friendly zealots sit on the neutral side, and drones neither shoot them nor fight their crews', () => {
    const sim = newGame(1, content);
    sim.story.reputation['zealots'] = 3;
    const contact = { id: 9001, faction: 'zealots', shipgen: 'faction.zealot', seed: 12, depth: 3, since: 0 };
    expect(spawnContact(sim, sim.galaxy.current, contact)).toBe(true);
    const zealot = (contact as { ship?: number }).ship as number;
    expect(sim.world.get(zealot, ShipC)?.faction).toBe('neutral');
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.drones', seed: 5, depth: 3, cx: 60, cy: 120 });
    sim.step();
    const drone = sim.world.query(ShipC).find((id) => sim.world.get(id, ShipC)?.gen?.faction === 'faction.drones') as number;
    // A debug spawn flies the generator's default side; put the drones (ship and crew) on the machines' side as a node contact would.
    sim.world.get(drone, ShipC)!.faction = 'rogue';
    for (const c of sim.world.query(CrewC)) if (shipIdOf(sim, sim.world.get(c, PositionC)) === drone) sim.world.get(c, AllegianceC)!.faction = 'rogue';
    expect(rogueAlly(sim, zealot)).toBe(true);
    expect(rogueAlly(sim, drone)).toBe(false);
    const on = (ship: number): number => sim.world.query(CrewC).find((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === ship) as number;
    expect(isHostile(sim, on(drone), on(zealot))).toBe(false);
    expect(isHostile(sim, on(zealot), on(drone))).toBe(false);
    // With the player's ships out of play, the drones have no one to shoot: not the friendly zealots either.
    for (const id of sim.world.query(ShipC)) if (sim.world.get(id, ShipC)!.faction === 'player') sim.world.get(id, ShipC)!.state = 'wreck';
    expect(firstFoe(sim, 'rogue')).toBe(0);
  });
});

describe('raider boarding holds fire only while a party is out', () => {
  function raiderSetup(): { sim: Sim; raider: number; party: number } {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.raider', seed: 7, depth: 3, cx: 130, cy: 70 });
    sim.step();
    const raider = sim.world.query(ShipC).find((id) => sim.world.get(id, ShipC)?.gen?.faction === 'faction.raider') as number;
    const party = sim.world.query(CrewC).find((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === raider) as number;
    return { sim, raider, party };
  }

  it('does not hold fire when the launch was dropped with the party still aboard', () => {
    const { sim, raider, party } = raiderSetup();
    const b = sim.world.get(raider, BoarderC)!;
    expect(b.prefer).toBe(true);
    Object.assign(b, { state: 'done', crew: [party] });
    for (let i = 0; i < 60; i++) sim.step();
    expect(sim.world.get(raider, CombatC)!.hold).toBe(false);
  });

  it('holds fire while the party stands on the target, and fires again when they are gone', () => {
    const { sim, raider, party } = raiderSetup();
    const b = sim.world.get(raider, BoarderC)!;
    Object.assign(b, { state: 'landed', crew: [party] });
    const me = sim.world.query(ModuleC).find((m) => shipIdOf(sim, sim.world.get(m, ModuleC)) === homeShip(sim)) as number;
    const at = sim.world.get(me, ModuleC)!;
    const pos = sim.world.get(party, PositionC)!;
    Object.assign(pos, { x: at.x, y: at.y, toX: at.x, toY: at.y });
    for (let i = 0; i < 60; i++) sim.step();
    expect(sim.world.get(raider, CombatC)!.hold).toBe(true);
    sim.world.add(party, DeadC, sim.world.get(party, DeadC) ?? ({ tick: sim.tick } as never));
    for (let i = 0; i < 60; i++) sim.step();
    expect(sim.world.get(raider, CombatC)!.hold).toBe(false);
  });
});

describe('the core raid', () => {
  function raidSetup(): { sim: Sim; core: number; raider: number; ship: number } {
    const sim = newGame(1, content);
    const ship = homeShip(sim);
    // Nobody to defend it: the raid is about the hold, not the fight.
    for (const c of sim.world.query(CrewC)) if (sim.world.get(c, AllegianceC)?.faction === 'player') sim.world.destroyEntity(c);
    const core = sim.world.query(ModuleC).find((m) => sim.content.modules[sim.world.get(m, ModuleC)!.def]?.aiCore) as number;
    const m = sim.world.get(core, ModuleC)!;
    const raider = createCrew(sim, ship, 'role.zealot_guard', { x: m.x, y: m.y }, { faction: 'rogue' });
    sim.world.add(raider, EquipC, { weapon: 'item.blade' }); // issued to the party when it leaves, so it does not go looking for a gun
    sim.world.add(raider, CoreRaiderC, { from: 0 });
    return { sim, core, raider, ship };
  }

  it('tears the core out of a ship whose core room the raiders hold long enough', () => {
    const { sim, core, ship } = raidSetup();
    sim.step();
    expect(hasLiveCore(sim, ship)).toBe(true);
    const events: string[] = [];
    for (let i = 0; i < 60; i++) {
      sim.step();
      events.push(...sim.events.drain().map((e) => e.type));
    }
    expect(sim.world.get(core, CoreRaidC)?.ticks).toBeGreaterThan(0);
    expect(sim.world.has(core, ModuleC)).toBe(true);
    for (let i = 60; i < CORE_RAID_HOLD_TICKS + 40; i++) {
      sim.step();
      events.push(...sim.events.drain().map((e) => e.type));
    }
    expect(sim.world.has(core, ModuleC)).toBe(false);
    expect(hasLiveCore(sim, ship)).toBe(false);
    expect(events).toContain('core.torn');
  }, 120000);

  it('walks to the core room when it is sent aboard, and falls back to the usual boarding objective on a ship with no core', () => {
    const { sim, core, raider, ship } = raidSetup();
    const m = sim.world.get(core, ModuleC)!;
    const pos = sim.world.get(raider, PositionC)!;
    pos.x = pos.toX = 3;
    pos.y = pos.toY = 3;
    expect(coreObjective(sim, ship, pos)).toMatchObject({ x: m.x, y: m.y });
    // The same walk on a ship with no AI core has no core objective.
    sim.world.destroyEntity(core);
    expect(coreObjective(sim, ship, pos)).toBeNull();
  });

  it('counts nothing while the raiders are away from the core', () => {
    const { sim, core, raider } = raidSetup();
    const pos = sim.world.get(raider, PositionC)!;
    pos.x = pos.toX = pos.x + 12;
    pos.y = pos.toY = pos.y + 1;
    for (let i = 0; i < 40; i++) sim.step();
    expect(sim.world.get(core, CoreRaidC)).toBeUndefined();
  });
});
