<script lang="ts">
  /** One pending encounter in the starmap drawer: the fleet (faction, role, strength), how it happened and the choices with their odds or cost. */
  import Icon from './Icon.svelte';
  import type { UiEncounter, UiEncounterChoice } from './starmapApi';
  import { toneColor } from './starmapStyle';

  let { encounter, onChoose }: { encounter: UiEncounter; onChoose: (id: number, choice: UiEncounterChoice['choice']) => void } = $props();
</script>

<section class="enc steel-tokens" class:hostile={encounter.hostile && encounter.kind === 'interdict'} data-testid="starmap-encounter" data-kind={encounter.kind}>
  <h4><Icon name={encounter.kind === 'interdict' ? 'alert' : encounter.kind === 'distress' ? 'hail' : encounter.kind === 'scan' ? 'target' : 'trade'} size={14} />{encounter.title}</h4>
  <div class="who">
    <i style={`background: ${toneColor(encounter.tone)}`}></i>
    <b>{encounter.faction} {encounter.role.toLowerCase()}</b>
    <small>{encounter.ships} ship{encounter.ships > 1 ? 's' : ''}</small>
  </div>
  <div class="facts">
    <span class="chip" class:warn={encounter.threat === 'Heavy' || encounter.threat === 'Overwhelming'} title="Fleet strength">{encounter.threat}</span>
    <span class="dim">{encounter.how}</span>
  </div>
  <div class="choices">
    {#each encounter.choices as c (c.choice)}
      <button class:fight={c.choice === 'fight'} disabled={!c.enabled} title={c.why ?? ''} onclick={() => onChoose(encounter.id, c.choice)} data-testid="starmap-choice-{c.choice}">
        <span>{c.label}</span><small>{c.why ?? c.detail}</small>
      </button>
    {/each}
  </div>
</section>

<style>
  .enc { display: grid; gap: 6px; padding: 8px; background: var(--panel-2); border: 1px solid var(--line-hi); }
  .enc.hostile { border-color: var(--red); }
  h4 { margin: 0; display: flex; align-items: center; gap: 6px; font: 600 12px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-accent); }
  .choices button:not(.fight) { border-color: var(--act-edge); }
  .hostile h4 { color: var(--red); }
  .who { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .who i { width: 8px; height: 8px; flex: none; clip-path: polygon(100% 50%, 0 0, 25% 50%, 0 100%); }
  .who b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  small { color: var(--dim); font-size: 11px; }
  .facts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; }
  .dim { color: var(--dim); }
  .chip { font: 600 12px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 6px; border: 1px solid currentColor; color: var(--amber); }
  .chip.warn { color: var(--red); }
  .choices { display: grid; gap: 4px; }
  .choices button { display: flex; align-items: center; justify-content: space-between; gap: 8px; font: 600 15px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .choices button small { font: 600 13px var(--head-font); letter-spacing: 0.04em; text-transform: none; color: var(--cyan); text-align: right; }
  .choices button:disabled small { color: var(--red); }
  .choices button.fight { border-color: var(--red); }
</style>
