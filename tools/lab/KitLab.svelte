<script lang="ts">
  import { Chip, Meter } from '../../src/ui/kit';

  const tones = ['dim', 'good', 'warn', 'bad', 'gold', 'select'] as const;
  const meterTones = ['auto', 'good', 'warn', 'bad', 'neutral'] as const;
  const heights = [4, 6, 8] as const;
  const values = [100, 75, 45, 15];
</script>

<div class="lab">
  <h3>Chip <small>tone x size, then outline off, icon, own colour</small></h3>
  {#each ['sm', 'md'] as const as size (size)}
    <div class="row">{#each tones as tone (tone)}<Chip {tone} {size}>{tone} {size}</Chip>{/each}</div>
  {/each}
  <div class="row">
    {#each tones as tone (tone)}<Chip {tone} size="md" outline={false}>{tone} filled</Chip>{/each}
  </div>
  <div class="row">
    <Chip tone="gold" size="md" icon="credits">1200</Chip>
    <Chip tone="warn" icon="alert">Black market</Chip>
    <Chip size="md" color="#c96b3a">own colour</Chip>
    <Chip size="md" caps={false}>Mixed Case</Chip>
  </div>

  <h3>Meter <small>tone (auto uses the 60/30 hull rule) x height, at 100, 75, 45, 15 percent</small></h3>
  {#each meterTones as tone (tone)}
    {#each heights as height (height)}
      <div class="row">
        <span class="lbl">{tone} {height}</span>
        {#each values as v (v)}<span class="m"><Meter value={v} max={100} {tone} {height} /></span>{/each}
      </div>
    {/each}
  {/each}
  <h3>Meter <small>base marker, notch, explicit thresholds 80/50</small></h3>
  <div class="row">
    <span class="lbl">base 40</span><span class="m"><Meter value={65} max={100} base={40} height={8} /></span>
    <span class="lbl">notch .5</span><span class="m"><Meter value={0.3} notches={[0.5]} height={6} fill="var(--hud-bar)" /></span>
    <span class="lbl">80/50 at 70</span><span class="m"><Meter value={70} max={100} tone="auto" thresholds={{ good: 80, warn: 50 }} height={6} /></span>
  </div>
</div>

<style>
  .lab { padding: 12px 16px 40px; color: var(--text); font-family: system-ui, sans-serif; font-size: 14px; background: #0a0d12; }
  h3 { margin: 18px 0 8px; font: 600 12px var(--head-font); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-accent); }
  h3 small { color: var(--dim); text-transform: none; letter-spacing: 0; font: 12px system-ui; margin-left: 8px; }
  .row { display: flex; gap: 14px; align-items: center; margin-bottom: 8px; }
  .lbl { width: 90px; color: var(--dim); font-size: 12px; }
  .m { width: 150px; }
</style>
