import type { Effect, ItemDef, RecipeDef, ResearchDef } from '../sim';
import { weapons } from './weapons';

/**
 * The behaviour upgrades (DESIGN.md "Weapon upgrades and flak", first batch): each fits one weapon type and changes how it fires, at a cost. They are
 * data over general weapon fields (`UpgradeMods.weapon` patches the fitted weapon's def; nothing in the sim names an upgrade). Numbers are a starting point
 * for tuning. The nuclear warhead is black-market only: no blueprint, no recipe, no research. Icons are placeholders until the item art lands.
 */

/** Scale the damage numbers of an effect list (hull, module, crew), leaving areas and everything else alone. */
const scaled = (effects: readonly Effect[], k: number): Effect[] =>
  effects.map((e) => (e.type === 'hullDamage' || e.type === 'moduleDamage' || e.type === 'crewDamage' ? { ...e, amount: Math.round(e.amount * k * 10) / 10 } : e));

const laser = weapons['weapon.burstLaser'];
const driver = weapons['weapon.massDriver'];
const ion = weapons['weapon.ion'];
const fire = weapons['weapon.incendiary'];

export const behaviourItems = {
  'item.upg_prism': {
    name: 'Prism splitter', tags: ['upgrade'], stackSize: 4, price: 260, tier: 3,
    // Five shots instead of three, each 40% weaker, at +50% heat.
    upgrade: {
      slot: 'weapon', blurb: 'Five shots instead of three, each 40% weaker; +50% heat', fits: ['weapon.burstLaser'],
      mods: { heatMul: 1.5, weapon: { name: 'Prism laser', shortName: 'Prism', shots: 5, shotDelaySec: 0.2, effects: scaled(laser.effects, 0.6), look: { tint: 0xd49cff, trail: 1.5 } } },
    },
    placeholderIcon: { as: 'item.electronics', tint: '#d49cff' },
  },
  'item.upg_focus': {
    name: 'Heavy focus', tags: ['upgrade'], stackSize: 4, price: 280, tier: 3,
    // Two shots, each passing one shield layer, 25% harder (a call: two bolts at the base damage would be a downgrade off-shield), charging 40% slower.
    upgrade: {
      slot: 'weapon', blurb: 'Two heavier shots, each passes one shield layer; slower charge', fits: ['weapon.burstLaser'],
      mods: { chargeMul: 1.4, weapon: { name: 'Lance laser', shortName: 'Lance', shots: 2, shotDelaySec: 0.4, shield: { damage: 1, pierce: 1 }, effects: scaled(laser.effects, 1.25), look: { tint: 0xfff2c0, blast: 1.3 } } },
    },
    placeholderIcon: { as: 'item.electronics', tint: '#fff2c0' },
  },
  'item.upg_frag': {
    name: 'Frag slug', tags: ['upgrade'], stackSize: 4, price: 240, tier: 3,
    // A wider blast with harder module and crew hits; the slug no longer passes a shield layer.
    upgrade: {
      slot: 'weapon', blurb: 'Bigger blast, harder on crew and modules; no longer passes a shield layer', fits: ['weapon.massDriver'],
      mods: {
        weapon: {
          name: 'Frag driver', shortName: 'Frag',
          shield: { damage: 1, pierce: 0 },
          effects: [
            { type: 'hullDamage', amount: 260, radius: 2, falloff: 0.6 },
            { type: 'moduleDamage', amount: 55, radius: 1 }, { type: 'crewDamage', amount: 45, radius: 1 },
          ],
          look: { tint: 0xff9a3c, blast: 1.6 },
        },
      },
    },
    placeholderIcon: { as: 'item.parts', tint: '#ff9a3c' },
  },
  'item.upg_rail': {
    name: 'Rail coil', tags: ['upgrade'], stackSize: 4, price: 340, tier: 3,
    // Passes two shield layers and flies two and a half times faster; runs very hot (2.2x heat).
    upgrade: {
      slot: 'weapon', blurb: 'Passes two shield layers and flies much faster; runs very hot', fits: ['weapon.massDriver'],
      mods: { heatMul: 2.2, weapon: { name: 'Railgun', shortName: 'Rail', speed: driver.speed * 2.5, shield: { damage: 1, pierce: 2 }, look: { tint: 0x9fe8ff, trail: 2 } } },
    },
    placeholderIcon: { as: 'item.electronics', tint: '#9fe8ff' },
  },
  'item.upg_nuke': {
    name: 'Nuclear warhead', tags: ['upgrade', 'contraband'], stackSize: 2, price: 900, tier: 3,
    // A huge blast with fire across it; two missiles spent per shot. Sold only on the black market.
    upgrade: {
      slot: 'weapon', blurb: 'Huge blast with fire across it; uses 2 missiles a shot', fits: ['weapon.missile'],
      mods: {
        heatMul: 1.5,
        weapon: {
          name: 'Nuke launcher', shortName: 'Nuke',
          ammoPerShot: 2,
          effects: [
            { type: 'hullDamage', amount: 260, radius: 3, falloff: 0.5 },
            { type: 'moduleDamage', amount: 150, radius: 2 }, { type: 'crewDamage', amount: 70, radius: 3 }, { type: 'ignite', radius: 3 },
          ],
          look: { tint: 0xc8ff7a, blast: 3 },
        },
      },
    },
    placeholderIcon: { as: 'item.parts', tint: '#c8ff7a' },
  },
  'item.upg_chain': {
    name: 'Chain coil', tags: ['upgrade'], stackSize: 4, price: 300, tier: 3,
    // The ion bolt arcs from the module it hits into the three nearest crew within 4 tiles (not when a shield took the hit); +40% heat.
    upgrade: {
      slot: 'weapon', blurb: 'The ion arcs from the hit module into nearby crew; +40% heat', fits: ['weapon.ion'],
      mods: { heatMul: 1.4, weapon: { name: 'Arc cannon', shortName: 'Arc', effects: [...ion.effects, { type: 'arc', amount: 14, radius: 4, targets: 3, ifNoDrain: true }], look: { tint: 0xb48aff, blast: 1.2 } } },
    },
    placeholderIcon: { as: 'item.electronics', tint: '#b48aff' },
  },
  'item.upg_thermite': {
    name: 'Thermite', tags: ['upgrade'], stackSize: 4, price: 220, tier: 3,
    // Real hull damage on top of the ignite (a wall has 255 integrity: two hits breach it, as well as burning); +50% heat.
    upgrade: {
      slot: 'weapon', blurb: 'Real hull damage on top of the fire, so it breaches as well as burns; more heat', fits: ['weapon.incendiary'],
      mods: {
        heatMul: 1.5,
        weapon: { name: 'Thermite cannon', shortName: 'Thermite', effects: [{ type: 'hullDamage', amount: 200, radius: 1, falloff: 0.4 }, ...fire.effects.filter((e) => e.type !== 'hullDamage')], look: { tint: 0xff2a00, blast: 1.4, trail: 1.8 } },
      },
    },
    placeholderIcon: { as: 'item.parts', tint: '#ff5a1a' },
  },
} satisfies Record<string, ItemDef>;

