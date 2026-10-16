import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFShadowMap,
  PointLight,
  Scene,
  WebGLRenderer,
} from 'three';
import type { Sim } from '../sim';

export type Quality = 'high' | 'low';

/** Read-only window onto the sim; the renderer never writes through it. */
export type SimView = Readonly<Pick<Sim, 'tick' | 'grids'>> & { readonly world: Readonly<Pick<Sim['world'], 'entityCount'>> };

export interface Renderer {
  render(alpha: number): void;
  resize(): void;
  dispose(): void;
}

const PITCH = Math.atan(1 / Math.SQRT2); // 35.264 degrees
const VIEW_TILES = 9; // visible world height at zoom 1

export function createRenderer(canvas: HTMLCanvasElement, sim: SimView, quality: Quality = 'high'): Renderer {
  const high = quality === 'high';
  const renderer = new WebGLRenderer({ canvas, antialias: high, powerPreference: 'high-performance' });
  renderer.setClearColor(new Color(0x070b12));
  renderer.shadowMap.enabled = high;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const dist = 40;
  camera.position.set(
    dist * Math.cos(PITCH) * Math.sin(Math.PI / 4),
    dist * Math.sin(PITCH),
    dist * Math.cos(PITCH) * Math.cos(Math.PI / 4),
  );
  camera.lookAt(0, 0, 0);

  scene.add(new AmbientLight(0x3a4a6a, 0.6));
  scene.add(new HemisphereLight(0x6f8fc8, 0x10141c, 0.5));
  const sun = new DirectionalLight(0x9fb4e0, 0.7);
  sun.position.set(-8, 14, 6);
  sun.castShadow = high;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
  scene.add(sun);

  const tileGeo = new BoxGeometry(0.96, 0.2, 0.96);
  const tileMat = new MeshStandardMaterial({ color: 0x1a2232, roughness: 0.9 });
  for (let x = -3; x <= 3; x++) {
    for (let z = -3; z <= 3; z++) {
      const tile = new Mesh(tileGeo, tileMat);
      tile.position.set(x, -0.1, z);
      tile.receiveShadow = true;
      scene.add(tile);
    }
  }
  const cubeGeo = new BoxGeometry(0.8, 0.8, 0.8);
  const cubeMat = new MeshStandardMaterial({ color: 0x0a3a44, emissive: 0x22d3ee, emissiveIntensity: 1.4 });
  const cube = new Mesh(cubeGeo, cubeMat);
  cube.position.set(0, 0.4, 0);
  cube.castShadow = high;
  scene.add(cube);
  const glow = new PointLight(0x22d3ee, 6, 6);
  glow.position.set(0, 1.2, 0);
  scene.add(glow);

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.left = (-VIEW_TILES * aspect) / 2;
    camera.right = (VIEW_TILES * aspect) / 2;
    camera.top = VIEW_TILES / 2;
    camera.bottom = -VIEW_TILES / 2;
    camera.updateProjectionMatrix();
  }
  resize();

  return {
    render() {
      cube.position.y = 0.4 + Math.sin(sim.tick / 10) * 0.05;
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      tileGeo.dispose();
      tileMat.dispose();
      cubeGeo.dispose();
      cubeMat.dispose();
      renderer.dispose();
    },
  };
}
