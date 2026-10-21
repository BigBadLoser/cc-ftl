<script lang="ts">
  import type { UiApi, UiCombat, UiShipCombat } from './api';
  import Icon from './Icon.svelte';

  type Me = NonNullable<UiCombat['player']>;
  let { api, me, enemy, picked, selWeapon, onSelect, onHail }: {
    api: UiApi; me: Me; enemy: UiShipCombat | undefined; picked: number; selWeapon: number; onSelect: (id: number) => void; onHail: (ship: number) => void;
  } = $props();

  const ready = $derived(me.weapons.some((w) => w.charge >= 1 && w.powered && !w.ion));
  const ftlPct = $derived(Math.min(100, Math.round((me.ftl / me.ftlMax) * 100)));
  const canFlee = $derived(me.ftl >= me.ftlMax && me.state === 'active');
  const warnings: Record<string, string> = {
    weapons: 'Unmanned: weapons will not fire',
    shields: 'Unmanned: shields recharge slowly',
    helm: 'Unmanned: no evasion, no escape',
  };

  const setHold = (hold: boolean) => api.dispatch({ type: 'combat.setHold', ship: me.ship, hold });
  const volley = () => api.dispatch({ type: 'combat.fireVolley', ship: me.ship });
  const flee = () => api.dispatch({ type: 'combat.flee', ship: me.ship });
  const aimWeapon = (weaponId: number, moduleId: number) => {
    if (enemy) api.dispatch({ type: 'combat.setTarget', ship: me.ship, weaponId, targetShip: enemy.ship, targetModuleId: moduleId });
  };
  const clearWeapon = (weaponId: number) =>
    api.dispatch({ type: 'combat.setTarget', ship: me.ship, weaponId, targetShip: 0, targetModuleId: 0 });
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  /** Weapon names, with a roman numeral when several share one. */
  const names = $derived(me.weapons.map((w, i) => {
    const same = me.weapons.filter((o) => o.name === w.name);
    return same.length > 1 ? `${w.name} ${ROMAN[same.indexOf(w)] ?? i + 1}` : w.name;
  }));
  function status(w: Me['weapons'][number]): { text: string; tone: string } {
    if (!w.powered) return { text: 'Unpowered', tone: 'red' };
    if (w.ammo === 0) return { text: 'No ammo', tone: 'red' };
    if (w.charge >= 1) return { text: w.ion ? 'Ion ready' : 'Ready', tone: 'green' };
    return { text: 'Charging', tone: 'amber' };
  }
  const pickedName = $derived(enemy?.modules.find((m) => m.id === picked)?.name ?? 'whole ship');
  const volleyTitle = $derived(ready ? 'Fire volley: every charged weapon now' : me.hold ? 'Fire volley: waiting for a weapon to charge' : 'Fire volley: hold fire to charge one, weapons otherwise fire as soon as they charge');
</script>

