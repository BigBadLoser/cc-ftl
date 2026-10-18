/**
 * Live layout viewer: `npm run dev` and open /tools/shipgen/, or build a static bundle with
 * `npx vite build tools/shipgen --base ./ --outDir <dir>`. Runs the generator in the browser.
 */
import { contactSheet, factionIds, gen } from './draw';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const faction = $<HTMLSelectElement>('faction');
for (const id of factionIds()) faction.add(new Option(id.replace('faction.', ''), id));
const num = (id: string): number => Number($<HTMLInputElement>(id).value);

function draw(): void {
  const count = Math.max(1, Math.min(24, num('count')));
  const zoom = $<HTMLSelectElement>('zoom').value;
  // "fit": one ship fills the screen width (at least 4 px per tile).
  const avail = Math.max(300, window.innerWidth - 32);
  let widest = 0;
  if (zoom === 'fit') for (let i = 0; i < count; i++) { try { widest = Math.max(widest, gen(faction.value, num('seed') + i, num('depth')).width); } catch { /* shown below */ } }
  const perRow = count === 1 ? 1 : 2;
  const scale = zoom === 'fit' ? Math.max(4, Math.floor((avail - 24 * perRow) / ((widest || 60) * perRow))) : Number(zoom);
  const { raster, text } = contactSheet(faction.value, num('seed'), count, Math.max(0, num('depth')), scale, avail);
  const canvas = $<HTMLCanvasElement>('sheet');
  canvas.width = raster.width;
  canvas.height = raster.height;
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height), 0, 0);
  $('text').textContent = text;
}

const step = (d: number): void => {
  $<HTMLInputElement>('seed').value = String(num('seed') + d * Math.max(1, num('count')));
  draw();
};
$('reroll').addEventListener('click', () => {
  $<HTMLInputElement>('seed').value = String(Math.floor(Math.random() * 100000));
  draw();
});
$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
for (const id of ['faction', 'depth', 'seed', 'count', 'zoom']) $(id).addEventListener('change', draw);
draw();
