<script lang="ts">
  import { Segmented, SideTabs, Slider } from '../kit';
  import { lessonPrefs } from '../lessons/prefs';
  import { RANGES, settings, type Settings } from '../settings/settings';

  /** Settings in four groups, applied as they change and kept per browser profile. Lessons keep their own prefs (lessons/prefs.ts). */
  let s = $state<Settings>(settings.get());
  $effect(() => settings.subscribe((v) => (s = v)));
  let lessonsOn = $state(lessonPrefs.enabled());
  let lessonsReset = $state(false);

  const ONOFF = [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }];
  const SPEEDS = [{ value: '0', label: 'Paused' }, { value: '1', label: '1×' }, { value: '2', label: '2×' }, { value: '3', label: '3×' }];
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const set = (patch: Partial<Settings>) => settings.set(patch);
  const TABS = [
    { value: 'lessons', label: 'Lessons', testId: 'set-tab-lessons' },
    { value: 'gameplay', label: 'Gameplay', testId: 'set-tab-gameplay' },
    { value: 'camera', label: 'Camera and input', testId: 'set-tab-camera' },
    { value: 'display', label: 'Display', testId: 'set-tab-display' },
  ];
  let tab = $state('lessons');
  type Flag = 'pauseOnAlert' | 'pauseOnBlur' | 'edgeScroll' | 'invertDrag' | 'showFps' | 'tooltips';
</script>

{#snippet toggle(key: Flag, label: string, sub = '')}
  <div class="row">
    <span class="label">{label}{#if sub}<small>{sub}</small>{/if}</span>
    <Segmented options={ONOFF} value={s[key] ? 'on' : 'off'} label={label} testId="set-{key}" onChange={(v) => set({ [key]: v === 'on' })} />
  </div>
{/snippet}
{#snippet slider(key: 'scrollSpeed' | 'zoomSpeed', label: string)}
  <div class="row">
    <span class="label">{label}</span>
    <span class="sl">
      <Slider value={s[key]} min={RANGES[key].min} max={RANGES[key].max} step={RANGES[key].step} {label} testId="set-{key}" onChange={(v) => set({ [key]: v })} />
      <b>{pct(s[key])}</b>
    </span>
  </div>
{/snippet}

<SideTabs options={TABS} value={tab} onChange={(v) => (tab = v)} label="Settings" testId="settings">
  <div class="page">
    {#if tab === 'lessons'}
      <div class="row">
        <span class="label">Lessons<small>Short how-to cards the first time something happens</small></span>
        <Segmented options={ONOFF} value={lessonsOn ? 'on' : 'off'} label="Lessons" testId="set-lessons" onChange={(v) => { lessonsOn = v === 'on'; lessonPrefs.setEnabled(lessonsOn); }} />
      </div>
      <div class="row">
        <span class="label">Show every lesson again</span>
        <button class="act" data-testid="set-lessons-reset" onclick={() => { lessonPrefs.reset(); lessonsReset = true; }}>{lessonsReset ? 'Done' : 'Reset lessons'}</button>
      </div>
    {:else if tab === 'gameplay'}
      {@render toggle('pauseOnAlert', 'Pause on urgent alerts', 'Fire, breach, combat and the like')}
      {@render toggle('pauseOnBlur', 'Pause in the background', 'While the window is not in front; resumes when you come back')}
      <div class="row">
        <span class="label">Speed when a game loads</span>
        <Segmented options={SPEEDS} value={String(s.startSpeed)} label="Speed when a game loads" testId="set-startSpeed" onChange={(v) => set({ startSpeed: Number(v) as Settings['startSpeed'] })} />
      </div>
    {:else if tab === 'camera'}
      {@render toggle('edgeScroll', 'Edge scrolling', 'Move the mouse to a screen edge to pan')}
      {@render slider('scrollSpeed', 'Scroll speed')}
      {@render slider('zoomSpeed', 'Zoom speed')}
      {@render toggle('invertDrag', 'Invert drag', 'Dragging moves the camera, not the world')}
    {:else}
      {@render toggle('showFps', 'Show FPS', 'Under the clock')}
      {@render toggle('tooltips', 'Tooltips')}
    {/if}
    <footer><button class="plain" data-testid="set-reset" onclick={() => settings.reset()}>Reset all settings</button></footer>
  </div>
</SideTabs>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    min-height: 100%;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: 40px;
  }
  .label {
    flex: 1;
    display: grid;
    font-size: 14px;
    color: var(--rest);
  }
  small {
    font-size: 12px;
    color: var(--dim);
  }
  .sl {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    width: 220px;
  }
  .sl b {
    width: 44px;
    text-align: right;
    font: 600 13px var(--head-font);
    color: var(--text);
  }
  .row :global(.kit-seg button) {
    min-height: 32px;
    min-width: 52px;
    font: 600 13px var(--head-font);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .act {
    min-height: 32px;
    background: var(--act-fill);
    border-color: var(--act-edge);
    font: 600 13px var(--head-font);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .plain {
    min-height: 32px;
    font: 600 13px var(--head-font);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  footer {
    margin-top: auto;
    padding-top: var(--sp-3);
    display: flex;
    justify-content: flex-end;
  }
</style>
