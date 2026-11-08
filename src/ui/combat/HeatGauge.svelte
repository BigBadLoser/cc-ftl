<script lang="ts">
  import { keyLabel, keymap } from '../keymap';
  import Icon from '../Icon.svelte';
  import { ActionButton, Frame, KeyBadge, tip } from '../kit';
  import HeatBar, { heatTone } from './HeatBar.svelte';
  import { anchor } from '../lessons/anchors';
  import { VENT_MIN_HEAT } from '../../sim/combat/heatTuning';
  import type { UiShipCombat } from '../api';

  /**
   * The player's HEAT frame: the heat percentage, its net rate, Vent and the gauge (with the auto-vent line). Everything is live
   * from `UiShipCombat.heat`.
   */
  let { heat, rate, onVent, style = '' }: {
    heat: UiShipCombat['heat'];
    rate: number;
    onVent: () => void;
    style?: string;
  } = $props();

  const frac = $derived(heat.value / heat.max);
  const pct = $derived(Math.round(frac * 100));
  const tone = $derived(heatTone(frac));
  const locked = $derived(heat.lockout > 0);
  const rateText = $derived(`${rate >= 0 ? '+' : '−'}${Math.abs(rate).toFixed(1)}%/s`);
  const canVent = $derived(!locked && heat.venting === 0 && heat.value >= VENT_MIN_HEAT);
</script>

<Frame title="Heat" {style} testid="heat-gauge" lesson={anchor('combat.heat')}>
  <div class="hh">
    <div class="top">
      <b class={tone}>{pct}%</b>
      <span
        class="rate"
        class:up={rate > 0.05}
        class:down={rate < -0.05}
        data-testid="heat-rate"
        use:tip={{ text: 'Net heat change per second right now' }}
      >
        {rateText}
      </span>
      <span class="vent">
        <ActionButton
          tone={heat.venting > 0 ? 'active' : 'plain'}
          disabled={!canVent}
          title="Vent: dump heat fast, but shields drop and weapons hold fire" key="combat.vent"
          onclick={onVent}
        >
          <span class="ventin">
            <Icon name="wind" size={15} />
            {heat.venting > 0 ? `${heat.venting.toFixed(1)}s` : 'Vent'}
            <KeyBadge tone="dim" size="sm" padX={3}>{keyLabel($keymap, 'combat.vent')}</KeyBadge>
          </span>
        </ActionButton>
      </span>
    </div>
    <HeatBar value={heat.value} max={heat.max} marks autoVent={0.7} label="Ship heat" />
  </div>
</Frame>

<style>
  .hh {
    flex: 1;
    display: grid;
    grid-template-rows: auto 1fr;
    gap: var(--gutter);
    align-content: stretch;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  b {
    font: 700 20px/1 var(--head-font);
  }
  b.cool { color: var(--cyan); }
  b.amber { color: var(--amber); }
  b.red { color: var(--red); }
  .rate {
    font: 600 13px/1 var(--head-font);
    color: var(--dim);
    min-width: 46px;
  }
  .rate.up { color: var(--amber); }
  .rate.down { color: var(--cyan); }
  .vent {
    margin-left: auto;
    display: inline-flex;
    height: 26px;
  }
  .ventin {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    padding: 0 5px;
    font: 600 13px var(--head-font);
    letter-spacing: 0.06em;
  }
</style>
