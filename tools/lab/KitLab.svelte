<script lang="ts">
  import { Chip, Meter, Segmented } from '../../src/ui/kit';
  import { dangerColor } from '../../src/ui/starmapStyle';
  import HeatBar from '../../src/ui/combat/HeatBar.svelte';

  const tones = ['dim', 'good', 'warn', 'bad', 'gold', 'select'] as const;
  const meterTones = ['auto', 'good', 'warn', 'bad', 'neutral'] as const;
  const heights = [4, 6, 8] as const;
  const values = [100, 75, 45, 15];
  const two = [{ value: 'a', label: 'Add' }, { value: 'b', label: 'Erase' }];
  const three = [{ value: 'a', label: 'Small' }, { value: 'b', label: 'Medium' }, { value: 'c', label: 'Large' }];
  const oneOff = [{ value: 'a', label: 'Add' }, { value: 'b', label: 'Erase', disabled: true }];
  const allOff = two.map((o) => ({ ...o, disabled: true }));
  let v = $state({ a: 'a', b: 'a', c: 'b', d: 'a', e: 'b', f: 'a' });
</script>

<div class="lab">
  <h3>Chip <small>tone x size, then outline off, icon, swatch</small></h3>
  {#each ['sm', 'md'] as const as size (size)}
    <div class="row">{#each tones as tone (tone)}<Chip {tone} {size}>{tone} {size}</Chip>{/each}</div>
  {/each}
  <div class="row">
    {#each tones as tone (tone)}<Chip {tone} size="md" outline={false}>{tone} filled</Chip>{/each}
  </div>
  <div class="row">
    <Chip tone="gold" size="md" icon="credits">1200</Chip>
    <Chip tone="warn" icon="alert">Black market</Chip>
    <Chip size="md" swatch={dangerColor(6)}>danger 6</Chip>
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
    <span class="lbl">notch .5</span><span class="m"><Meter value={0.3} notches={[0.5]} height={6} /></span>
    <span class="lbl">80/50 at 70</span><span class="m"><Meter value={70} max={100} tone="auto" thresholds={{ good: 80, warn: 50 }} height={6} /></span>
  </div>
  <h3>Heat bar <small>heat's own scale, shared by the player's gauge (marks, auto-vent line) and the enemy card (8px), at 30, 60, 80, 95 percent</small></h3>
  <div class="row">
    <span class="lbl">player</span>
    {#each [30, 60, 80, 95] as v (v)}<span class="m tall"><HeatBar value={v} max={100} marks autoVent={0.7} /></span>{/each}
  </div>
  <div class="row">
    <span class="lbl">enemy 8</span>
    {#each [30, 60, 80, 95] as v (v)}<span class="m"><HeatBar value={v} max={100} height={8} edge="var(--hostile-track)" /></span>{/each}
  </div>

  <h3>Segmented <small>joined group: two options, one disabled, all disabled with nothing selected, three options</small></h3>
  <div class="row">
    <Segmented label="Two" value={v.a} onChange={(x) => (v.a = x)} options={two} />
    <Segmented label="One disabled" value={v.b} onChange={(x) => (v.b = x)} options={oneOff} />
    <Segmented label="All disabled" value="" onChange={() => {}} options={allOff} />
    <Segmented label="Three" value={v.c} onChange={(x) => (v.c = x)} options={three} />
  </div>
  <h3>Build look <small>.build region: plain, .on, disabled buttons, and a Segmented inside it</small></h3>
  <div class="row build bl">
    <button>Plain</button><button class="on">On</button><button disabled>Disabled</button><button class="on" disabled>On disabled</button>
    <Segmented label="Build two" value={v.d} onChange={(x) => (v.d = x)} options={two} />
    <Segmented label="Build all disabled" value="" onChange={() => {}} options={allOff} />
    <Segmented label="Build three" value={v.e} onChange={(x) => (v.e = x)} options={three} />
  </div>
</div>

<style>
  .bl { background: var(--build-bg-solid); padding: 10px; border: 1px solid var(--amber); width: fit-content; }
  .lab { padding: 12px 16px 40px; color: var(--text); font-family: system-ui, sans-serif; font-size: 14px; background: #0a0d12; }
  h3 { margin: 18px 0 8px; font: 600 12px var(--head-font); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-accent); }
  h3 small { color: var(--dim); text-transform: none; letter-spacing: 0; font: 12px system-ui; margin-left: 8px; }
  .row { display: flex; gap: 14px; align-items: center; margin-bottom: 8px; }
  .lbl { width: 90px; color: var(--dim); font-size: 12px; }
  .m { width: 150px; }
  .m.tall { display: flex; height: 22px; }
</style>
