<script lang="ts">
  import type { UiAiming, UiApi, UiCombat, UiShipCombat } from './api';
  import Icon from './Icon.svelte';
  import { resolveTarget } from './combatTarget';

  type Me = NonNullable<UiCombat['player']>;
  let { api, me, enemy, selWeapon, aiming, onSelect, onHail, onFlee }: {
    api: UiApi; me: Me; enemy: UiShipCombat | undefined; selWeapon: number; aiming: UiAiming | null; onSelect: (id: number) => void; onHail: (ship: number) => void; onFlee: (ship: number) => void;
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
  /** Fleeing is a jump: open the starmap to pick the target (the cheapest reachable one is preselected). */
  const flee = () => onFlee(me.ship);
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
        {@const own = w.target !== null}
        {@const ownName = own && enemy ? resolveTarget(enemy, 0, { moduleId: w.targetModuleId, tile: w.targetTile }).label : (w.target ?? '')}
        <div class="w" class:sel={selWeapon === w.id} class:off={!w.powered} data-testid="combat-weapon">
          <span class="nm" title={names[i]}>{names[i]}{#if w.ammo !== null && w.ammo > 0}<span class="tag">x{w.ammo}</span>{/if}</span>
          <span class="chg {st.tone}" title="Charge {Math.round(w.charge * 100)}%"><i style="width:{Math.round(w.charge * 100)}%"></i></span>
          <span class="stt {st.tone}">{st.text}</span>
          <button class="tg" class:own class:armed={selWeapon === w.id} disabled={!enemy} title={selWeapon === w.id ? 'Now tap a module on the enemy ship (tap again to cancel)' : own ? `Own target: ${ownName}. Tap to re-aim` : 'Follows the ship target. Tap, then tap a module to aim just this weapon'} aria-pressed={selWeapon === w.id} onclick={() => onSelect(selWeapon === w.id ? 0 : w.id)}>
            <span>{selWeapon === w.id ? 'tap enemy...' : own ? ownName : 'ship target'}</span><Icon name="chevDown" size={12} />
          </button>
          {#if own}<button class="rs" title="Reset to the ship target" aria-label="Reset to the ship target" onclick={() => clearWeapon(w.id)}><Icon name="rotate" size={12} /></button>{:else}<span class="nors"></span>{/if}
          <button class="iv" class:armed={aiming?.weapon === w.id} disabled={!enemy} aria-pressed={aiming?.weapon === w.id} title={aiming?.weapon === w.id ? 'Click an enemy tile in the main view (right-click or Esc cancels)' : 'Target in view: click an enemy tile in the main view to aim just this weapon'} aria-label="Target in view" data-testid="combat-inview" onclick={() => api.setAiming(aiming?.weapon === w.id ? null : { weapon: w.id })}><Icon name="frame" size={12} /></button>
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
    {#if me.idle}<div class="why" data-testid="combat-idle">{me.idle}</div>{/if}
    <div class="sec">
      {#if enemy}<button class="tile sm q" title="Hail: call them on the radio. Only ships that are not hostile answer" aria-label="Hail" data-testid="combat-hail" onclick={() => { api.dispatch({ type: 'trade.hail', ship: enemy.ship }); onHail(enemy.ship); }}><Icon name="hail" size={16} /><span class="cap">Hail</span></button>{/if}
      <span class="ftl" class:full={canFlee} title="FTL charge: a jump needs its charge, short ones less than a full drive">
        <button class="tile sm q go" disabled={me.state !== 'active'} title="Flee: pick a node to jump to" aria-label="Flee" data-testid="combat-flee" onclick={flee}><Icon name="fast" size={16} /><span class="cap">Flee</span></button>
        <span class="bar"><i style="width:{ftlPct}%"></i></span>
      </span>
      <span class="sh" title="Your shield layers" data-testid="ship-meters"><Icon name="shield" size={14} /><b data-testid="shield-pips">{me.shield.layers}/{me.shield.max}</b><span class="cap">Shields</span></span>
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
  .player { background: var(--panel); flex: 5 1 0; min-height: 0; display: flex; flex-direction: column; }
  .scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 8px 16px; overscroll-behavior: contain; }
  .wh { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  h3 { margin: 0; font: 600 14px/1.2 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .link { min-height: 0; min-width: 0; height: 24px; padding: 0 8px; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--cyan); background: transparent; border-color: var(--line); }
  .weapons { display: grid; gap: 3px; }
  .w { display: grid; grid-template-columns: minmax(0, 1fr) 36px 46px 90px 22px 22px; align-items: center; gap: 5px; height: 36px; padding: 0 4px 0 8px; background: var(--panel-2); border: 1px solid var(--line); }
  .w.sel { border-color: var(--cyan); background: var(--panel-3); }
  .w.off { opacity: 0.7; }
  .nm { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 15px/1.2 var(--head-font); letter-spacing: 0.03em; }
  .chg { display: block; height: 4px; background: #0b1220; } .chg > i { display: block; height: 100%; }
  .chg.amber > i { background: var(--amber); } .chg.green > i { background: var(--green); } .chg.red > i { background: var(--red); }
  .stt { font-size: 11px; white-space: nowrap; } .stt.amber { color: var(--amber); } .stt.green { color: var(--green); } .stt.red { color: #ff8a8a; }
  button.tg { min-height: 0; min-width: 0; height: 26px; padding: 0 4px 0 7px; display: flex; align-items: center; gap: 4px; border: 1px solid var(--line-hi); background: var(--panel); color: var(--text); font-size: 11px; text-align: left; overflow: hidden; }
  button.tg :global(svg) { margin-left: auto; color: var(--dim); }
  button.tg span { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button.tg.own { color: var(--cyan); font-weight: 600; background: #0a3a52; border-color: var(--cyan); }
  button.tg.own :global(svg) { color: var(--cyan); }
  button.tg.armed { color: #fff; border-color: var(--amber); background: var(--panel-3); }
  button.iv { min-height: 0; min-width: 0; width: 22px; height: 22px; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--dim); }
  button.iv.armed { color: #fff; border-color: var(--amber); background: var(--panel-3); }
  button.rs { min-height: 0; min-width: 0; width: 22px; height: 22px; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--cyan); }
  .nors { display: block; }
  .tag { margin-left: 4px; font-size: 10px; padding: 0 4px; background: #0b1220; border: 1px solid var(--line); font-weight: 400; }
  footer { flex: none; padding: 8px; display: grid; gap: 6px; background: var(--panel); border-top: 1px solid var(--line-hi); }
  .fire { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  button.big { height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font: 600 16px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; color: var(--text); }
  button.big.go:not(:disabled) { background: #0e6a80; border-color: var(--cyan); color: #fff; }
  .why { font: 600 12px/1.2 var(--head-font); letter-spacing: 0.04em; color: var(--amber); }
  .sec { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-size: 11px; opacity: 0.8; }
  button.tile.q { width: auto; min-width: 0; min-height: 0; height: 26px; flex-direction: row; gap: 4px; padding: 0 6px; background: transparent; }
  button.tile.q .cap { font-size: 10px; }
  .cap { font-size: 10px; line-height: 1; letter-spacing: 0.04em; text-transform: uppercase; color: var(--dim); }
  .sh .cap { margin-left: 2px; }
  .ftl { display: inline-flex; align-items: center; gap: 6px; } .ftl .bar { width: 44px; } .ftl.full .bar > i { background: var(--green); }
  .go:not(:disabled) { color: var(--cyan); }
  .sh { display: inline-flex; align-items: center; gap: 4px; color: var(--cyan); } .sh b { color: var(--text); font-weight: 600; }
  .consoles { display: inline-flex; flex-wrap: wrap; gap: 4px; }
  .cs { padding: 1px 6px; border: 1px solid var(--line); color: var(--dim); } .cs.warn { border-color: var(--amber); color: var(--amber); }
  .dim { color: var(--dim); margin: 0; font-size: 12px; }
  @media (max-width: 600px) { :global(.combat:not(.expanded)) .consoles { display: none; } footer { padding-bottom: calc(8px + var(--sab)); } }
</style>
