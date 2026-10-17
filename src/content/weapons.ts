import type { WeaponDef } from '../sim';

/**
 * Weapons. Speeds are sector tiles per second (a typical fight is 40 to 100 tiles apart), spread is aim
 * error sigma in tiles, charge is seconds at gunnery 0. Power draw lives on the module that carries them.
 */
export const weapons = {
  // Three light shots: each strips one shield layer, or chips hull and modules when there are none.
  'weapon.burstLaser': {
    name: 'Burst laser', projectileAsset: 'fx.laser_bolt', shots: 3, shotDelaySec: 0.3, chargeSec: 8, speed: 30, spread: 1,
    shield: { damage: 1, pierce: 0 },
    effects: [{ type: 'hullDamage', amount: 14 }, { type: 'moduleDamage', amount: 8 }, { type: 'crewDamage', amount: 6 }],
  },
  // One slug that passes a single shield layer and punches through the wall (breach).
  'weapon.massDriver': {
    name: 'Mass driver', projectileAsset: 'fx.mass_slug', shots: 1, shotDelaySec: 0, chargeSec: 12, speed: 18, spread: 0.8,
    shield: { damage: 1, pierce: 1 },
    effects: [
      { type: 'hullDamage', amount: 300, radius: 1, falloff: 0.7 },
      { type: 'moduleDamage', amount: 35 }, { type: 'crewDamage', amount: 25 },
    ],
  },
  // Ignores shields, uses crafted ammo, slow enough for point defence to catch.
  'weapon.missile': {
    name: 'Missile', projectileAsset: 'fx.missile', shots: 1, shotDelaySec: 0, chargeSec: 10, speed: 12, spread: 0.6,
    ammo: 'item.missile', interceptable: true, shield: { damage: 0, pierce: 0, bypass: true },
    effects: [
      { type: 'hullDamage', amount: 90, radius: 1, falloff: 0.5 },
      { type: 'moduleDamage', amount: 40 }, { type: 'crewDamage', amount: 20 },
    ],
  },
  // Drains a shield layer; with none up it disables the module it hits for 10 s.
  'weapon.ion': {
    name: 'Ion cannon', projectileAsset: 'fx.ion_bolt', shots: 1, shotDelaySec: 0, chargeSec: 9, speed: 25, spread: 1,
    shield: { damage: 0, pierce: 0, bypass: true },
    effects: [{ type: 'shieldDrain', layers: 1 }, { type: 'ionDisable', seconds: 10, ifNoDrain: true }, { type: 'moduleDamage', amount: 4 }],
  },
  // Little damage, but sets the impact tile and its neighbours on fire.
  'weapon.incendiary': {
    name: 'Incendiary', projectileAsset: 'fx.fire_shell', shots: 1, shotDelaySec: 0, chargeSec: 10, speed: 15, spread: 1.2,
    shield: { damage: 1, pierce: 0 },
    effects: [{ type: 'hullDamage', amount: 6 }, { type: 'moduleDamage', amount: 6 }, { type: 'ignite', radius: 1 }],
  },
} satisfies Record<string, WeaponDef>;
