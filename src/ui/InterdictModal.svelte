<script lang="ts">
  import { Chip, tip } from './kit';
  /**
   * An interdiction, answered in a modal centred over the map screen (the ship is halted in hyperspace until it is settled): who stopped you,
   * how strong they are, and the three ways out with their odds or price. Hails, scans and distress calls stay in the starmap drawer; a patrol's
   * hail to stop is a comms window (PatrolHail).
   */
  import Icon from './Icon.svelte';
  import { PaneHead } from './kit';
  import type { UiEncounter, UiEncounterChoice } from './starmapApi';
  import { toneColor } from './starmapStyle';

  let { encounter, onChoose }: { encounter: UiEncounter; onChoose: (id: number, choice: UiEncounterChoice['choice']) => void } = $props();
  let busy = $state(false);
  $effect(() => { void encounter.id; busy = false; });

  function pick(choice: UiEncounterChoice['choice']) {
    if (busy) return;
    busy = true;
    onChoose(encounter.id, choice);
  }
</script>

<div class="veil steel-tokens" data-testid="interdict-modal">
  <div class="card" role="dialog" aria-modal="true" aria-label={encounter.title}>
    <PaneHead icon="alert" title={encounter.title} sub={encounter.node} foe />
    <div class="body">
      <div class="who">
        <i style={`background: ${toneColor(encounter.tone)}`}></i>
        <b>{encounter.name}</b>
        <small>{encounter.faction} {encounter.role.toLowerCase()}</small>
      </div>
      <div class="facts">
        <Chip size="md" tone={encounter.threat === 'Heavy' || encounter.threat === 'Overwhelming' ? 'bad' : 'warn'} title="Fleet strength">{encounter.threat}</Chip>
        <span class="dim">{encounter.how}. Your ship is halted in hyperspace.</span>
      </div>
      <div class="choices">
        {#each encounter.choices as c (c.choice)}
          <button class:fight={c.choice === 'fight'} disabled={!c.enabled || busy} use:tip={{ text: c.why ?? '' }} onclick={() => pick(c.choice)} data-testid="starmap-choice-{c.choice}">
            <span class="lbl"><Icon name={c.choice === 'evade' ? 'fast' : c.choice === 'bribe' ? 'credits' : 'combat'} size={18} />{c.label}</span>
            <small>{c.why ?? c.detail}</small>
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .veil { position: absolute; inset: 0; z-index: 14; background: var(--veil); display: grid; place-items: center; padding: 16px; touch-action: none; }
  .card { box-sizing: border-box; width: min(440px, 100%); max-height: 100%; overflow-y: auto; touch-action: pan-y; background: var(--panel-2); border: 1px solid var(--red); box-shadow: var(--shadow-window); }
  .card :global(.ph) { margin: 0; padding: 6px 12px; min-height: 36px; }
  .body { display: grid; gap: 10px; padding: 12px; }
  .who { display: flex; align-items: center; gap: 8px; font: 600 18px var(--head-font); }
  .who i { width: 10px; height: 10px; flex: none; clip-path: polygon(100% 50%, 0 0, 25% 50%, 0 100%); }
  .who b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  small { color: var(--dim); font-size: 12px; }
  .facts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; }
  .dim { color: var(--dim); }
  .choices { display: grid; gap: 6px; }
  .choices button { min-height: 40px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 12px; font: 600 16px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .choices button:not(.fight) { border-color: var(--act-edge); }
  .lbl { display: inline-flex; align-items: center; gap: 8px; }
  .choices button small { font: 600 14px var(--head-font); letter-spacing: 0.04em; text-transform: none; color: var(--ink-accent); text-align: right; }
  .choices button:disabled small { color: var(--red); }
  .choices button.fight { border-color: var(--red); }
  @media (max-width: 600px) {
    .veil { place-items: end stretch; padding: 0; }
    .card { width: 100%; border-width: 1px 0 0; padding-bottom: var(--sab); }
  }
</style>
