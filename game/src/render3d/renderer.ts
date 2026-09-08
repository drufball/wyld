import * as THREE from 'three';
import { speciesById } from '../creatures/species.js';
import { pixelScale, screenCols, screenRows } from '../render2d/canvas.js';
import type { Facing } from '../player/controller.js';
import type { TileGrid } from '../world/tiles.js';
import type { TracksPlacement } from '../world/tracks.js';
import type { Phase } from '../world/time.js';
import { cameraOffset, cameraTarget, orthoFrustum, pickTileFromNdc } from './camera.js';
import { createCover } from './cover.js';
import { TIER_LENGTH_TILES } from './bodyplans/index.js';
import { createCreatureModels } from './creatures.js';
import { createEyeOverlay } from './eye-overlay.js';
import {
  ambientColourAt,
  ambientIntensityAt,
  skyAt,
  sunColourAt,
  sunIntensityAt,
  surfacePaletteAt,
  surfacePaletteKey,
} from './palette-bridge.js';
import { createSlabs } from './tiles.js';
import { createPlayerModel } from './player-model.js';
import { createSelection } from './selection.js';
import { createTrackDecals } from './tracks.js';
type Sliding = {
  from: { sx: number; sy: number };
  to: { sx: number; sy: number };
  progress: number;
} | null;
type DioramaBody = {
  key: string;
  speciesId: string;
  tileX: number;
  tileY: number;
  facing: number;
  state: 'idle' | 'walk' | 'execute';
  phaseOffset: number;
  meter?: number;
};
type DioramaFrame = {
  screen: { x: number; y: number };
  sliding: Sliding;
  phase: Phase;
  phaseProgress: number;
  elapsedSeconds: number;
  alpha: number;
  player: { tileX: number; tileY: number; facing: Facing; moving: boolean };
  creatures: readonly DioramaBody[];
  party: readonly DioramaBody[];
  selection: string;
};
const createDiorama = (grid: TileGrid, trackPlacements: readonly TracksPlacement[]) => {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:0';
  document.body.append(canvas);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene(),
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400),
    sun = new THREE.DirectionalLight(),
    ambient = new THREE.AmbientLight();
  scene.add(sun, ambient, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  const slabs = createSlabs(grid, scene),
    cover = createCover(grid, scene),
    tracks = createTrackDecals(scene),
    creatures = createCreatureModels(scene),
    player = createPlayerModel(),
    eyes = createEyeOverlay(),
    selection = createSelection(scene);
  scene.add(player.group);
  let scale = 2,
    cols = 8,
    rows = 8,
    target = { x: 0, z: 0 },
    frustum = { halfWidth: 1, halfHeight: 1 },
    built = '',
    coloured = '';
  const times: number[] = [];
  const resize = () => {
    scale = pixelScale(innerWidth, innerHeight);
    cols = screenCols(innerWidth, scale);
    rows = screenRows(innerHeight, scale);
    renderer.setSize(innerWidth, innerHeight);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
  };
  resize();
  addEventListener('resize', resize);
  const render = (frame: DioramaFrame) => {
    const started = performance.now();
    target = cameraTarget(frame.screen, frame.sliding, cols, rows);
    frustum = orthoFrustum(cols, rows);
    camera.left = -frustum.halfWidth;
    camera.right = frustum.halfWidth;
    camera.top = frustum.halfHeight;
    camera.bottom = -frustum.halfHeight;
    const offset = cameraOffset(200);
    camera.position.set(target.x + offset.x, offset.y, target.z + offset.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(target.x, 0, target.z);
    camera.updateProjectionMatrix();
    const screens = frame.sliding
      ? [
          { x: frame.sliding.from.sx, y: frame.sliding.from.sy },
          { x: frame.sliding.to.sx, y: frame.sliding.to.sy },
        ]
      : [frame.screen];
    const buildKey = `${screens.map((s) => `${s.x},${s.y}`).join('|')}:${cols}:${rows}`;
    if (buildKey !== built) {
      slabs.build(screens, cols, rows);
      cover.build(screens, cols, rows);
      tracks.build(trackPlacements, screens, cols, rows);
      built = buildKey;
      coloured = '';
      const size = Math.max(cols, rows) / 2 + 2,
        shadow = sun.shadow.camera as THREE.OrthographicCamera;
      shadow.left = -size;
      shadow.right = size;
      shadow.top = size;
      shadow.bottom = -size;
      shadow.near = 1;
      shadow.far = 200;
      shadow.updateProjectionMatrix();
    }
    const key = surfacePaletteKey(frame.phase, frame.phaseProgress);
    if (key !== coloured) {
      const palette = surfacePaletteAt(frame.phase, frame.phaseProgress);
      slabs.recolour(palette);
      cover.recolour(palette);
      coloured = key;
    }
    scene.background = skyAt(frame.phase, frame.phaseProgress);
    sun.color.copy(sunColourAt(frame.phase, frame.phaseProgress));
    sun.intensity = sunIntensityAt(frame.phase, frame.phaseProgress);
    ambient.color.copy(ambientColourAt(frame.phase, frame.phaseProgress));
    ambient.intensity = ambientIntensityAt(frame.phase, frame.phaseProgress);
    sun.position.set(target.x - 33, 43.2, target.z + 25.2);
    sun.target.position.set(target.x, 0, target.z);
    sun.target.updateMatrixWorld();
    player.group.position.set(frame.player.tileX, 0, frame.player.tileY);
    player.face(frame.player.facing);
    player.animate(frame.elapsedSeconds, frame.player.moving);
    const bodies = [...frame.creatures, ...frame.party];
    creatures.sync(bodies, frame.elapsedSeconds);
    eyes.sync(
      frame.creatures
        .filter(({ meter }) => (meter ?? 0) > 0)
        .map((entry) => ({
          key: entry.key,
          tileX: entry.tileX,
          tileY: entry.tileY,
          headHeight: TIER_LENGTH_TILES[speciesById(entry.speciesId)!.tier] * 0.6,
          meter: entry.meter ?? 0,
        })),
      target,
      frustum,
      canvas.getBoundingClientRect(),
    );
    selection.sync(frame.party.find(({ key }) => key === frame.selection) ?? null);
    renderer.render(scene, camera);
    const elapsed = performance.now() - started;
    times.push(elapsed);
    if (times.length > 120) times.shift();
    const info = renderer.info.render;
    return { drawCalls: info.calls, triangles: info.triangles, frameMs: elapsed };
  };
  const perf = () => {
    const sorted = [...times].sort((a, b) => a - b);
    return {
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      frameMs: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
    };
  }; // Triangle count includes the shadow pass.
  return {
    canvas,
    get scale() {
      return scale;
    },
    get cols() {
      return cols;
    },
    get rows() {
      return rows;
    },
    render,
    perf,
    screenshot: () => canvas.toDataURL('image/jpeg', 0.6),
    pickTile(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      return pickTileFromNdc(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((clientY - rect.top) / rect.height) * 2,
        target,
        frustum,
      );
    },
    dispose() {
      removeEventListener('resize', resize);
      slabs.dispose();
      cover.dispose();
      tracks.dispose();
      creatures.dispose();
      player.dispose();
      eyes.dispose();
      selection.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
};
export { createDiorama };
export type { DioramaBody, DioramaFrame };