/** One fabricator recipe per researched upgrade (the nuke has none). */
const recipe = (id: string, name: string, inputs: [number, number, number], work = 420): RecipeDef => ({
  name: `Build ${name}`, station: 'module.fabricator', blueprint: `blueprint.upg_${id}`,
  inputs: [{ item: 'item.metal', count: inputs[0] }, { item: 'item.electronics', count: inputs[1] }, { item: 'item.polymer', count: inputs[2] }],
  outputs: [{ item: `item.upg_${id}`, count: 1 }], work,
});

export const behaviourRecipes = {
  'recipe.upg_prism': recipe('prism', 'prism splitter', [6, 14, 6]),
  'recipe.upg_focus': recipe('focus', 'heavy focus', [10, 12, 4]),
  'recipe.upg_frag': recipe('frag', 'frag slug', [14, 6, 8]),
  'recipe.upg_rail': recipe('rail', 'rail coil', [16, 14, 4]),
  'recipe.upg_chain': recipe('chain', 'chain coil', [6, 16, 6]),
  'recipe.upg_thermite': recipe('thermite', 'thermite', [10, 4, 10]),
} satisfies Record<string, RecipeDef>;

const cost = (e: number, parts: number) => [{ item: 'item.electronics', count: e }, { item: 'item.parts', count: parts }];
const project = (id: string, name: string, description: string, c: ReturnType<typeof cost>): ResearchDef => ({
  name, description, category: 'defence', cost: c, work: 2400, unlocks: [`blueprint.upg_${id}`], requires: [],
});

export const behaviourResearch = {
  'research.upgrade.prism': project('prism', 'Prism splitter', 'A burst laser upgrade: five shots instead of three, each 40% weaker, and the gun runs 50% hotter.', cost(16, 5)),
  'research.upgrade.focus': project('focus', 'Heavy focus', 'A burst laser upgrade: two heavier shots that each pass one shield layer, at a slower charge.', cost(16, 5)),
  'research.upgrade.frag': project('frag', 'Frag slug', 'A mass driver upgrade: a wider blast and harder module and crew hits, but the slug no longer passes a shield layer.', cost(14, 6)),
  'research.upgrade.rail': project('rail', 'Rail coil', 'A mass driver upgrade: the slug passes two shield layers and flies much faster, and the gun runs very hot.', cost(18, 6)),
  'research.upgrade.chain': project('chain', 'Chain coil', 'An ion cannon upgrade: the bolt arcs from the module it hits as lightning into the crew nearby, and the gun runs 40% hotter.', cost(18, 5)),
  'research.upgrade.thermite': project('thermite', 'Thermite', 'An incendiary upgrade: real hull damage on top of the fire, so the shell breaches as well as burns, and the gun runs hotter.', cost(14, 6)),
} satisfies Record<string, ResearchDef>;
