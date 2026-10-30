import { StunC, AboardC, AllegianceC, CrewC, DeadC, ModuleC, PositionC, ShipC, VehicleC, WeaponC, homeShip, type Sim, type Command } from '../sim';
import { shipIdOf } from '../sim/regions';

/**
 * `?scenario=boarding` (after the fight scenario has spawned its raider): disarm the raider, fly three of your crew over in a shuttle,
 * dock, step them out, draft them and order them to wreck the raider's reactor. Debug only; it reads the sim and enqueues commands.
 * `&manual` leaves the sabotage order for the player (right-click the module). Add `&aim` to point every weapon at the reactor room as well (the friendly-fire warning).
 */
export function startBoardingScenario(sim: Sim, send: (c: Command) => void, aim: boolean, spawn: () => void): void {
  let step = 0;
  let idle = 0;
  let party: number[] = [];
  const mods = (ship: number, def: string): number[] => sim.world.query(ModuleC).filter((i) => {
    const m = sim.world.get(i, ModuleC);
    return !!m && m.def === def && shipIdOf(sim, m) === ship;
  });
  const timer = setInterval(() => {
    const home = homeShip(sim);
    const foe = sim.world.query(ShipC).find((i) => i !== home && sim.world.get(i, ShipC)?.faction === 'hostile');
    const shuttle = sim.world.query(VehicleC)[0];

    // The fight scenario's own spawn can miss a deploy race: spawn a raider once the ship is placed and none came.
    if (!foe && sim.sector.state === 'active' && idle++ % 12 === 11) spawn();
    if (!foe || shuttle === undefined) return;
    const v = sim.world.get(shuttle, VehicleC)!;
    if (step === 0) {
      // The raider's crew sleep through it (a debug scene: it keeps the party alive for the screenshots).
      for (const c of sim.world.query(CrewC)) if (sim.world.get(c, AllegianceC)?.faction === 'hostile') sim.world.add(c, StunC, { until: 1e9 });
      const crew = sim.world.query(CrewC).filter((c) => !sim.world.has(c, DeadC) && sim.world.get(c, AllegianceC)?.faction === 'player').slice(0, 3);
      for (const c of crew) send({ type: 'vehicle.embark', crew: c, vehicle: shuttle });
      step = 1;
    } else if (step === 1 && v.pilot !== 0 && v.passengers.length === 2) {
      party = [...v.passengers];
      const lock = mods(foe, 'module.airlock')[0];
      if (lock !== undefined) send({ type: 'vehicle.dock', vehicle: shuttle, airlock: lock });
      step = 2;
    } else if (step === 2 && v.state === 'docked') {
      send({ type: 'vehicle.disembark', vehicle: shuttle });
      step = 3;
    } else if (step === 3 && party.every((c) => !sim.world.has(c, AboardC) && sim.world.has(c, PositionC))) {
      const reactor = mods(foe, 'module.reactor')[0];
      for (const w of sim.world.query(WeaponC)) if (shipIdOf(sim, sim.world.get(w, ModuleC)!) === foe) send({ type: 'debug.setModuleHp', id: w, hp: 0 });
      for (const c of party) send({ type: 'crew.draft', id: c, drafted: true });
      if (aim && reactor !== undefined) {
        for (const w of sim.world.query(WeaponC)) if (shipIdOf(sim, sim.world.get(w, ModuleC)!) === home) send({ type: 'combat.setTarget', ship: home, weaponId: w, targetShip: foe, targetModuleId: reactor });
      }
      step = 4;
    } else if (step === 4) {
      const reactor = mods(foe, 'module.reactor')[0];
      if (reactor !== undefined && !location.search.includes('manual')) send({ type: 'crew.sabotage', ids: party, module: reactor });
      clearInterval(timer);
    }
  }, 300);
}
