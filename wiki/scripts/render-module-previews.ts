/**
 * Offline placement previews. Uses exactly the game's previewGeometry() grid,
 * and the same layer selection as moduleThumb (without its Pixi rendering
 * dependency). Source frames are resolved from the real atlas manifest.
 *
 * These are build-time PNGs, not a second interactive game renderer.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { World } from '../../src/sim/ecs.ts';
import { AirlockC } from '../../src/sim/modules/airlock.ts';
import { TICK_HZ } from '../../src/sim/time.ts';
import { modules as baseModules } from '../../src/content/modules.ts';
import { tierModules } from '../../src/content/tiers.ts';
import { layersOf } from '../../src/render/layerPick.ts';
import { steady } from '../../src/render/vehicleBayArt.ts';
import { previewGeometry } from '../../src/ui/buildCatalog.ts';
import type { Manifest, StaticAsset } from '../../src/render/assets/manifest.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const assetRoot = resolve(root, '../public/assets/1x');
const manifest = JSON.parse(await readFile(join(assetRoot, 'manifest.json'), 'utf8')) as Manifest;
const mods = { ...baseModules, ...tierModules };
const dest = join(root, 'static/generated/previews');
const urlPrefix = '/cc-ftl/wiki/generated/previews/';
const world = new World();
const mult = 128 / manifest.tile.w; // 2× world/art conversion; mirrors composeManifest().
const HW = 64, HH = 32;
const box = { w: 300, h: 200 };
const result: Record<string, { url: string; art: boolean; layers: number; placeholder: boolean }> = {};
const cache = new Map<string, string>();
sharp.cache(false);
sharp.concurrency(2);
await mkdir(dest, { recursive: true });

type Layer = { left: number; top: number; w: number; h: number; png: string };
const iso = (x: number, y: number) => ({ x: (x - y) * HW, y: (x + y) * HH });
const enc = (s: string) => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const number = (n: number) => Number(n.toFixed(3));
const slug = (id: string) => id.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function firstStatic(ids: string[]): { id: string; asset: StaticAsset } | undefined {
  for (const id of ids) {
    const a = manifest.assets[id];
    if (a?.kind === 'static') return { id, asset: a };
  }
  return undefined;
}
async function rawFrame(id: string, asset: StaticAsset): Promise<string> {
  const cached = cache.get(id);
  if (cached) return cached;
  const sheet = manifest.sheets[asset.sheet];
  if (!sheet) throw Error('Missing sprite sheet ' + asset.sheet);
  const path = resolve(assetRoot, sheet.image);
  if (!path.startsWith(assetRoot + sep)) throw Error('Unsafe sprite path ' + sheet.image);
  const { x, y, w, h } = asset.frame;
  const bytes = await sharp(path).extract({left:x,top:y,width:w,height:h}).png().toBuffer();
  const base64 = bytes.toString('base64');
  cache.set(id, base64);
  return base64;
}

let withArt=0, blank=0, multi=0, totalLayers=0;
for (const [id, original] of Object.entries(mods).sort(([a],[b])=>a.localeCompare(b))) {
  const def = original;
  const [w,h] = def.footprint;
  const m = {def:id,x:0,y:0,rot:0,hp:def.maxHp,powerPriority:3,enabled:true,powered:true,reservedBy:0};
  const entity = world.createEntity();
  if (def.airlock) world.add(entity, AirlockC, {state:'toInner',timer:Math.round((def.airlock.cycleSec*TICK_HZ)/2),request:null});
  // Tiered engines intentionally share Mk I art (the game draws a coloured
  // tier outline over the larger footprint). Retain Mk I art at the origin.
  const tb = def.tierArt ? def.tierArt.base : null;
  const layerDef = tb ? {...def,footprint:tb} : def;
  let picked;
  try {
    picked = layersOf(world,entity,m,layerDef,{active:false,now:0,airlock:{level:'up',roofed:false,collar:null},bay:steady(true)});
  } finally {
    world.destroyEntity(entity);
  }
  const layers: Layer[] = [];
  for (const layer of picked) {
    if (layer.optional) continue;
    const match = firstStatic(layer.chain);
    if (!match) continue;
    const {asset}=match;
    try {
      const tile = layer.at ?? {x: (tb?.[0] ?? w)-1,y:(tb?.[1] ?? h)-1};
      const center = iso(tile.x,tile.y);
      layers.push({
        left:center.x - asset.anchor.x*mult,
        top:center.y - asset.anchor.y*mult,
        w:asset.frame.w*mult,
        h:asset.frame.h*mult,
        png:await rawFrame(match.id,asset)
      });
    } catch (e) {
      console.warn('Preview layer omitted for '+id+': '+String(e));
    }
  }
  if (def.weapon || def.pointDefense) {
    const turretStem=def.asset.replace(/^module\./,'');
    const match=firstStatic(['turret.'+turretStem+'.d0','turret.'+turretStem+'.d0.charged']);
    if(match) {
      const center=iso((w-1)/2,(h-1)/2);
      try {
        layers.push({
          left:center.x-match.asset.anchor.x*mult,top:center.y-match.asset.anchor.y*mult,
          w:match.asset.frame.w*mult,h:match.asset.frame.h*mult,
          png:await rawFrame(match.id,match.asset)
        });
      } catch (e) { console.warn('Turret preview omitted '+id+': '+String(e)); }
    }
  }
  const front=iso(w-1,h-1);
  const bounds = layers.length ? {
    minX:Math.min(...layers.map(l=>l.left)), minY:Math.min(...layers.map(l=>l.top)),
    maxX:Math.max(...layers.map(l=>l.left+l.w)),maxY:Math.max(...layers.map(l=>l.top+l.h))
  } : null;
  const thumb=bounds?{
    w:bounds.maxX-bounds.minX,h:bounds.maxY-bounds.minY,
    ax:front.x-bounds.minX,ay:front.y-bounds.minY
  }:null;
  const access=def.access?{x:def.access[0],y:def.access[1]}:null;
  const g=previewGeometry(w,h,access,thumb,box);
  const polygon=(points:string,cls:string)=>'<polygon class="'+cls+'" points="'+points+'"/>';
  const svgLayers=g.sprite && bounds ? layers.map(l=>{
    const scale=g.sprite!.width/thumb!.w;
    const x=g.sprite!.left+(l.left-bounds.minX)*scale;
    const y=g.sprite!.top+(l.top-bounds.minY)*scale;
    return '<image x="'+number(x)+'" y="'+number(y)+'" width="'+number(l.w*scale)+'" height="'+number(l.h*scale)+'" href="data:image/png;base64,'+l.png+'" style="image-rendering:pixelated" preserveAspectRatio="none"/>';
  }).join(''): '';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">'
    +'<rect width="300" height="200" fill="#070b11"/>'
    +'<g stroke="#29313b" stroke-width="0.8" fill="none">'+g.grid.map(p=>polygon(p,'grid')).join('')+'</g>'
    +'<g stroke="#36d4ff" stroke-width="1.15" fill="#143341" fill-opacity=".65">'+g.foot.map(p=>polygon(p,'foot')).join('')+'</g>'
    +(g.access?'<polygon points="'+g.access+'" stroke="#f0b13a" stroke-width="1.1" stroke-dasharray="4 3" fill="#f0b13a" fill-opacity=".12"/>':'')
    +svgLayers
    +(g.accessLabel?'<text x="'+number(g.accessLabel.x)+'" y="'+number(g.accessLabel.y)+'" text-anchor="middle" fill="#f0b13a" stroke="#05080d" stroke-width="2.5" paint-order="stroke" font-family="sans-serif" font-weight="700" font-size="9">USE</text>':'')
    +(!layers.length?'<text x="150" y="185" text-anchor="middle" fill="#8290a0" font-family="sans-serif" font-size="9">ARTWORK PENDING</text>':'')
    +'</svg>';
  const name=slug(id)+'.png';
  await sharp(Buffer.from(svg)).resize(600,400,{kernel:'nearest'}).png({compressionLevel:9}).toFile(join(dest,name));
  result[id]={url:urlPrefix+name,art:layers.length>0,layers:layers.length,placeholder:!!def.tierArt};
  if(layers.length){withArt++;if(layers.length>1)multi++;totalLayers+=layers.length;}else blank++;
}
await mkdir(join(root,'src/data/generated'),{recursive:true});
await writeFile(join(root,'src/data/generated/previews.json'),JSON.stringify(result,null,2)+'\n');
console.log('Placement previews: '+Object.keys(result).length+' modules; '+withArt+' with actual atlas art ('+multi+' composite), '+blank+' footprint-only; '+totalLayers+' layers total.');
