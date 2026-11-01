<script lang="ts">
  import Icon, { type IconName } from '../Icon.svelte';
  import { Tooltip } from '../kit';
  import { SKILL_ICON } from '../crew/format';
  import Pips, { pipsOf, type PipKind } from '../inspector/Pips.svelte';
  import Section from '../inspector/Section.svelte';
  import { labelText, labelTip, traitColor } from './crewText';
  import type { UiRollCrew, UiRollSkill } from './titleApi';

  /**
   * The crew screen's dossier: the selected member in full. Name (type to rename), role and label, the roll stepper
   * (step back to an earlier roll: rolls are keyed by count) and Reroll; the one-line read; traits with their whole
   * effect and flavour; every skill as the inspector's pips against the role; the stats grid.
   */
  let { c, pic, onRename, onReroll, onRoll }: {
    c: UiRollCrew; pic: string | null; onRename: (name: string) => void; onReroll: () => void; onRoll: (rerolls: number) => void;
  } = $props();
  const MAX = 6;
  /** Rolled and trait pips, red ones a trait took away, then dashed amber up to the role's level. */
  const pips = (s: UiRollSkill): PipKind[] => {
    const seq = pipsOf(s.rolled, 0, s.trait, s.lost);
    return [...seq, ...Array<PipKind>(Math.max(0, s.role - seq.length)).fill('below')];
  };
  const note = (s: UiRollSkill): { text: string; cls: string } | null => {
    if (s.role > 0) {
      const d = s.value - s.role;
      return d > 0 ? { text: `+${d} over role`, cls: 'pos' } : d < 0 ? { text: `−${-d} under role`, cls: 'warn' } : null;
    }
    return s.value > 0 ? { text: 'off-role', cls: 'dim' } : null;
  };
</script>

