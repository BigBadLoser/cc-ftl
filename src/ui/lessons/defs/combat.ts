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
  speaker: 'speaker.vash',
  trigger: anyOf(onEvent('combat.started'), when(fighting)),
  // The camera frames the enemy and its art loads first.
  delay: 1500,
  while: when(fighting),
  steps: [
    {
      title: 'Pick a weapon',
      say: 'Guns are yours.',
      keys: ['[@combat.weapon1] or click a card to select a weapon.'],
      target: uiTarget('combat.weapons'),
      advance: when((ctx) => ctx.aiming?.weapon != null),
    },
    {
      title: 'Aim',
      say: "Light 'em up. Guns or shields first.",
      keys: ['Click an enemy module to aim.'],
      target: moduleTarget(enemyModule),
      advance: onCommand('combat.setTarget', (c, ctx) => c.ship === ctx.combat.player?.ship && (c.weaponId !== null || c.targetModuleId > 0 || !!c.targetTile)),
    },
    {
      title: 'The enemy',
      say: "Know what's coming.",
      keys: ['**Hull**, **shields**, and a **charge bar** per gun.', 'A full bar fires.'],
      target: uiTarget('combat.enemy'),
      advance: 'gotIt',
    },
    {
      title: 'Firing modes',
      say: "Go easy on the missiles. We don't have many.",
      keys: ["**AUTO** fires whenever it's charged.", '**HOLD** waits for an aim or a [@combat.volley] volley.', '[@combat.mode1] or right-click switches a gun.', '[@combat.holdAll] holds them all.', 'Missiles start on **HOLD**.'],
      target: uiTarget('combat.weapons'),
      advance: 'gotIt',
    },
    {
      title: 'Heat',
      say: "Run her too hot and we're a sitting duck.",
      keys: ['Each shot adds heat; it only cools while shields are down.', '**100%** heat locks the ship.', '[@combat.vent] **Vent**: cools fast, but shields drop.'],
      target: uiTarget('combat.heat'),
      advance: 'gotIt',
    },
    {
      title: 'Shields and evasion',
      say: "Keep me at the helm and I'll dodge a few.",
      keys: ['Each **shield** layer blocks one shot, then recharges.', '**Evasion** needs a pilot at the helm and a powered engine.'],
      target: uiTarget('combat.status'),
      advance: 'gotIt',
    },
    {
      title: 'Flee',
      say: 'Bad fight? We leave.',
      keys: ['The pilot charges the drive.', "When it's full, [@combat.flee] jumps out."],
      target: uiTarget('combat.flee'),
      advance: 'gotIt',
    },
  ],
} satisfies LessonDef;
