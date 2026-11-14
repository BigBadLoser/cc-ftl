<script lang="ts">
  import type { UiStasis } from '../../../src/ui/api';
  import { Chip, Meter } from '../../../src/ui/kit';
  /** Option S1: a frozen prisoner's top block becomes a slab card: their portrait behind frost, where the slab is, the reserve as the one bar. */
  let { name, face, st }: { name: string; face: string | null; st: UiStasis } = $props();
</script>

<div class="card" class:bad={st.draining}>
  <span class="slab">{#if face}<img src={face} alt="" />{/if}<span class="frost"></span></span>
  <div class="txt">
    <div class="nm"><b>{name}</b><Chip tone="bad">Prisoner</Chip></div>
    <div class="state">{st.draining ? 'Slab on its reserve' : 'Frozen in stasis'}</div>
    <div class="where">{#if st.carrier}<span class="dim">Carted by</span> <button class="lk">{st.carrier.name}</button>{#if st.to}<span class="dim">&nbsp;to&nbsp;</span>{st.to}{/if}{:else if st.wheel}<button class="lk">{st.where}</button>{:else}{st.where}{/if}</div>
    <Meter value={st.reserve} max={100} tone={st.draining ? 'bad' : 'good'} height={8} label="Reserve {st.reserve}%" blink={st.draining} />
  </div>
</div>

<style>
  .card { display: grid; grid-template-columns: 58px 1fr; gap: 10px; padding: 8px; background: linear-gradient(135deg, #0f1a1f, #0b0e11); border: 1px solid #24414a; }
  .card.bad { border-color: #5a2a2a; background: linear-gradient(135deg, #1f1111, #0b0e11); }
  .slab { position: relative; width: 58px; height: 64px; border: 2px solid #c9d6d9;  overflow: hidden; background: #6e8288; }
  .slab img { width: 100%; height: 100%; image-rendering: pixelated; object-fit: cover; filter: grayscale(.75) brightness(.95) contrast(1.1); }
  .frost { position: absolute; inset: 0; background: linear-gradient(160deg, rgba(190,235,245,.35), rgba(120,170,185,.15) 55%, rgba(200,240,250,.3)); mix-blend-mode: screen; }
  .txt { display: grid; gap: 4px; align-content: start; min-width: 0; }
  .nm { display: flex; align-items: center; gap: 6px; justify-content: space-between; } .nm b { font-weight: 600; }
  .state { color: #9fe7f5; font-size: 12px; } .card.bad .state { color: var(--red); }
  .where { font-size: 12px; } .dim { color: var(--dim); }
  .lk { background: none; border: none; padding: 0; min-height: 0; font: inherit; color: var(--cyan, #7fe9ff); cursor: pointer; }
  .lk:hover { text-decoration: underline; }
</style>
