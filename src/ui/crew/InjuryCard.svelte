<script lang="ts">
  import type { UiInjuryCard } from '../crewDetailApi';

  /**
   * The hover card of an injured body part (the Health tab): what is wrong and the care it needs, per injury; the capacity it lowers and what that does;
   * how and when it happened. With surgery (slice 2, #311) a shortcut queues an operation on the part.
   */
  let { card, part, onQueue }: { card: UiInjuryCard; part: string; onQueue: (() => void) | null } = $props();
</script>

<div class="card" data-testid="injury-card">
  <div class="t" class:alert={card.tone === 'alert'}>{card.title}</div>
  {#each card.injuries as i, n (n)}
    {#if i.what}<div class="what">{i.what}</div>{/if}
    <p>{i.care}</p>
    {#if i.got}<p class="dim">{i.got}</p>{/if}
  {/each}
  <p class="dim">{card.effect}</p>
  {#if onQueue}<button onclick={onQueue} data-testid="injury-card-queue">Queue operation on {part.toLowerCase()}</button>{/if}
</div>

<style>
  .card { width: 240px; padding: 8px 10px; background: var(--panel); border: 1px solid var(--line-hi); box-shadow: var(--shadow-pop); text-align: left; font-size: var(--fs-small); color: var(--text); }
  .t { margin-bottom: 4px; font-weight: 600; }
  .t.alert { color: var(--red); }
  .what { margin-top: 6px; font-weight: 600; }
  p { margin: 2px 0 0; line-height: 1.4; }
  .dim { color: var(--dim); }
  button { margin-top: 8px; min-height: 24px; padding: 0 8px; font-size: var(--fs-small); }
</style>
