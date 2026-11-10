<script lang="ts">
  import Icon, { type IconName } from '../Icon.svelte';
  import { tip } from '../kit';
  import { SKILL_ICON } from '../crew/format';
  import Pips, { pipsOf, type PipKind } from '../inspector/Pips.svelte';
  import Section from '../inspector/Section.svelte';
  import { interestMark, interestTip, traitColor } from './crewText';
  import type { UiRollCrew, UiRollSkill } from './titleApi';

  /**
   * The crew screen's dossier: the selected member in full (mock C1). Name (type to rename), title, the roll stepper (step back to an
   * earlier roll: rolls are keyed by count) and Reroll; the background lines with what each adds; traits with their whole effect and
   * flavour; all eleven skills as 0-10 pips with interest marks (a won't-do skill struck through); the stats grid.
   */
  let { c, pic, onRename, onReroll, onRoll }: {
    c: UiRollCrew; pic: string | null; onRename: (name: string) => void; onReroll: () => void; onRoll: (rerolls: number) => void;
  } = $props();
  const MAX = 10;
  /** Rolled and trait pips, red ones a trait took away (bars clamp at 10). */
  const pips = (s: UiRollSkill): PipKind[] => pipsOf(s.rolled, 0, s.trait, s.lost).slice(0, MAX);
</script>

{#snippet legend()}<span class="legend"><span><i class="r"></i>rolled</span><span><i class="t"></i>trait</span><span><i class="l"></i>trait −</span><span class="int">✦ keen</span><span class="int">✦✦ passionate</span></span>{/snippet}

<section class="win dossier" data-testid="crew-dossier">
  <div class="ph">{c.name}<small>{c.title}</small></div>
  <div class="body">
    <div class="id">
      <span class="face">{#if pic}<img src={pic} alt="" />{/if}</span>
      <div class="ctl">
        <label class="name"><input value={c.name} maxlength="24" aria-label="Name" data-testid="crew-name" onchange={(e) => onRename(e.currentTarget.value)} /><Icon name="pencil" size={14} /></label>
        <div class="line">
          <span class="role" use:tip={{ text: 'Title from their best skill. Job priorities come from all their skills; change them in game.' }}>{c.title}</span>
          <span class="roll">
            <button aria-label="Previous roll" disabled={c.rerolls === 0} data-testid="crew-roll-prev" onclick={() => onRoll(c.rerolls - 1)}><Icon name="back" size={16} /></button>
            <span data-testid="crew-roll">Roll {c.rerolls + 1}</span>
            <button aria-label="Next roll" data-testid="crew-roll-next" onclick={() => onRoll(c.rerolls + 1)}><Icon name="chevRight" size={16} /></button>
          </span>
        </div>
        <button class="hd" data-testid="crew-reroll" onclick={onReroll}><Icon name="dice" size={18} />Reroll {c.name}</button>
      </div>
    </div>
    {#if c.read}<p class="read">{c.read}</p>{/if}
    {#if c.backgroundLines.length}
      <Section title="Background">
        {#each c.backgroundLines as b (b.name)}<div class="bgl"><b>{b.name}</b> {b.line}{#if b.adds}: {b.adds}{/if}</div>{/each}
        {#if c.knack}<div class="bgl">A knack for <b>{c.knack.toLowerCase()}</b>, out of nowhere.</div>{/if}
        {#each c.wontDo as w (w)}<div class="bgl neg">{w}</div>{/each}
      </Section>
    {/if}
    <Section title="Traits">
      {#each c.traits as t (t.id)}
        <div class="tl"><i style:background={traitColor(t.kind)}></i><span class="tn">{t.name}</span><span>{t.effect}<em>{t.flavour}</em></span></div>
      {:else}<div class="tl none">No traits</div>{/each}
    </Section>
    <Section title="Skills" extra={legend}>
      {#each c.skills as s (s.skill)}
        <div class="sk" class:zero={s.value === 0} class:struck={s.struck} data-testid="dossier-skill">
          <span class="si"><Icon name={(SKILL_ICON[s.skill] ?? 'list') as IconName} size={15} /></span><span class="sn">{s.name}</span><b>{s.value}{#if s.value > MAX}+{/if}</b>
          <Pips cells={pips(s)} max={MAX} width={22} />
          <span class="int" use:tip={{ text: interestTip(s.interest) }}>{interestMark(s.interest)}</span>
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
  .win { display: flex; flex-direction: column; min-height: 0; width: 560px; background: rgba(11, 14, 17, 0.96); border: 1px solid var(--line-hi); }
  .ph { display: flex; align-items: center; gap: 10px; min-height: 36px; margin: 0; padding: 0 12px; font-size: 15px; letter-spacing: 0.06em; }
  .ph small { font: 600 13px var(--head-font); color: var(--dim); letter-spacing: 0.06em; }
  .ph { flex: none; }
  .body { flex: 1 1 auto; padding: 14px; overflow-y: auto; min-height: 0; }
  .id { display: grid; grid-template-columns: 112px 1fr; gap: 16px; }
  .face { width: 112px; height: 128px; background: var(--track); border: 1px solid var(--line); overflow: hidden; box-sizing: border-box; }
  .face img { display: block; width: 100%; height: 100%; image-rendering: pixelated; object-fit: cover; }
  .ctl { display: grid; gap: 8px; align-content: start; }
  .name { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 8px; background: var(--track); border: 1px solid var(--line); color: var(--dim); }
  .name:focus-within { border-color: var(--cyan); }
  .name input { flex: 1; min-width: 0; background: none; border: 0; outline: 0; color: #fff; font: 600 18px var(--head-font); letter-spacing: 0.04em; }
  .line { display: flex; align-items: center; gap: 8px; }
  .role { font: 600 13px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; color: var(--cyan); }
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
  .legend .r { background: #8b939a; } .legend .t { background: var(--green); } .legend .l { background: var(--red); }
  .int { color: var(--amber); font-size: 12px; }
  .bgl { padding: 3px 0; font-size: 13px; color: #c9ced3; }
  .bgl b { color: #fff; font-weight: 600; }
  .sk { display: grid; grid-template-columns: 16px 96px 24px auto 1fr; align-items: center; column-gap: 8px; min-height: 26px; font-size: 13px; }
  .sk > span:last-child { text-align: left; cursor: help; }
  .si { display: inline-flex; color: var(--cyan); }
  .sk.zero .si, .sk.zero .sn { color: var(--dim); }
  .sk.struck .sn { text-decoration: line-through; color: var(--red); }
  .sk b { font: 700 16px/1 var(--head-font); text-align: right; }
  .sk.zero b { color: #4a535b; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; column-gap: 18px; }
  .stat { display: flex; justify-content: space-between; gap: 8px; min-height: 24px; align-items: center; border-bottom: 1px solid var(--panel-3); font-size: 13px; }
  .why { color: var(--dim); font-size: 12px; margin-left: 6px; }
  .dim { color: var(--dim); } .pos { color: var(--good-ink); } .neg { color: var(--red); }
</style>
