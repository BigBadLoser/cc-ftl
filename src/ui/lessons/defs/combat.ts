import { anyOf, onCommand, onEvent, when } from '../conditions';
import { moduleTarget, uiTarget } from '../targets';
import type { LessonCtx, LessonDef } from '../types';

/** The enemy the combat view shows (the same pick as CombatHud). */
const enemyOf = (ctx: LessonCtx) => ctx.combat.enemies.find((e) => e.state === 'active' || e.state === 'disabled') ?? ctx.combat.enemies[0];
/** An enemy module worth aiming at: a weapon, else shields, else anything still standing. */
const enemyModule = (ctx: LessonCtx): number | null => {
  const mods = enemyOf(ctx)?.modules.filter((m) => m.hp > 0) ?? [];
  return (mods.find((m) => m.kind === 'weapon') ?? mods.find((m) => m.kind === 'shield') ?? mods[0])?.id ?? null;
};
const fighting = (ctx: LessonCtx) => ctx.combat.inCombat && !!ctx.combat.player && !!enemyOf(ctx);

/** The first fight: the combat strip, from picking a weapon to fleeing. */
export const combatLesson = {
  id: 'lesson.combat',
  title: 'Combat',
  trigger: anyOf(onEvent('combat.started'), when(fighting)),
  while: when(fighting),
  steps: [
    {
      title: 'Pick a weapon',
      text: 'Press [Q] or click a weapon card.',
      target: uiTarget('combat.weapons'),
      advance: when((ctx) => ctx.aiming?.weapon != null),
    },
    {
      title: 'Aim',
      text: 'Click an enemy module to aim at it. Weapons and shields are good first targets.',
      target: moduleTarget(enemyModule),
      advance: onCommand('combat.setTarget', (c, ctx) => c.ship === ctx.combat.player?.ship && (c.weaponId !== null || c.targetModuleId > 0 || !!c.targetTile)),
    },
    {
      title: 'Auto and hold',
      text: 'AUTO fires when charged. HOLD waits for a volley [V] or an aim. [Shift]+[Q] or a right-click flips a weapon; [H] holds them all. Missile weapons start on HOLD.',
      target: uiTarget('combat.weapons'),
      advance: 'gotIt',
    },
    {
      title: 'Heat',
      text: 'Shots and shield hits add heat, and it only falls while shields are down. At 100% the ship locks up. [G] vents: heat drops fast, but shields go down and weapons hold.',
      target: uiTarget('combat.heat'),
      advance: 'gotIt',
    },
    {
      title: 'Shields and evasion',
      text: 'Shields stop shots one layer at a time, then recharge. Evasion is the chance a shot misses; it needs a pilot at the helm.',
      target: uiTarget('combat.status'),
      advance: 'gotIt',
    },
    {
      title: 'Flee',
      text: 'The pilot charges the drive. When it is full, [F] jumps out of the fight.',
      target: uiTarget('combat.flee'),
      advance: 'gotIt',
    },
  ],
} satisfies LessonDef;
