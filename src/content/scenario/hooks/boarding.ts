import { AboardC, AllegianceC, CrewC, DeadC, ModuleC, PositionC, ShipC, VehicleC, WeaponC, homeShip, isPlayers } from '../../../sim';
import { shipIdOf } from '../../../sim/regions';
import { defineHook } from '../types';

export interface BoardingArgs { aim?: boolean; menu?: boolean; manual?: boolean }

/**
 * `?scenario=boarding` (after the fight scenario has put its raider beside the ship): disarm the raider, fly three of your crew over in a shuttle, dock, step
 * them out, draft them and order them to wreck the raider's reactor. Debug only; it reads the sim and sends commands, one step every 6 ticks.
 * `&menu` leaves some raider crew awake so right-clicking one shows the order menu (pause first). `&manual` leaves the sabotage order for the player (right-click
 * the module). `&aim` points every weapon at the reactor room as well (the friendly-fire warning).
 */
export default defineHook({
  tick(ctx) {
    const { sim } = ctx;
    if (sim.tick % 6 !== 0 || ctx.state['done']) return;
    const args = (ctx.args ?? {}) as BoardingArgs;
    const spots = [[110, 80], [60, 20], [20, 100], [150, 30], [100, 50], [40, 90], [130, 110]] as const;
    const st = ctx.state as { step?: number; tries?: number; idle?: number; party?: number[] };
    st.step ??= 0; st.tries ??= 0; st.idle ??= 0;
    const mods = (ship: number, def: string): number[] => sim.world.query(ModuleC).filter((i) => {
      const m = sim.world.get(i, ModuleC);
      return !!m && m.def === def && shipIdOf(sim, m) === ship;
    });
    const home = homeShip(sim);
    const foe = sim.world.query(ShipC).find((i) => i !== home && sim.world.get(i, ShipC)?.faction === 'hostile');
    const shuttle = sim.world.query(VehicleC)[0];
    // The fight scenario's own spawn can miss a deploy race: try the raider at a few fixed spots once the ship is placed and none came.
    if (!foe && sim.sector.state === 'active' && st.idle++ % 6 === 5) {
      const at = spots[st.tries++ % spots.length]!;
      ctx.dispatch({ type: 'debug.spawnEnemy', template: 'ship.raider', x: at[0], y: at[1] });
    }
    if (!foe || shuttle === undefined) return;
    const v = sim.world.get(shuttle, VehicleC)!;
    if (st.step === 0) {
      // The raider's crew sleep through it (a debug scene: it keeps the party alive for the screenshots).
      for (const c of sim.world.query(CrewC)) if (sim.world.get(c, AllegianceC)?.faction === 'hostile' && !(args.menu && c % 2 === 0)) ctx.dispatch({ type: 'debug.setCrew', id: c, stun: 1e9 });
      const crew = sim.world.query(CrewC).filter((c) => !sim.world.has(c, DeadC) && isPlayers(sim, c)).slice(0, 3);
      for (const c of crew) ctx.dispatch({ type: 'vehicle.embark', crew: c, vehicle: shuttle });
      st.step = 1;
    } else if (st.step === 1 && v.pilot !== 0 && v.passengers.length === 2) {
      st.party = [...v.passengers];
      const lock = mods(foe, 'module.airlock')[0];
      if (lock !== undefined) ctx.dispatch({ type: 'vehicle.dock', vehicle: shuttle, airlock: lock });
      st.step = 2;
    } else if (st.step === 2 && v.state === 'docked') {
      ctx.dispatch({ type: 'vehicle.disembark', vehicle: shuttle });
      st.step = 3;
    } else if (st.step === 3 && (st.party ?? []).every((c) => !sim.world.has(c, AboardC) && sim.world.has(c, PositionC))) {
      const reactor = mods(foe, 'module.reactor')[0];
      for (const w of sim.world.query(WeaponC)) if (shipIdOf(sim, sim.world.get(w, ModuleC)!) === foe) ctx.dispatch({ type: 'debug.setModuleHp', id: w, hp: 0 });
      for (const c of st.party ?? []) ctx.dispatch({ type: 'crew.draft', id: c, drafted: true });
      if (args.aim && reactor !== undefined) {
        for (const w of sim.world.query(WeaponC)) if (shipIdOf(sim, sim.world.get(w, ModuleC)!) === home) ctx.dispatch({ type: 'combat.setTarget', ship: home, weaponId: w, targetShip: foe, targetModuleId: reactor });
      }
      st.step = 4;
    } else if (st.step === 4) {
      const reactor = mods(foe, 'module.reactor')[0];
      if (reactor !== undefined && !args.manual) ctx.dispatch({ type: 'crew.sabotage', ids: st.party ?? [], module: reactor });
      ctx.state['done'] = true;
    }
  },
});
