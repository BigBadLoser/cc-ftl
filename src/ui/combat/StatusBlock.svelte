<script lang="ts">
  import { Frame, Meter, Pips } from '../kit';
  import { anchor } from '../lessons/anchors';
  import type { UiCombat } from '../api';
  import { hullTone } from './hullTone';

  type Me = NonNullable<UiCombat['player']>;
  /** The player's STATUS frame: hull (bar and %), shield layers (pips and n/max) and evasion. */
  let { me, style = '' }: { me: Me; style?: string } = $props();
  const hull = $derived(Math.round(me.integrity * 100));
  const HULL_FILL = { green: 'var(--health-good)', amber: 'var(--health-warn)', red: 'var(--health-bad)' } as const;
</script>

<Frame title="Status" {style} lesson={anchor('combat.status')}>
  <div class="rows">
    <div class="line" title="Hull integrity">
      <span class="lbl">Hull</span>
      <span class="grow">
        <Meter value={hull / 100} fill={HULL_FILL[hullTone(hull)]} height={12} />
      </span>
      <b>{hull}%</b>
    </div>
    <div class="line" title="Shield layers">
      <span class="lbl">Shields</span>
      <span class="grow"><Pips total={me.shield.max} on={me.shield.layers} height={12} fill /></span>
      <b>{me.shield.layers}/{me.shield.max}</b>
    </div>
    <div class="line" title="Chance an incoming shot misses">
      <span class="lbl">Evasion</span>
      <b>{Math.round(me.evasion * 100)}%</b>
    </div>
  </div>
</Frame>

<style>
  .rows {
    flex: 1;
    display: grid;
    align-content: space-between;
  }
  .line {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    color: var(--hud-ok, var(--cyan));
    height: 20px;
  }
  .grow {
    flex: 1;
    display: block;
  }
  .lbl {
    flex: none;
    width: 58px;
    font: 600 12px var(--head-font);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dim);
  }
  b {
    font: 600 14px var(--head-font);
    color: var(--text);
    min-width: 34px;
    text-align: right;
  }
</style>
