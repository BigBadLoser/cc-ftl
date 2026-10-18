/** Live layout viewer: `npm run dev`, then open /tools/shipgen/. Rerolls seeds without Blender or sprite art. */
import { contactSheet, factionIds } from './draw';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const faction = $<HTMLSelectElement>('faction');
for (const id of factionIds()) faction.add(new Option(id.replace('faction.', ''), id));

function draw(): void {
  const { raster, text } = contactSheet(faction.value, Number($<HTMLInputElement>('seed').value), Math.max(1, Number($<HTMLInputElement>('count').value)), Math.max(0, Number($<HTMLInputElement>('depth').value)));
  const canvas = $<HTMLCanvasElement>('sheet');
  canvas.width = raster.width;
  canvas.height = raster.height;
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height), 0, 0);
  $('text').textContent = text;
}

$('reroll').addEventListener('click', () => {
  $<HTMLInputElement>('seed').value = String(Math.floor(Math.random() * 100000));
  draw();
});
for (const id of ['faction', 'depth', 'seed', 'count']) $(id).addEventListener('change', draw);
draw();
