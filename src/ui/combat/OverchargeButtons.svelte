<script lang="ts">
  import { ActionButton, Frame } from '../kit';
  import type { UiShipCombat } from '../api';
  import {
    OVERCHARGE_COOLDOWN_SEC,
    OVERCHARGE_ENGINE_EVASION,
    OVERCHARGE_HEAT_PER_SEC,
    OVERCHARGE_SEC,
    OVERCHARGE_SHIELD_REGEN,
    OVERCHARGE_WEAPON_CHARGE,
  } from '../../sim/combat/heatTuning';

  type Sys = 'weapons' | 'shields' | 'engines';
  /** The OVERCHARGE frame: one button per system, with its effect, or its time left while active, or its time until it can run again. */
  let { heat, onOvercharge, style = '' }: {
    heat: UiShipCombat['heat'];
    onOvercharge: (k: Sys) => void;
    style?: string;
  } = $props();

  const pct = (x: number) => Math.round(x * 100);
  /** Effect lines and tooltips come from the tuning constants. */
  const charge = pct(OVERCHARGE_WEAPON_CHARGE - 1);
  const evasion = pct(OVERCHARGE_ENGINE_EVASION);
  const kinds: { k: Sys; label: string; effect: string; tip: string }[] = [
    { k: 'weapons', label: 'Weapons', effect: `+${charge}% charge`, tip: `weapons charge ${charge}% faster` },
    {
      k: 'shields',
      label: 'Shields',
      effect: `${OVERCHARGE_SHIELD_REGEN}× regen`,
      tip: `shields regenerate ${OVERCHARGE_SHIELD_REGEN}× as fast`,
    },
    { k: 'engines', label: 'Engines', effect: `+${evasion}% evasion`, tip: `+${evasion}% evasion (needs a pilot at the helm)` },
  ];
  const locked = $derived(heat.lockout > 0);

  /** Progress bar, status line and look of one system: active (time left), cooling down (until ready), or idle (its effect). */
  function state(k: Sys, effect: string): { f: number; cls: 'act' | 'cd' | ''; text: string } {
    const o = heat.overcharge[k];
    if (o.left > 0) return { f: o.left / OVERCHARGE_SEC, cls: 'act', text: `${Math.ceil(o.left)}s left` };
    if (o.cooldown > 0) {
      return { f: 1 - o.cooldown / OVERCHARGE_COOLDOWN_SEC, cls: 'cd', text: `ready in ${Math.ceil(o.cooldown)}s` };
    }
    return { f: 0, cls: '', text: effect };
  }
  const tipOf = (o: (typeof kinds)[number]) =>
    `Overcharge ${o.label}: ${o.tip} for ${OVERCHARGE_SEC} s. ` +
    `+${OVERCHARGE_HEAT_PER_SEC[o.k]} heat/s while active, then a ${OVERCHARGE_COOLDOWN_SEC} s cooldown.`;
</script>

<Frame title="Overcharge" {style}>
  <div class="obs">
    {#each kinds as o (o.k)}
      {@const r = state(o.k, o.effect)}
      <ActionButton
        tone={r.cls === 'act' ? 'amber' : 'plain'}
        layout="stack"
        disabled={locked || r.cls === 'cd'}
        progress={r.cls ? r.f : undefined}
        title={tipOf(o)}
        testid="overcharge-{o.k}"
        onclick={() => onOvercharge(o.k)}
      >
        <span class="nm {r.cls}">{o.label}</span>
        <span class="fx {r.cls}">{r.text}</span>
      </ActionButton>
    {/each}
  </div>
</Frame>

<style>
  .obs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    height: 42px;
  }
  .nm {
    font: 700 12px/1 var(--head-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--cyan);
  }
  .fx {
    font: 600 11px/1 var(--head-font);
    letter-spacing: 0;
    text-transform: none;
    color: var(--dim);
    white-space: nowrap;
  }
  .nm.act {
    color: #fff;
  }
  .fx.act {
    color: var(--amber);
  }
  .nm.cd {
    color: var(--dim);
  }
</style>
