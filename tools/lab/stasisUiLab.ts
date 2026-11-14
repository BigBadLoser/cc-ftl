import { mount } from 'svelte';
import '../../src/ui/theme.css';
import StasisUiLab from './StasisUiLab.svelte';
import { startStage } from '../../src/app/title/stage';

/**
 * The stasis UI panel (`?panel=stasisui`, #116): the stasis wheel's slot ring on the module Overview tab, and a frozen prisoner's "In stasis"
 * section on their crew Overview (in the wheel, and on a hover cart), as DOM with mock data. Portraits are real (the title stage's renderer).
 */
export async function mountStasisUiLab(target: HTMLElement): Promise<void> {
  for (const e of [document.documentElement, document.body]) { e.style.height = 'auto'; e.style.overflow = 'visible'; e.style.position = 'static'; }
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:-9999px;width:400px;height:300px';
  document.body.appendChild(canvas);
  const stage = await startStage(canvas, 'ship.starter');
  await stage.ready;
  const looks = [
    { species: 'species.human', role: 'role.gunner', appearanceSeed: 22 },
    { species: 'species.human', role: 'role.medic', appearanceSeed: 5 },
    { species: 'species.human', role: 'role.engineer', appearanceSeed: 11 },
    { species: 'species.human', role: 'role.pilot', appearanceSeed: 31 },
  ];
  const faces: (string | null)[] = [];
  for (const look of looks) {
    let f: string | null = null;
    for (let i = 0; i < 100 && !f; i++) {
      f = stage.portrait(look);
      if (!f) await new Promise((r) => setTimeout(r, 100));
    }
    faces.push(f);
  }
  mount(StasisUiLab, { target, props: { faces } });
}
