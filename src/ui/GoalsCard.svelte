<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiGoals } from './api';
  import Icon from './Icon.svelte';
  import { readGoalsOpen, writeGoalsOpen } from './phoneHud';
  import { readCollapsed, writeCollapsed } from './cardCollapse';

  /**
   * The tutorial goal chain under the time controls: the act being played, its goals with a tick when met, and what the act
   * pays. Collapses to its title line (remembered); the × skips the whole chain for this game after a confirm. When an act is
   * finished it says so for a few seconds before the next act's goals take its place.
   */
  let { api }: { api: UiApi } = $props();
  let goals = $state<UiGoals | null>(null);
  let finished = $state<{ title: string; reward: string } | null>(null);
  let confirmSkip = $state(false);
  /** Set when the player skips: the chain ending then is not a finished act. */
  let skipped = false;
  /** Phone: the card is a one-line chip, collapsed by default; its state lasts for the session (sessionStorage). */
  let narrow = $state(false);
  let openPhone = $state(readGoalsOpen());
  let collapsedDesk = $state(readCollapsed('goals'));
  const collapsed = $derived(narrow ? !openPhone : collapsedDesk);

  function toggle() {
    if (narrow) {
      openPhone = !openPhone;
      writeGoalsOpen(openPhone);
      return;
    }
    collapsedDesk = !collapsedDesk;
    writeCollapsed('goals', collapsedDesk);
  }

  onMount(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const onMq = () => (narrow = mq.matches);
    onMq();
    mq.addEventListener('change', onMq);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = api.goals.subscribe((g) => {
      // A new act (or the chain's end) after one was being played: show what was finished first.
      if (goals && !skipped && (!g || g.act !== goals.act)) {
        finished = { title: goals.title, reward: goals.reward };
        clearTimeout(timer);
        timer = setTimeout(() => (finished = null), 6000);
      }
      goals = g;
    });
    return () => {
      mq.removeEventListener('change', onMq);
      unsub();
      clearTimeout(timer);
    };
  });
</script>

{#if finished}
  <section class="card done-act" data-testid="goals-finished">
    <p class="head"><Icon name="check" size={16} />{finished.title}: complete</p>
    {#if finished.reward}<p class="reward">{finished.reward}</p>{/if}
  </section>
{:else if goals}
  <section class="card" class:chip={narrow && collapsed} data-testid="goals">
    <div class="head">
      <button class="title" onclick={toggle} aria-expanded={!collapsed} data-testid="goals-toggle">
        <span class="act">Goals {goals.act}/{goals.acts}</span>
        {#if narrow && collapsed}<span class="sep">·</span>{/if}
        {#if narrow || !collapsed}<span class="name">{goals.title}</span>{/if}
        <Icon name={collapsed ? 'chevDown' : 'chevUp'} size={16} />
      </button>
      {#if !(narrow && collapsed)}<button class="x" title="Skip the goals" aria-label="Skip the goals" data-testid="goals-skip" onclick={() => (confirmSkip = !confirmSkip)}><Icon name="close" size={14} /></button>{/if}
    </div>
    {#if confirmSkip}
      <div class="confirm">
        <p>Skip the goals for this game?</p>
        <div class="row">
          <button onclick={() => (confirmSkip = false)}>Keep them</button>
          <button class="danger" data-testid="goals-skip-yes" onclick={() => { skipped = true; api.dispatch({ type: 'story.skipGoals' }); confirmSkip = false; }}>Skip</button>
        </div>
      </div>
    {:else if !collapsed}
      <ul>
        {#each goals.goals as g (g.id)}
          <li class:done={g.done} title={g.text} data-testid="goal">
            <i class="box">{#if g.done}<Icon name="check" size={12} />{/if}</i>
            <span><b>{g.title}</b><em>{g.text}</em></span>
          </li>
        {/each}
      </ul>
      {#if goals.reward}<p class="reward">Reward: {goals.reward}</p>{/if}
    {/if}
  </section>
{/if}

<style>
  .card { box-sizing: border-box; width: 100%; padding: 6px 8px; background: var(--panel); border: 1px solid var(--line-hi); pointer-events: auto; }
  .done-act { border-color: var(--green); }
  .head { display: flex; align-items: center; gap: 6px; margin: 0; }
  .done-act .head { color: var(--green); font: 600 12px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  .title { flex: 1; display: flex; align-items: center; gap: 6px; min-height: 24px; padding: 0; border: 0; background: none; text-align: left; color: var(--text); }
  .act { font: 600 11px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-accent); white-space: nowrap; }
  .name { font: 600 13px var(--head-font); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .x { min-width: 28px; min-height: 28px; padding: 0; border: 0; background: none; color: var(--dim); }
  ul { list-style: none; margin: 2px 0 0; padding: 0; display: grid; gap: 4px; }
  li { display: flex; gap: 6px; align-items: flex-start; font-size: 12px; }
  li span { display: grid; }
  li b { color: var(--text); font-weight: 600; }
  li em { color: var(--dim); font-style: normal; }
  li.done b { color: var(--green); }
  li.done em { text-decoration: line-through; }
  .box { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; margin-top: 1px; border: 1px solid var(--dim); color: var(--green); }
  li.done .box { border-color: var(--green); }
  .reward { margin: 6px 0 0; color: #ffd77a; font-size: 12px; }
  .confirm p { margin: 4px 0 6px; font-size: 12px; color: var(--text); }
  .confirm .row { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 4px; }
  .confirm button { min-height: 30px; }
  .confirm .danger { border-color: var(--red); color: var(--red); }
  /* Phone chip: one line, name ellipsised, chevron at the right. */
  .chip { padding: 0 8px; }
  .title :global(.icon) { margin-left: auto; align-self: center; color: var(--ink-accent); }
  .chip .title { min-height: 32px; align-items: center; min-width: 0; }
  .chip .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sep { color: var(--dim); }
</style>
