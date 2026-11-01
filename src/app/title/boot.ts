import { mount } from 'svelte';
import TitleApp from '../../ui/title/TitleApp.svelte';
import type { UiApi, UiSaveSlot } from '../../ui/api';
import { SAVE_VERSION } from '../../sim';
import { AUTO_IDS, PRECOMBAT_ID, SLOT_IDS, isAutoId, saveStore } from '../saveStore';
import { continueGame, loadSlot, newestAutosave, restartNewGame, takeTitleView } from '../saves';
import { startStage, type Stage } from './stage';
import { previewCrew } from './crewRoll';
import { content } from '../../content';
import { startingRoles } from '../../sim';
import type { TitleApi } from '../../ui/title/titleApi';

/** Mount the title screen (no game exists yet): its Continue, Load and Start reload the page into one. */
export async function mountTitle(target: HTMLElement): Promise<void> {
  await saveStore.ready();
  const saves: UiApi['saves'] = {
    list: () => {
      const metas = new Map(saveStore.list().map((m) => [m.id, m]));
      return [...AUTO_IDS, PRECOMBAT_ID, ...SLOT_IDS].map((id) => {
        const meta = metas.get(id) ?? null;
        return {
          id, auto: !SLOT_IDS.includes(id as never), meta, kind: isAutoId(id) ? 'auto' : id === PRECOMBAT_ID ? 'precombat' : 'slot',
          loadable: !meta || meta.version === undefined || meta.version === SAVE_VERSION,
        } satisfies UiSaveSlot;
      });
    },
    save: () => Promise.resolve(false),
    load: loadSlot,
    remove: (id) => (SLOT_IDS.includes(id as never) ? saveStore.remove(id) : Promise.resolve(false)),
  };
  let stage: Stage | null = null;
  const api: TitleApi = {
    saves,
    canContinue: () => newestAutosave() !== null,
    continueGame,
    startGame: (plan) => void restartNewGame(plan),
    newSeed: () => (Math.random() * 0x100000000) >>> 0,
    roles: (ship) => startingRoles(content, ship),
    rollCrew: (plan) => previewCrew(content, plan),
    portrait: (look) => stage?.portrait(look) ?? null,
    stage: async (canvas, ship) => {
      const s = await startStage(canvas, ship);
      stage = s;
      return { dispose: () => { if (stage === s) stage = null; s.dispose(); } };
    },
  };
  mount(TitleApp, { target, props: { api, start: takeTitleView() ?? 'main' } });
}