<div class="player" data-testid="combat-player">
  <div class="scroll">
    <div class="wh">
      <h3>Weapons</h3>
      <button class="link" title="Frame your ship" aria-label="Frame your ship" onclick={() => api.focusFight(null)}><Icon name="ship" size={14} />Your ship</button>
    </div>
    <div class="weapons" data-testid="combat-weapons">
      {#each me.weapons as w, i (w.id)}
        {@const st = status(w)}
        <div class="w" class:sel={selWeapon === w.id} class:off={!w.powered} role="button" tabindex="0" aria-pressed={selWeapon === w.id} title="Select to aim this weapon: then tap a module" onclick={() => onSelect(selWeapon === w.id ? 0 : w.id)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(selWeapon === w.id ? 0 : w.id); } }}>
          <div class="line">
            <span class="nm">{names[i]}</span>
            {#if w.ammo !== null && w.ammo > 0}<span class="tag">x{w.ammo}</span>{/if}
            <span class="stt {st.tone}">{st.text}</span>
          </div>
          <div class="bar {st.tone}"><i style="width:{Math.round(w.charge * 100)}%"></i></div>
          <div class="line sub">
            <span class="to" title={w.target ? `Aimed: ${w.target}` : 'Follows ship target'}>Target: {w.target ?? 'ship target'}</span>
            <span class="mode">{w.target ? 'Manual' : 'Auto'}</span>
            <button class="tile sm" title="Aim this weapon at: {pickedName} (the module you tapped last)" aria-label="Aim at {pickedName}" disabled={!enemy} onclick={(e) => { e.stopPropagation(); aimWeapon(w.id, picked); }}><Icon name="target" size={14} /></button>
            {#if w.target}<button class="tile sm" title="Follow the ship target" aria-label="Follow the ship target" onclick={(e) => { e.stopPropagation(); clearWeapon(w.id); }}><Icon name="rotate" size={14} /></button>{/if}
          </div>
        </div>
      {/each}
      {#if me.weapons.length === 0}<p class="dim">No weapons installed.</p>{/if}
    </div>
  </div>

  <footer>
    <div class="fire">
      <button class="big" class:on={me.hold} aria-pressed={me.hold} title={me.hold ? 'Holding fire: tap to let weapons fire' : 'Hold fire'} aria-label={me.hold ? 'Holding fire' : 'Hold fire'} data-testid="combat-hold" onclick={() => setHold(!me.hold)}><Icon name="hold" size={20} />Hold Fire</button>
      <button class="big go" disabled={!ready} title={volleyTitle} aria-label="Fire volley" data-testid="combat-volley" onclick={volley}><Icon name="volley" size={20} />Fire Volley</button>
    </div>
    {#if !ready && !me.hold}<div class="hint" data-testid="combat-volley-hint">Hold fire to charge a volley</div>{/if}
    <div class="sec">
      {#if enemy}<button class="tile sm" title="Hail: call them on the radio. Only ships that are not hostile answer" aria-label="Hail" data-testid="combat-hail" onclick={() => { api.dispatch({ type: 'trade.hail', ship: enemy.ship }); onHail(enemy.ship); }}><Icon name="hail" size={16} /></button>{/if}
      <span class="ftl" class:full={canFlee} title="FTL charge: full means you can flee">
        <button class="tile sm go" disabled={!canFlee} title="Flee: jump away" aria-label="Flee" data-testid="combat-flee" onclick={flee}><Icon name="fast" size={16} /></button>
        <span class="bar"><i style="width:{ftlPct}%"></i></span>
      </span>
      <span class="sh" title="Your shield layers" data-testid="ship-meters"><Icon name="shield" size={14} /><b data-testid="shield-pips">{me.shield.layers}/{me.shield.max}</b></span>
      <span class="consoles" data-testid="combat-consoles">
        {#each me.consoles as c (c.id)}
          {@const bad = !c.powered || (!c.operator && c.kind !== 'shields')}
          <span class="cs" class:warn={bad} title={!c.powered ? `${c.name}: no power` : c.operator ? `${c.name}: manned by ${c.operator}` : `${c.name}: ${warnings[c.kind]}`}>{c.name}</span>
        {/each}
        {#if me.consoles.length === 0}<span class="dim">No consoles</span>{/if}
      </span>
    </div>
  </footer>
</div>

<style>
  .player { background: var(--panel); flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 8px; }
  .wh { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  h3 { margin: 0; font: 600 14px/1.2 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .link { min-height: 0; min-width: 0; height: 24px; padding: 0 8px; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--cyan); background: transparent; border-color: var(--line); }
  .weapons { display: grid; gap: 6px; }
  .w { display: grid; gap: 5px; padding: 6px 8px; background: var(--panel-2); border: 1px solid var(--line); cursor: pointer; }
  .w.sel { border-color: var(--cyan); background: var(--panel-3); }
  .w.off { opacity: 0.7; }
  .line { display: flex; align-items: center; gap: 6px; }
  .nm { flex: 1; min-width: 0; font: 600 17px/1.2 var(--head-font); letter-spacing: 0.03em; }
  .stt { font-size: 12px; } .stt.amber { color: var(--amber); } .stt.green { color: var(--green); } .stt.red { color: #ff8a8a; }
  .bar { height: 6px; } .bar.amber > i { background: var(--amber); } .bar.green > i { background: var(--green); } .bar.red > i { background: var(--red); }
  .sub { font-size: 12px; color: var(--dim); }
  .to { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mode { color: var(--text); }
  button.tile.sm { width: 28px; height: 28px; }
  .tag { font-size: 10px; padding: 0 5px; background: #0b1220; border: 1px solid var(--line); }
  footer { flex: none; padding: 8px; display: grid; gap: 6px; background: var(--panel); border-top: 1px solid var(--line-hi); }
  .fire { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  button.big { height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font: 600 16px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; color: var(--text); }
  button.big.go:not(:disabled) { background: #0e6a80; border-color: var(--cyan); color: #fff; }
  .hint { font-size: 11px; color: var(--dim); }
  .sec { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; font-size: 12px; }
  .ftl { display: inline-flex; align-items: center; gap: 6px; } .ftl .bar { width: 44px; } .ftl.full .bar > i { background: var(--green); }
  .go:not(:disabled) { color: var(--cyan); }
  .sh { display: inline-flex; align-items: center; gap: 4px; color: var(--cyan); } .sh b { color: var(--text); font-weight: 600; }
  .consoles { display: inline-flex; flex-wrap: wrap; gap: 4px; }
  .cs { padding: 1px 6px; border: 1px solid var(--line); color: var(--dim); } .cs.warn { border-color: var(--amber); color: var(--amber); }
  .dim { color: var(--dim); margin: 0; font-size: 12px; }
  @media (max-width: 600px) { footer { padding-bottom: calc(8px + var(--sab)); } }
</style>
