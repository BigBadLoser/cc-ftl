<script lang="ts">
  import FloatingWindow from '../../src/ui/FloatingWindow.svelte';
  import EventPanel from '../../src/ui/EventPanel.svelte';
  import FightReportCard from '../../src/ui/combat/FightReportCard.svelte';
  import Icon from '../../src/ui/Icon.svelte';
  import { Chip, DecisionBar, Dialog, Frame, TipHost } from '../../src/ui/kit';
  import type { UiApi, UiFightReport } from '../../src/ui/api';
  import type { UiEventGrid } from '../../src/ui/starmapApi';

  /**
   * Each window the shared frame covers, with mock data, one per cell. A cell is a 1920-wide stage that is its own containing block for fixed
   * positioning (`transform`), so a window sits where it would on a 1920px screen. Windows that need the game's api get a stub that does nothing.
   */
  const api = { dispatch: () => {}, focusFight: () => {}, closeFightReport: () => {}, itemIcons: { subscribe: (f: (v: object) => void) => { f({}); return () => {}; } } } as unknown as UiApi;
  const event = {
    id: 1, kind: 'scene', title: 'Deep space: Distress call', who: 'Free Traders freighter', tone: 'amber', ships: 1, hostiles: 0, deploying: false, canLeave: true, why: null, fleeing: false, resumeTo: 'Kestrel Reach', hopsLeft: 1,
    roster: [{ ship: 1, name: 'Gilded Magpie', owner: 'Free Traders', status: 'Helpless', tone: 'amber' }],
    dockRequest: null, aid: { ship: 1, name: 'Gilded Magpie', action: 'resend', status: 'Party recalled: the help still stands', clock: 112, failing: 'Reactor' }, pod: null,
  } as unknown as UiEventGrid;
  const dockEvent = { ...event, kind: 'scene', aid: null, dockRequest: { ship: 1, name: 'Skiff', text: 'Skiff asks to dock so its crew can come aboard and settle the debt.' }, roster: [{ ship: 1, name: 'Skiff', owner: 'Pirates', status: 'Asks to dock', tone: 'amber' }] } as unknown as UiEventGrid;
  const report = {
    outcome: 'destroyed', enemy: 'Raider', seconds: 94, hullBefore: 1, hullAfter: 0.71, enemyHull: 0, enemyCrew: 3,
    lost: [{ name: 'Burst laser', subject: null }], damaged: [], down: [{ name: 'Mara', subject: null }], dead: [], enemyLost: [{ name: 'Engine', subject: null }], ammo: [{ name: 'Missiles', n: 2 }], prize: null,
  } as unknown as UiFightReport;
  // The dialog is portalled to the body, so its spot is page-absolute: put it at the top of its own stage.
  $effect(() => { const st = document.querySelector<HTMLElement>('[data-cell=dialog]'); if (st) { const r = st.getBoundingClientRect(); document.documentElement.style.setProperty('--dlg-top', `${r.top + window.scrollY + 24}px`); } });
  const two = [{ id: 'a', label: 'Cancel', cancel: true }, { id: 'b', label: 'Jump anyway', primary: true }];
  const three = [{ id: 'a', label: 'Offer help', note: 'Board as guests', primary: true }, { id: 'b', label: 'Drop out', note: 'No promises made' }, { id: 'c', label: 'Fly on', note: 'Continue the trip' }];
  const cells = [
    { id: 'floating', label: 'Floating window (Ship overview)' },
    { id: 'dialog', label: 'Dialog (jump confirm)' },
    { id: 'event', label: 'Event card (aid, dock request)' },
    { id: 'deploy', label: 'Deploy picker shell' },
    { id: 'fight', label: 'Fight report' },
    { id: 'trade', label: 'Window with a title chip (Trade)' },
    { id: 'bar', label: 'Decision bar, 2 and 3 options' },
  ];
</script>

