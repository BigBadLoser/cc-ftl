<script lang="ts">
  import Icon from '../Icon.svelte';
  import { anchor } from '../lessons/anchors';
  import { ActionButton, Chip, chipTone, Frame, FrameGap, KeyBadge, Meter, Pips } from '../kit';
  import { keyLabel, keymap } from '../keymap';
  import type { UiShipCombat } from '../api';
  import { enemyWeaponRow } from './enemyWeapons';
  import HeatBar, { heatTone } from './HeatBar.svelte';
  import { cardName } from './enemyName';

  /**
   * Compact enemy card, top left: everything on it is live from the combat snapshot. One thin red frame, the name set into its top border.
   */
  let { enemy, state: pill, onFrame, onBoard, boardBlocker }: {
    enemy: UiShipCombat;
    state: { text: string; tone: string };
    onFrame: () => void;
    onBoard: () => void;
    /** Why Board is disabled (null = it opens the party picker). */
    boardBlocker: string | null;
  } = $props();
  const hull = $derived(Math.round(enemy.integrity * 100));
  const heatPct = $derived(Math.round((enemy.heat.value / enemy.heat.max) * 100));
  const hot = $derived(((t) => (t === 'cool' ? '' : t))(heatTone(enemy.heat.value / enemy.heat.max)));
  const sub = $derived(
    [enemy.faction, enemy.klass].filter((x): x is string => !!x && x.toLowerCase() !== pill.text.toLowerCase()).join(' · '),
  );
  const title = $derived(cardName(enemy.name, enemy.faction, enemy.klass));
  const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
  const tone = $derived(chipTone(pill.tone));
</script>

<Frame
  {title}
  tone={enemy.neutral ? 'normal' : 'hostile'}
  style="width:320px; pointer-events:auto; background: var(--panel)"
  testid="enemy-card"
  lesson={anchor('combat.enemy')}
>
  {#snippet right()}
    <Chip plate {tone}>{pill.text}</Chip>
    <FrameGap width={14} />
    <button class="fr" title="Frame both ships" aria-label="Frame both ships" onclick={onFrame}><Icon name="frame" size={15} /></button>
  {/snippet}
  <div class="body">
    {#if sub}<span class="fac" class:neutral={enemy.neutral}>{sub}</span>{/if}
    <div class="def">
      <div class="srow">
        <Pips
          total={enemy.shield.max}
          on={enemy.shield.layers}
          width={26}
          height={7}
          gap={2}
          empty="no shields"
          emptyCaps
          title="Shield layers {enemy.shield.layers}/{enemy.shield.max}"
        />
        <span class="chip" title="Chance a shot misses">Evade <b>{Math.round(enemy.evasion * 100)}%</b></span>
      </div>
      <Meter
        value={hull}
        max={100}
        tone="auto"
        height={20}
        edge="var(--hostile-track)"
        label="{hull}%"
        blink={hull < 30}
        title="Hull integrity"
      />
      <div class="hrow" title="Heat">
        <span class="grow"><HeatBar value={enemy.heat.value} max={enemy.heat.max} height={8} edge="var(--hostile-track)" label="Enemy heat" /></span>
        <span class="hp {hot}">Heat {heatPct}%</span>
      </div>
    </div>

    {#if enemy.charges && enemy.charges.length > 0}
      <div class="wl" data-testid="enemy-charges">
        {#each enemy.charges as w (w.id)}
          {@const row = enemyWeaponRow(w)}
          {@const shot = row.shotColor ? hex(w.color) : null}
          <div class="w" class:aim={row.shotColor} class:off={row.dim} style:--c={shot} title="{w.name}: {Math.round(w.charge * 100)}%">
            <span class="nm">{w.name}</span>
            <span class="shotbar" style:border-color={shot ?? 'var(--hostile-track)'}>
              <i style:width="{Math.round(w.charge * 100)}%" style:background={shot ?? 'var(--hud-bar)'}></i>
              <u style:left="{Math.round(w.commitAt * 100)}%"></u>
            </span>
            <span class="st">{row.status}</span>
          </div>
        {/each}
      </div>
    {/if}
    <div class="board">
      <ActionButton tone="plain" disabled={!!boardBlocker} title={boardBlocker ?? `Send a boarding party in a shuttle (${keyLabel($keymap, 'combat.board')})`} testid="combat-board" onclick={onBoard}>
        <Icon name="shuttle" size={16} />Board<KeyBadge tone="dim" size="sm" padX={5}>{keyLabel($keymap, 'combat.board')}</KeyBadge>
      </ActionButton>
      {#if boardBlocker}<span class="why" data-testid="board-blocker">{boardBlocker}</span>{/if}
    </div>
  </div>
</Frame>

<style>
  .body {
    display: grid;
    gap: 10px;
  }
  .board { display: flex; align-items: center; gap: var(--sp-2); height: 28px; }
  .board :global(.btn) { width: 120px; }
  .why { font: 600 11px/1 var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); }
  .fr {
    min-height: 0;
    min-width: 0;
    width: 22px;
    height: 21px;
    padding: 0;
    display: grid;
    place-items: center;
    background: var(--panel);
    border: 1px solid var(--edge);
    border-radius: 0;
    margin: 0 4px;
    color: var(--edge);
  }
  .fac {
    margin: 2px 0 -4px;
    font: 600 11px/1 var(--head-font);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--hostile-dim);
  }
  .fac.neutral { color: var(--dim); }
  .def {
    display: grid;
    gap: 3px;
  }
  .srow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 20px;
  }
  .chip {
    font: 600 11px/1 var(--head-font);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dim);
    padding: 2px 5px;
    border: 1px solid var(--line);
  }
  .chip b {
    color: var(--text);
    font-weight: 700;
  }
  .hrow {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-top: 3px;
  }
  .grow {
    flex: 1;
    display: block;
  }
  .hp {
    font: 600 11px/1 var(--head-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--dim);
    min-width: 62px;
    text-align: right;
  }
  .hp.amber { color: var(--amber); }
  .hp.red { color: var(--red); }
  /* Weapons: name, charge bar, status. A committed shot takes its colour: the same as its line in the world and its timeline marker. */
  .wl {
    display: grid;
    gap: 5px;
  }
  .w {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr) 68px;
    gap: var(--sp-2);
    align-items: center;
    height: 16px;
  }
  /* A weapon's charge in the colour of its shot (the line in the world and the marker on the timeline), so tones can't carry it. */
  .shotbar { position: relative; display: block; height: 8px; box-sizing: border-box; border: 1px solid var(--hostile-track); background: var(--track); }
  .shotbar i { display: block; height: 100%; }
  .shotbar u { position: absolute; top: -2px; bottom: -2px; width: 1px; background: var(--dim); }
  .nm {
    font: 600 13px/1 var(--head-font);
    letter-spacing: 0.03em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text);
  }
  .st {
    font: 600 11px/1 var(--head-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: right;
    white-space: nowrap;
    color: var(--dim);
  }
  .aim .nm,
  .aim .st {
    color: var(--c);
  }
  .off {
    opacity: 0.4;
  }
</style>
