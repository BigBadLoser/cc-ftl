<script lang="ts">
  import data from '../data/generated/game-data.json';

  // The game's goal chain (src/content/goals.ts), act by act.
  type Act = { title: string; goals: { title: string; text: string }[]; reward: string[] };
  const acts = (data as unknown as { goals: Act[] }).goals;
</script>

<ol class="wiki-goal-acts">
  {#each acts as act (act.title)}
    <li>
      <strong>{act.title}</strong> <span class="reward">Reward: {act.reward.join(', ')}</span>
      <ul>
        {#each act.goals as goal (goal.title)}<li><em>{goal.title}:</em> {goal.text}</li>{/each}
      </ul>
    </li>
  {/each}
</ol>

<style>
  .reward { color: var(--wiki-subtle, #8a9bb0); font-size: .85em; margin-left: .35rem; }
  .wiki-goal-acts ul { margin-top: .25rem; }
</style>