<TipHost />
<div class="lab">
  {#each cells as c (c.id)}
    <h3>{c.label}</h3>
    <div class="stage" data-cell={c.id}>
      <svelte:boundary onerror={(e) => console.error(c.id, e)}>
        {#if c.id === 'floating'}
          <FloatingWindow id="lab-overview" title="Ship overview" min={{ w: 260, h: 140 }} defaultRect={() => ({ x: 24, y: 108, w: 300, h: 0 })} onClose={() => {}} icon="hull" testId="lab-floating" padded>
            <div class="grid"><span class="cell"><Icon name="power" size={18} /><b>12/9</b></span><span class="cell"><Icon name="o2" size={18} /><b>21.3</b></span><span class="cell"><Icon name="credits" size={18} /><b>480</b></span><span class="cell"><Icon name="fuel" size={18} /><b>64</b></span></div>
          </FloatingWindow>
        {:else if c.id === 'dialog'}
          <div class="dlg"><Dialog open title="Before you jump" testId="lab-dialog" dismissable={false}>
            <p class="warn"><Icon name="person" size={16} /><span>Left behind: <b>Mara, Silas</b></span></p>
            <p class="warn"><Icon name="shuttle" size={16} /><span>Not aboard: <b>Skiff</b></span></p>
            <DecisionBar options={two} onpick={() => {}} />
          </Dialog></div>
        {:else if c.id === 'event'}
          <EventPanel {api} {event} result={null} />
          <div class="second"><EventPanel {api} event={dockEvent} result={null} /></div>
        {:else if c.id === 'deploy'}
          <div class="deploy" data-testid="lab-deploy"><Frame title="Deploy" style="background:var(--panel);padding:var(--sp-3) 0 0;box-shadow:var(--shadow-window)">
            {#snippet right()}<span class="node">Kestrel Reach</span>{/snippet}
            <div class="dsheet"><span class="cell"><Icon name="target" size={18} /><b>Spot is clear.</b></span><div class="map"></div></div>
<DecisionBar options={[{ id: 'go', label: 'Deploy here', primary: true }]} onpick={() => {}} />
          </Frame></div>
        {:else if c.id === 'fight'}
          <FightReportCard {api} {report} />
        {:else if c.id === 'trade'}
          <FloatingWindow id="lab-trade" title="Trade" icon="station" titleFit min={{ w: 400, h: 140 }} defaultRect={() => ({ x: 24, y: 108, w: 560, h: 0 })} onClose={() => {}} testId="lab-trade">
            {#snippet titleExtra()}<span class="who">Trade station hub</span><Chip tone="gold" icon="credits">480</Chip>{/snippet}
            <div class="pad">Stock, prices and the deal go here.</div>
          </FloatingWindow>
        {:else}
          <div class="bars" data-testid="lab-bar"><DecisionBar options={two} onpick={() => {}} /><DecisionBar options={three} onpick={() => {}} /></div>
        {/if}
      </svelte:boundary>
    </div>
  {/each}
</div>

<style>
  .lab { width: 1920px; background: var(--bg); color: var(--text); }
  h3 { margin: 0; padding: 8px 24px; font: 700 13px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); }
  /* transform makes the stage the containing block of fixed children: a window sits in it as it would on a screen */
  .stage { position: relative; transform: translateZ(0); width: 1920px; height: 460px; overflow: hidden; background: #070a0e; border-bottom: 1px solid var(--line); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .cell { display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: var(--panel-2); border: 1px solid var(--line); color: var(--ink-accent); }
  .cell b { color: var(--text); font-weight: 600; }
  :global(.kit-veil) { display: none; }
  :global(.kit-card[data-testid='lab-dialog']) { position: absolute; left: 700px; top: var(--dlg-top, 120px); transform: none; }
  .warn { margin: 0 0 8px; display: flex; gap: 8px; align-items: center; color: var(--amber); font-size: 14px; }
  .warn b { color: var(--text); font-weight: 600; }
  .deploy { position: absolute; left: 680px; top: 24px; width: 560px; }
  .dsheet { display: grid; gap: 8px; padding: 10px; }
  .map { height: 170px; border: 1px solid var(--line-hi); background: var(--panel-2); }
  .node { font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); padding: 0 4px; }
  .second :global(.card) { left: calc(50% + 500px); }
  .who { font-weight: 600; }
  .pad { padding: 14px; color: var(--dim); }
  .bars { position: absolute; left: 24px; top: 24px; width: 900px; display: grid; gap: 16px; background: var(--panel); }
</style>
