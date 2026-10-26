import { describe, expect, it } from 'vitest';
import { AboardC, AllegianceC, CaptureProgressC, CombatC, CrewC, DeadC, DownedC, DraftedC, EquipC, HealthC, ItemStackC, ModuleC, PathC, PositionC, PrisonerC, PrizeC, ShipC, shipIdAt, SurrenderedC, VehicleC, WeaponC, accessTile, cargoCount, deserialize, newGame, serialize, storageCount, StorageC, type ModuleDef, type Sim, type SimEvent } from '../../sim';
import { content } from '../index';
import { shipIdOf, shipIds } from '../../sim/regions';

/** The ship with ordinal `n` (1 = the player's, 2 = the first enemy). */
const nth = (sim: Sim, n: number): number => shipIds(sim)[n - 1] as number;

const run = (sim: Sim, n: number, stop: () => boolean = () => false): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n && !stop(); i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const of = <T extends SimEvent['type']>(events: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
const defOf = (sim: Sim, id: number): ModuleDef => content.modules[sim.world.get(id, ModuleC)!.def as keyof typeof content.modules] as ModuleDef;
const crewOn = (sim: Sim, shipId: number): number[] => sim.world.query(CrewC).filter((i) => shipIdOf(sim, sim.world.get(i, PositionC)) === nth(sim, shipId));
const modulesOf = (sim: Sim, shipId: number, def: string): number[] =>
  sim.world.query(ModuleC).filter((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === nth(sim, shipId) && sim.world.get(i, ModuleC)!.def === def);
const roleOf = (sim: Sim, id: number): string => sim.world.get(id, CrewC)!.role;
const ship = (sim: Sim, shipId: number) => sim.world.get(nth(sim, shipId), ShipC)!;
const teleport = (sim: Sim, id: number, shipId: number, x: number, y: number): void => {
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
};
/** The tile a helm's operator stands on. */
function helmTile(sim: Sim, shipId: number): { x: number; y: number } {
  const id = modulesOf(sim, shipId, 'module.helm')[0]!;
  const m = sim.world.get(id, ModuleC)!;
  return accessTile(defOf(sim, id), m.x, m.y, m.rot)!;
}
/** Disable every raider weapon so only the capture rules matter, unless `armed`. */
function setup(seed = 1, armed = false): Sim {
  const sim = newGame(seed, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
  run(sim, 5);
  if (!armed) {
    for (const i of sim.world.query(WeaponC)) if (shipIdOf(sim, sim.world.get(i, ModuleC)) === shipIds(sim)[1] as number) sim.world.get(i, ModuleC)!.enabled = false;
  }
  return sim;
}
const arm = (sim: Sim, id: number, weapon = 'item.rifle'): void => {
  sim.world.add(id, EquipC, { weapon });
  sim.world.add(id, DraftedC, { target: null });
};
/** Put the first `n` player crew aboard the raider, rifles drawn, the first one on the helm tile. */
function boardingParty(sim: Sim, n = 2, roles?: string[]): number[] {
  const home = crewOn(sim, 1);
  const party = roles ? roles.map((r) => home.find((c) => roleOf(sim, c) === r)!) : home.slice(0, n);
  const helm = helmTile(sim, 2);
  party.forEach((c, i) => {
    teleport(sim, c, 2, helm.x + (i === 0 ? 0 : 1), helm.y);
    arm(sim, c);
  });
  return party;
}

/** Raider crew all surrendered, party member 0 on the helm: the fast road to a capture. */
function stage(sim: Sim, partySize = 2, roles?: string[]): { party: number[]; raiders: number[] } {
  const party = boardingParty(sim, partySize, roles);
  const raiders = crewOn(sim, 2).filter((c) => !party.includes(c));
  for (const c of raiders) sim.world.add(c, SurrenderedC, { tick: sim.tick });
  return { party, raiders };
}
const capture = (sim: Sim): SimEvent[] => run(sim, 400, () => ship(sim, 2).state === 'prize');
const vehicleOf = (sim: Sim, shipId: number): number => sim.world.query(VehicleC).find((i) => sim.world.get(i, VehicleC)!.homeShip === nth(sim, shipId))!;

describe('capturing a ship', () => {
  it('a boarding party subdues the raider crew and holds the helm: captured', () => {
    const sim = setup();
    const party = boardingParty(sim, 4);
    const raiders = crewOn(sim, 2).filter((c) => !party.includes(c));
    for (const c of raiders) {
      sim.world.get(c, HealthC)!.hp = 8; // wounded: they give up when outnumbered
      teleport(sim, c, 2, helmTile(sim, 2).x - 4, helmTile(sim, 2).y + 3);
    }
    const subdued = (): boolean => raiders.every((c) => sim.world.has(c, SurrenderedC) || sim.world.has(c, DownedC) || sim.world.has(c, DeadC));
    const out = run(sim, 900, subdued);
    expect(subdued()).toBe(true);
    expect(ship(sim, 2).state).toBe('active'); // nobody holds the helm yet
    const helm = helmTile(sim, 2);
    sim.enqueue({ type: 'crew.moveTo', id: party[0]!, x: helm.x, y: helm.y, ship: nth(sim, 2) });
    out.push(...run(sim, 900, () => ship(sim, 2).state === 'prize'));
    expect(of(out, 'ship.captured')).toEqual([{ type: 'ship.captured', ship: nth(sim, 2), by: 'player', from: 'hostile' }]);
    expect(ship(sim, 2)).toMatchObject({ state: 'prize', faction: 'player' });
    for (const c of raiders) expect(sim.world.has(c, DeadC) || sim.world.has(c, PrisonerC)).toBe(true);
    expect(sim.world.get(nth(sim, 2), PrizeC)!.hullValue).toBeGreaterThan(0);
  });

  it('needs the hold time: progress builds, and breaks when the helm is left', () => {
    const sim = setup();
    const { party } = stage(sim);
    run(sim, 20);
    expect(sim.world.get(nth(sim, 2), CaptureProgressC)?.ticks).toBeGreaterThan(0);
    expect(ship(sim, 2).state).toBe('active');
    teleport(sim, party[0]!, 2, 2, 12);
    teleport(sim, party[1]!, 2, 2, 12);
    run(sim, 2);
    expect(sim.world.has(nth(sim, 2), CaptureProgressC)).toBe(false);
  });

  it('is not captured while an armed enemy is still up', () => {
    const sim = setup();
    // Two fighters who cannot subdue the last raider within the run (a gunner would take it prisoner at once).
    const { party, raiders } = stage(sim, 2, ['role.engineer', 'role.pilot']);
    for (const c of party) sim.world.get(c, HealthC)!.max = sim.world.get(c, HealthC)!.hp = 100000;
    const last = raiders[raiders.length - 1]!;
    sim.world.remove(last, SurrenderedC);
    run(sim, 200);
    expect(ship(sim, 2).state).toBe('active');
    expect(ship(sim, 2).faction).toBe('hostile');
  });

  it('is not captured without bridge control', () => {
    const sim = setup();
    const { party } = stage(sim);
    for (const c of party) teleport(sim, c, 2, 3, 12);
    const out = run(sim, 300);
    expect(ship(sim, 2).state).toBe('active');
    expect(of(out, 'ship.captured')).toHaveLength(0);
  });

  it('weapons and AI go inert after capture and combat ends', () => {
    const sim = setup(1, true);
    const { party } = stage(sim);
    for (const c of party) sim.world.get(c, HealthC)!.max = sim.world.get(c, HealthC)!.hp = 100000;
    run(sim, 3);
    expect(sim.sector.inCombat).toBe(true);
    const out = capture(sim);
    out.push(...run(sim, 600));
    expect(of(out, 'combat.ended')).toHaveLength(1);
    expect(sim.sector.inCombat).toBe(false);
    const after = run(sim, 600);
    expect(of(after, 'weapon.fired').filter((e) => e.ship === nth(sim, 2))).toHaveLength(0);
    for (const i of sim.world.query(WeaponC)) {
      if (shipIdOf(sim, sim.world.get(i, ModuleC)) === shipIds(sim)[1] as number) expect(sim.world.get(i, WeaponC)).toMatchObject({ charge: 0, shotsLeft: 0 });
    }
    expect(sim.world.get(nth(sim, 2), CombatC)!.target).toBeNull();
    expect(ship(sim, 2).state).toBe('prize');
  });

  it('keeps prisoners where they are, subdued even if they recover', () => {
    const sim = setup();
    const { party, raiders } = stage(sim);
    const downed = raiders[0]!;
    sim.world.remove(downed, SurrenderedC);
    sim.world.add(downed, DownedC, { bleed: 1000, stabilized: true, bed: 0 });
    sim.world.get(downed, HealthC)!.hp = 0;
    capture(sim);
    const where = raiders.map((c) => JSON.stringify(sim.world.get(c, PositionC)));
    run(sim, 300);
    expect(raiders.map((c) => JSON.stringify(sim.world.get(c, PositionC)))).toEqual(where);
    for (const c of raiders) {
      expect(sim.world.has(c, PrisonerC)).toBe(true);
      expect(sim.world.has(c, SurrenderedC)).toBe(true);
      expect(sim.world.has(c, DraftedC)).toBe(false);
      expect(sim.world.get(c, AllegianceC)?.faction).toBe('hostile');
    }
    for (const c of party) expect(sim.world.has(c, DraftedC)).toBe(false); // back to work
    sim.world.remove(downed, DownedC); // recovers
    expect(sim.world.has(downed, SurrenderedC)).toBe(true);
  });

  it('scuttling a prize turns it into a wreck, once nobody of ours is aboard', () => {
    const sim = setup();
    const { party } = stage(sim);
    sim.enqueue({ type: 'ship.scuttle', ship: nth(sim, 1) });
    expect(of(run(sim, 1), 'command.rejected')[0]).toMatchObject({ command: 'ship.scuttle', reason: 'notPrize' });
    capture(sim);
    sim.enqueue({ type: 'ship.scuttle', ship: nth(sim, 2) });
    expect(of(run(sim, 1), 'command.rejected')[0]).toMatchObject({ reason: 'crewAboard' });
    for (const c of party) teleport(sim, c, 1, 5, 5);
    sim.enqueue({ type: 'ship.scuttle', ship: nth(sim, 2) });
    const out = run(sim, 2);
    expect(of(out, 'ship.destroyed')).toEqual([{ type: 'ship.destroyed', ship: nth(sim, 2) }]);
    expect(ship(sim, 2).state).toBe('wreck');
    expect(sim.world.has(nth(sim, 2), PrizeC)).toBe(false);
    expect(crewOn(sim, 2).every((c) => sim.world.has(c, DeadC))).toBe(true);
  });
});

describe('losing to boarders', () => {
  it('ends the game when every player crew member is subdued and the raiders hold the helm', () => {
    const sim = setup();
    const helm = helmTile(sim, 1);
    const raiders = crewOn(sim, 2);
    raiders.forEach((c, i) => teleport(sim, c, 1, helm.x - i, helm.y));
    const player = crewOn(sim, 1).filter((c) => !raiders.includes(c));
    for (const c of player.slice(1)) sim.world.add(c, SurrenderedC, { tick: sim.tick });
    expect(run(sim, 150).some((e) => e.type === 'game.lost')).toBe(false); // one defender still stands
    sim.world.add(player[0]!, SurrenderedC, { tick: sim.tick });
    const out = run(sim, 400, () => !!sim.sector.lost);
    expect(of(out, 'game.lost')).toEqual([{ type: 'game.lost', reason: 'captured' }]);
    expect(sim.sector.lost).toBe('captured');
    expect(run(sim, 100).filter((e) => e.type === 'game.lost')).toHaveLength(0);
  });
});

describe('salvage and cargo', () => {
  it('deconstructs a module on the prize and ships the items home in the shuttle hold', () => {
    const sim = setup();
    const { party } = stage(sim);
    capture(sim);
    const metal = (): number => sim.world.query(StorageC).filter((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === shipIds(sim)[0] as number)
      .reduce((n, i) => n + storageCount(sim, i, 'item.metal'), 0);
    const target = modulesOf(sim, 2, 'module.burstLaser')[0]!;
    const tm = sim.world.get(target, ModuleC)!;
    const shuttle = vehicleOf(sim, 1);
    const pilot = crewOn(sim, 1).find((c) => roleOf(sim, c) === 'role.pilot')!;
    sim.enqueue({ type: 'vehicle.embark', crew: pilot, vehicle: shuttle });
    run(sim, 400, () => sim.world.has(pilot, AboardC));
    const airlock = modulesOf(sim, 2, 'module.airlock')[0]!;
    sim.enqueue({ type: 'vehicle.dock', vehicle: shuttle, airlock });
    run(sim, 1200, () => sim.world.get(shuttle, VehicleC)!.state === 'docked');
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('docked');
    const before = metal();
    sim.enqueue({ type: 'job.deconstructModule', ship: nth(sim, 2), x: tm.x, y: tm.y });
    run(sim, 3000, () => cargoCount(sim.world.get(shuttle, VehicleC)!) > 0 && !sim.world.query(ItemStackC).some((i) => shipIdAt(sim, sim.world.get(i, ItemStackC)!.x, sim.world.get(i, ItemStackC)!.y) === 2));
    expect(sim.world.has(target, ModuleC)).toBe(false);
    const hold = sim.world.get(shuttle, VehicleC)!.cargo;
    expect(cargoCount(sim.world.get(shuttle, VehicleC)!)).toBeGreaterThan(0);
    expect(hold.some((q) => q.item === 'item.metal')).toBe(true);
    expect(party.every((c) => sim.world.has(c, PositionC))).toBe(true);
    // Fly home; the crew on the starter unload the hold into storage.
    sim.enqueue({ type: 'vehicle.return', vehicle: shuttle });
    run(sim, 3000, () => sim.world.get(shuttle, VehicleC)!.state === 'stowed' && cargoCount(sim.world.get(shuttle, VehicleC)!) === 0);
    run(sim, 600);
    expect(cargoCount(sim.world.get(shuttle, VehicleC)!)).toBe(0);
    expect(metal()).toBeGreaterThan(before);
  });
});

describe('determinism and saves', () => {
  it('replays the same capture and survives a save mid-hold and after', () => {
    const play = (): Sim => {
      const sim = setup(7);
      stage(sim);
      run(sim, 20);
      return sim;
    };
    const a = play();
    const b = play();
    expect(serialize(a)).toBe(serialize(b));
    expect(a.world.has(shipIds(a)[1]!, CaptureProgressC)).toBe(true);
    const c = deserialize(serialize(a), content); // mid-hold
    run(a, 200);
    run(c, 200);
    expect(ship(a, 2).state).toBe('prize');
    expect(serialize(c)).toBe(serialize(a));
    const d = deserialize(serialize(a), content); // after capture
    run(a, 200);
    run(d, 200);
    expect(serialize(d)).toBe(serialize(a));
    expect(d.world.get(shipIds(d)[1]!, PrizeC)).toEqual(a.world.get(shipIds(a)[1]!, PrizeC));
  });
});
