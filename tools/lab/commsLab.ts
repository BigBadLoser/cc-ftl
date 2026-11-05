import { mount } from 'svelte';
import '../../src/ui/theme.css';
import CommsLab from './CommsLab.svelte';
import { startStage } from '../../src/app/title/stage';
import { shipHolo } from '../../src/app/shipHolo';

/**
 * The comms lab panel (`?panel=comms`): every piece of src/ui/comms on its own in its states, then the pieces composed. It is the modularity check: each
 * takes plain props and nothing else. The portrait and the ship come from the game's own renderer (the title stage's, and `shipHolo`), so the stills
 * show real art. Flickers and stutters are held on with `force` in the "flicker" rows, so a still shows the glitch frame.
 */
export async function mountCommsLab(target: HTMLElement): Promise<void> {
  // The game's theme pins the page to the viewport; the lab page scrolls.
  for (const e of [document.documentElement, document.body]) { e.style.height = 'auto'; e.style.overflow = 'visible'; e.style.position = 'static'; }
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:-9999px;width:400px;height:300px';
  document.body.appendChild(canvas);
  const stage = await startStage(canvas, 'ship.starter');
  await stage.ready;
  const look = { species: 'species.human', role: 'role.gunner', appearanceSeed: 22 };
  let face: string | null = null;
  for (let i = 0; i < 100 && !face; i++) {
    face = stage.portrait(look);
    if (!face) await new Promise((r) => setTimeout(r, 100));
  }
  const holo = await shipHolo({ faction: 'pirates', shipgen: 'faction.scrapper', seed: 4471, depth: 1, family: 'raider' });
  mount(CommsLab, { target, props: { face, holo } });
}
