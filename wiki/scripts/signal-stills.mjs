// The two pictures of the Incoming signal panel that only the game's renderer can draw (WebGL, so not in the Node recipes): the caller's portrait and
// the scanned ship's hologram. They are drawn for the very caller the `signal` recipe recorded (its `look` and `holo` request), by the game's own
// renderer through the debug hook, and saved as stills under static/guides/signal/; the hologram's anchors and mask go with it in
// src/data/guide-shots/signal__stills.json. Run by capture-guides.mjs (`npm run capture -- signal`), after `npm run generate` has recorded the recipe.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/** Draw both pictures on a loaded game page (`?hook`) and write them. `wiki` is the wiki's root folder. */
export async function captureSignalStills(page, wiki) {
  const rec = JSON.parse(await readFile(join(wiki, 'src/data/generated/panels/signal.json'), 'utf8'));
  const comms = rec.story.active.comms;
  const toBuffer = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  // The portrait art streams in: ask until the renderer has it.
  const portrait = await page.evaluate(async (look) => {
    for (let i = 0; i < 200; i++) {
      const url = window.__cc.portraitOf(look);
      if (url) {
        const blob = await (await fetch(url)).blob();
        return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(blob); });
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  }, comms.look);
  if (!portrait) throw Error('signal: the portrait did not draw');
  const holo = await page.evaluate((req) => window.__cc.shipHolo(req), comms.holo);
  if (!holo) throw Error('signal: the hologram did not draw');
  const dir = join(wiki, 'static/guides/signal');
  await mkdir(dir, { recursive: true });
  await sharp(toBuffer(portrait)).webp({ lossless: true }).toFile(join(dir, 'portrait.webp'));
  await sharp(toBuffer(holo.url)).webp({ lossless: true }).toFile(join(dir, 'holo.webp'));
  const { url: _url, ...meta } = holo;
  await mkdir(join(wiki, 'src/data/guide-shots'), { recursive: true });
  await writeFile(join(wiki, 'src/data/guide-shots/signal__stills.json'), JSON.stringify(meta) + '\n');
}
