<script lang="ts">
  import Icon from '../Icon.svelte';
  import { anchor } from '../lessons/anchors';
  import { Chip, chipTone, Frame, FrameGap, Meter, Pips } from '../kit';
  import type { UiApi, UiShipCombat } from '../api';
  import UpgradeTip from './UpgradeTip.svelte';
  import { enemyWeaponRow } from './enemyWeapons';
  import HeatBar, { heatTone } from './HeatBar.svelte';
  import { cardName } from './enemyName';

  /**
   * Compact enemy card, top left: everything on it is live from the combat snapshot. One thin red frame, the name set into its top border.
   */
  let { api, enemy, state: pill, onFrame }: {
    api: UiApi;
    enemy: UiShipCombat;
    state: { text: string; tone: string };
    onFrame: () => void;
  } = $props();
  const hull = $derived(Math.round(enemy.integrity * 100));
  const heatPct = $derived(Math.round((enemy.heat.value / enemy.heat.max) * 100));
  const hot = $derived(((t) => (t === 'cool' ? '' : t))(heatTone(enemy.heat.value / enemy.heat.max)));
  const sub = $derived(
    [enemy.faction, enemy.klass].filter((x): x is string => !!x && x.toLowerCase() !== pill.text.toLowerCase()).join(' · '),
  );
  /** Not at war with you (neutral or friendly): the plain frame and dim subtitle, not the red hostile ones. */
  const calm = $derived(!!enemy.neutral || !!enemy.friendly);
  const title = $derived(cardName(enemy.name, enemy.faction, enemy.klass));
  const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
  const tone = $derived(chipTone(pill.tone));
</script>

<Frame
  {title}
  tone={calm ? 'normal' : 'hostile'}
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
    {#if sub}<span class="fac" class:neutral={calm}>{sub}</span>{/if}
    <div class="stats">
      <span class="lbl">Hull</span>
      <span class="bar" title="Hull integrity. Evasion {Math.round(enemy.evasion * 100)}%: the chance a shot misses">
        <Meter value={hull} max={100} tone="auto" height={10} edge="var(--line-hi)" blink={hull < 30} />
      </span>
      <b>{hull}%</b>
      <span class="lbl">Shields</span>
      <span class="bar" title="Shield layers {enemy.shield.layers}/{enemy.shield.max}">
        <Pips total={enemy.shield.max} on={enemy.shield.layers} height={10} gap={4} fill empty="no shields" emptyCaps />
      </span>
      <b>{enemy.shield.layers}/{enemy.shield.max}</b>
      <span class="lbl">Heat</span>
      <span class="bar" title="Heat"><HeatBar value={enemy.heat.value} max={enemy.heat.max} height={10} edge="var(--line-hi)" label="Enemy heat" /></span>
      <b class={hot}>{heatPct}%</b>
    </div>

    {#if enemy.charges && enemy.charges.length > 0}
      <div class="wl" data-testid="enemy-charges">
        {#each enemy.charges as w (w.id)}
          {@const row = enemyWeaponRow(w)}
          {@const shot = row.shotColor ? hex(w.color) : null}
          <div class="w" class:aim={row.shotColor} class:off={row.dim} style:--c={shot} title="{w.name}: {Math.round(w.charge * 100)}%">
            <span class="nm"><span class="t">{w.name}</span>{#if w.upgrade}<UpgradeTip {api} upgrade={w.upgrade} size={13} testid="enemy-upgrade" />{/if}</span>
            {#if w.eta !== null}
              <span class="eta">{w.eta.toFixed(1)}<small> s</small></span>
            {:else}
              <span class="st">{row.status}</span>
            {/if}
            <i style:width="{Math.round(w.charge * 100)}%"></i>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</Frame>

<style>
  .body {
    display: grid;
    gap: 10px;
  }
  .fr {
    min-height: 0;
    min-width: 0;
    width: 22px;
    height: 22px;
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
  /* The same shape as the player's STATUS block: label, bar, value. */
  .stats {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr) 34px;
    align-items: center;
    gap: 7px var(--sp-2);
  }
  .lbl {
    font: 600 12px var(--head-font);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dim);
  }
  .bar { display: block; min-width: 0; }
  .stats b {
    font: 600 14px var(--head-font);
    color: var(--text);
    text-align: right;
  }
  .stats b.amber { color: var(--amber); }
  .stats b.red { color: var(--red); }
  /* Weapons: a slim panel each. A committed shot takes its colour (the line in the world and the marker on the timeline): a left accent and the countdown. */
  .wl {
    display: grid;
    gap: 4px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }
  .w {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    height: 30px;
    padding: 0 8px 0 10px;
    background: var(--panel-2);
    overflow: hidden;
  }
  .w.aim { box-shadow: inset 3px 0 0 var(--c); }
  .w i {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 2px;
    background: var(--hud-bar);
  }
  .w.aim i { background: var(--c); }
  .nm {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    font: 600 14px/1 var(--head-font);
    letter-spacing: 0.03em;
    white-space: nowrap;
    color: var(--dim);
  }
  .nm .t { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .aim .nm { color: var(--text); }
  .eta {
    flex: none;
    font: 700 20px/1 var(--head-font);
    color: var(--c);
  }
  .eta small { font-size: 13px; }
  .st {
    flex: none;
    font: 600 11px/1 var(--head-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--dim);
  }
  .aim .st { color: var(--c); }
  .off { opacity: 0.4; }
</style>