{#snippet legend()}<span class="legend"><span><i class="r"></i>rolled</span><span><i class="t"></i>trait</span><span><i class="l"></i>trait −</span><span><i class="b"></i>below role</span></span>{/snippet}

<section class="win dossier" data-testid="crew-dossier">
  <div class="ph">{c.name}<small>{c.roleName}</small></div>
  <div class="body">
    <div class="id">
      <span class="face">{#if pic}<img src={pic} alt="" />{/if}</span>
      <div class="ctl">
        <label class="name"><input value={c.name} maxlength="24" aria-label="Name" data-testid="crew-name" onchange={(e) => onRename(e.currentTarget.value)} /><Icon name="pencil" size={14} /></label>
        <div class="line">
          <span class="role">{c.roleName}</span>
          {#if c.label}<Tooltip text={labelTip(c)} label={labelTip(c)}><span class="lbl {c.label}">{labelText(c.label)}</span></Tooltip>{/if}
          <span class="roll">
            <button aria-label="Previous roll" disabled={c.rerolls === 0} data-testid="crew-roll-prev" onclick={() => onRoll(c.rerolls - 1)}><Icon name="back" size={16} /></button>
            <span data-testid="crew-roll">Roll {c.rerolls + 1}</span>
            <button aria-label="Next roll" data-testid="crew-roll-next" onclick={() => onRoll(c.rerolls + 1)}><Icon name="chevRight" size={16} /></button>
          </span>
        </div>
        <button class="hd" data-testid="crew-reroll" onclick={onReroll}><Icon name="dice" size={18} />Reroll {c.name}</button>
      </div>
    </div>
    <p class="read">{c.read}</p>
    <Section title="Traits">
      {#each c.traits as t (t.id)}
        <div class="tl"><i style:background={traitColor(t.kind)}></i><span class="tn">{t.name}</span><span>{t.effect}<em>{t.flavour}</em></span></div>
      {:else}<div class="tl none">No traits</div>{/each}
    </Section>
    <Section title="Skills" extra={legend}>
      {#each c.skills as s (s.skill)}
        {@const n = note(s)}
        <div class="sk" class:off={s.role === 0} class:zero={s.value === 0}>
          <span class="si"><Icon name={(SKILL_ICON[s.skill] ?? 'list') as IconName} size={15} /></span><span class="sn">{s.name}</span><b>{s.value}</b>
          <Pips cells={pips(s)} max={Math.max(MAX, s.rolled + s.trait, s.role)} width={22} />
          <span class={n?.cls ?? ''}>{n?.text ?? ''}</span>
        </div>
      {/each}
    </Section>
    <Section title="Stats">
      <div class="stats">
        {#each c.stats as st (st.label)}
          <div class="stat"><span class="dim">{st.label}</span><span>{#if st.source}<span class:pos={st.good} class:neg={!st.good}>{st.value}</span><span class="why">{st.source}</span>{:else}{st.value}{/if}</span></div>
        {/each}
      </div>
    </Section>
  </div>
</section>

<style>
  .win { display: flex; flex-direction: column; width: 560px; background: rgba(11, 14, 17, 0.96); border: 1px solid var(--line-hi); }
  .ph { display: flex; align-items: center; gap: 10px; min-height: 36px; margin: 0; padding: 0 12px; font-size: 15px; letter-spacing: 0.06em; }
  .ph small { font: 600 13px var(--head-font); color: var(--dim); letter-spacing: 0.06em; }
  .body { padding: 14px; overflow-y: auto; min-height: 0; }
  .id { display: grid; grid-template-columns: 112px 1fr; gap: 16px; }
  .face { width: 112px; height: 128px; background: #061020; border: 1px solid var(--line); overflow: hidden; box-sizing: border-box; }
  .face img { display: block; width: 100%; height: 100%; image-rendering: pixelated; object-fit: cover; }
  .ctl { display: grid; gap: 8px; align-content: start; }
  .name { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 8px; background: var(--track); border: 1px solid var(--line); color: var(--dim); }
  .name:focus-within { border-color: var(--cyan); }
  .name input { flex: 1; min-width: 0; background: none; border: 0; outline: 0; color: #fff; font: 600 18px var(--head-font); letter-spacing: 0.04em; }
  .line { display: flex; align-items: center; gap: 8px; }
  .role { font: 600 13px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; color: var(--cyan); }
  .lbl { display: inline-block; font: 600 11px/1 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 5px; border: 1px solid currentColor; cursor: help; }
  .lbl.talented { color: var(--amber); } .lbl.green { color: #a7c98a; }
  .roll { margin-left: auto; display: inline-flex; align-items: center; gap: 2px; font-size: 13px; color: var(--dim); }
  .roll button { width: 28px; height: 28px; min-width: 0; min-height: 0; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--dim); }
  .roll span { padding: 0 6px; white-space: nowrap; }
  .hd { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font: 600 14px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .read { margin: 12px 0 14px; font-size: 13px; color: #c9ced3; font-style: italic; }
  .tl { display: grid; grid-template-columns: 4px 112px 1fr; gap: 8px; align-items: start; padding: 4px 0; border-bottom: 1px solid var(--panel-3); font-size: 13px; color: #c9ced3; }
  .tl i { width: 4px; height: 16px; }
  .tl .tn { padding-top: 2px; font: 600 13px/1 var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; color: #fff; }
  .tl em { display: block; color: var(--dim); font-size: 12px; }
  .tl.none { display: block; color: var(--dim); }
  .legend { display: inline-flex; gap: 10px; font-size: 12px; color: var(--dim); }
  .legend span { display: inline-flex; align-items: center; gap: 4px; }
  .legend i { display: inline-block; width: 10px; height: 10px; box-sizing: border-box; }
  .legend .r { background: #8b939a; } .legend .t { background: var(--green); } .legend .l { background: var(--red); } .legend .b { border: 1px dashed var(--amber); }
  .sk { display: grid; grid-template-columns: 16px 84px 18px auto 1fr; align-items: center; column-gap: 8px; min-height: 26px; font-size: 13px; }
  .sk > span:last-child { text-align: right; font-size: 12px; }
  .si { display: inline-flex; color: var(--cyan); }
  .sk.off .si, .sk.off .sn { color: var(--dim); }
  .sk b { font: 700 16px/1 var(--head-font); text-align: right; }
  .sk.zero b { color: #4a535b; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; column-gap: 18px; }
  .stat { display: flex; justify-content: space-between; gap: 8px; min-height: 24px; align-items: center; border-bottom: 1px solid var(--panel-3); font-size: 13px; }
  .why { color: var(--dim); font-size: 12px; margin-left: 6px; }
  .dim { color: var(--dim); } .pos { color: #9fe0a8; } .neg { color: #ff9a9a; } .warn { color: var(--amber); }
</style>
