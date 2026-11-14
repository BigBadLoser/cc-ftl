<script lang="ts">
  import type { UiStasis } from '../../../src/ui/api';
  import { Meter } from '../../../src/ui/kit';
  import Icon from '../../../src/ui/Icon.svelte';
  /** Option S2: the crew Overview as it is (portrait, status), with a tidy "In stasis" block: icon rows, cyan links, the reserve as a kit Meter. */
  let { st }: { st: UiStasis } = $props();
</script>

<div class="blk">
  <div class="row"><span class="k"><Icon name="pin" size={14} />Slab</span>{#if st.wheel && !st.carrier}<button class="lk">{st.where}</button>{:else}<span>{st.where}</span>{/if}</div>
  {#if st.carrier}<div class="row"><span class="k"><Icon name="person" size={14} />Carted by</span><button class="lk">{st.carrier.name}</button></div>{/if}
  {#if st.to}<div class="row"><span class="k"><Icon name="chevRight" size={14} />Going to</span><span>{st.to}</span></div>{/if}
  <div class="row"><span class="k"><Icon name="snowflake" size={14} />Reserve</span><span class:bad={st.draining}>{st.draining ? 'draining · ' : ''}{st.reserve}%</span></div>
  <Meter value={st.reserve} max={100} tone={st.draining ? 'bad' : 'good'} height={4} />
</div>

<style>
  .blk { display: grid; gap: 4px; padding: 8px 10px; background: var(--panel-2); border-left: 2px solid #7fe9ff55; }
  .row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
  .k { display: inline-flex; align-items: center; gap: 6px; color: var(--dim); }
  .lk { background: none; border: none; padding: 0; min-height: 0; font: inherit; color: var(--cyan, #7fe9ff); cursor: pointer; } .lk:hover { text-decoration: underline; }
  .bad { color: var(--red); }
</style>
