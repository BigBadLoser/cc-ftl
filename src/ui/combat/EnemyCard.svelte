<script lang="ts">
  import Icon from '../Icon.svelte';
  import { anchor } from '../lessons/anchors';
  import { Frame, FrameGap, Meter, Pill, Pips } from '../kit';
  import type { UiShipCombat } from '../api';
  import { enemyWeaponRow } from './enemyWeapons';
  import { hullTone } from './hullTone';

  /**
   * Compact enemy card, top left: everything on it is live from the combat snapshot. One thin red frame, the name set into its top border.
   */
  let { enemy, state: pill, onFrame }: {
    enemy: UiShipCombat;
    state: { text: string; tone: string };
    onFrame: () => void;
  } = $props();
  const hull = $derived(Math.round(enemy.integrity * 100));
  const heatPct = $derived(Math.round((enemy.heat.value / enemy.heat.max) * 100));
  const hot = $derived(heatPct >= 90 ? 'red' : heatPct >= 70 ? 'amber' : '');
  const sub = $derived(
    [enemy.faction, enemy.klass].filter((x): x is string => !!x && x.toLowerCase() !== pill.text.toLowerCase()).join(' · '),
  );
  const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
  const HULL_FILL = { green: 'var(--health-good)', amber: 'var(--health-warn)', red: 'var(--health-bad)' } as const;
  const HEAT_FILL = {
    '': 'linear-gradient(90deg, var(--heat-low), var(--cyan))',
    amber: 'linear-gradient(90deg, var(--heat-low), var(--amber))',
    red: 'linear-gradient(90deg, var(--amber), var(--red))',
  } as const;
  const tone = $derived(pill.tone as 'red' | 'amber' | 'green' | 'dim');
</script>

<Frame
  title={enemy.name}
  tone="hostile"
  style="width:290px; pointer-events:auto; background: var(--panel)"
  testid="enemy-card"
  lesson={anchor('combat.enemy')}
>
  {#snippet right()}
    <Pill {tone}>{pill.text}</Pill>
    <FrameGap width={14} />
    <button class="fr" title="Frame both ships" aria-label="Frame both ships" onclick={onFrame}><Icon name="frame" size={15} /></button>
  {/snippet}
  <div class="body">
    {#if sub}<span class="fac">{sub}</span>{/if}
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
        value={hull / 100}
        fill={HULL_FILL[hullTone(hull)]}
        height={20}
        edge="var(--hostile-track)"
        label="{hull}%"
        blink={hull < 30}
        title="Hull integrity"
      />
      <div class="hrow" title="Heat">
        <span class="grow"><Meter value={heatPct / 100} fill={HEAT_FILL[hot]} height={8} edge="var(--hostile-track)" /></span>
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
            <Meter
              value={w.charge}
              fill={shot ?? 'var(--cyan)'}
              height={8}
              edge={shot ?? 'var(--hostile-track)'}
              notches={[w.commitAt]}
            />
            <span class="st">{row.status}</span>
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
    height: 21px;
    padding: 0;
    display: grid;
    place-items: center;
    background: var(--panel);
    border: 1px solid var(--hostile);
    border-radius: 0;
    margin: 0 4px;
    color: var(--hostile);
  }
  .fac {
    margin: 2px 0 -4px;
    font: 600 11px/1 var(--head-font);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--hostile-dim);
  }
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
  .nm {
    font: 600 13px/1 var(--head-font);
    letter-spacing: 0.03em;
    white-space: nowrap;
    overflow: hidden;
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
