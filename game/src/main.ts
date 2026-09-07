import * as THREE from 'three';

import { createInput } from './engine/input.js';
import { createEventBus } from './engine/events.js';
import { createLoop } from './engine/loop.js';
import { createRng, resolveSeed } from './engine/rng.js';
import { createPlayerController } from './player/controller.js';
import { buildState } from './state.js';
import { createDebugConsole } from './ui/debug.js';
import { createHud } from './ui/hud.js';
import { createStatsPanel } from './ui/stats.js';
import { camps, pointToRegion } from './world/regions.js';
import { createProps, placeProps } from './world/props.js';
import worldData from './data/world.json';
import { createSky } from './world/sky.js';
import { nextPhaseStart, phaseBoundariesBetween, phases, timeAt } from './world/time.js';
import { createTerrain, isSlopeStandable } from './world/terrain.js';
import { createWater, isWaterStandable } from './world/water.js';
import type { Phase } from './world/time.js';

document.documentElement.style.cssText = 'height:100%;background:#a9c9c1';
document.body.style.cssText = 'height:100%;margin:0;overflow:hidden;background:#a9c9c1';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa9c9c1);
scene.fog = new THREE.Fog(0xa9c9c1, 180, 720);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);

const hemisphere = new THREE.HemisphereLight(0xcfe7ff, 0x3a4b31, 2.2);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight(0xffefd0, 3);
sun.position.set(30, 55, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const shadowExtent = 60;
sun.shadow.camera.left = -shadowExtent;
sun.shadow.camera.right = shadowExtent;
sun.shadow.camera.top = shadowExtent;
sun.shadow.camera.bottom = -shadowExtent;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 140;
sun.shadow.bias = -0.0004;
scene.add(sun);

const gameRng = createRng(resolveSeed());
const seed = gameRng.seed();
const terrain = createTerrain(seed);
scene.add(terrain.group);
const water = createWater(terrain.heightAt);
scene.add(water.group);
const props = createProps(
  placeProps({
    rng: gameRng,
    heightAt: terrain.heightAt,
    slopeAt: terrain.slopeAt,
    depthAt: water.depthAt,
    biomeWeightsAt: terrain.biomeWeightsAt,
    densities: worldData.props,
    bounds: { minX: -400, maxX: 400, minZ: -400, maxZ: 400 },
  }),
);
scene.add(props);
const sky = createSky(scene, sun, hemisphere);
const debugConsole = createDebugConsole({ seed });
const hud = createHud(debugConsole.available);
const statsPanel = createStatsPanel(debugConsole.available);
const events = createEventBus<{ phaseChanged: { phase: Phase; day: number } }>();
const input = createInput(renderer.domElement);
const player = createPlayerController({
  scene,
  camera,
  input,
  heightAt: terrain.heightAt,
  slopeAt: terrain.slopeAt,
  canStandAt: (x, z) =>
    Math.abs(x) <= 400 &&
    Math.abs(z) <= 400 &&
    isSlopeStandable(terrain.slopeAt(x, z)) &&
    isWaterStandable(water.depthAt(x, z)),
  canMove: () => !debugConsole.isOpen,
  start: { x: -150, z: 50 },
});
let elapsedSeconds = 0;

const setElapsedSeconds = (next: number): void => {
  for (const boundary of phaseBoundariesBetween(elapsedSeconds, next))
    events.emit('phaseChanged', { phase: boundary.phase, day: boundary.day });
  elapsedSeconds = next;
};
debugConsole.registerCommand('time', {
  help: 'jump to the next Dawn, Day, Dusk, or Night',
  run: (args) => {
    const requested = args
      .join(' ')
      .replace(/^['"]|['"]$/g, '')
      .toLowerCase();
    const phase = phases.find((entry) => entry.toLowerCase() === requested);
    if (!phase) return `valid phases: ${phases.join(', ')}`;
    setElapsedSeconds(nextPhaseStart(elapsedSeconds, phase));
    return `time: ${phase}, day ${timeAt(elapsedSeconds).day}`;
  },
});
debugConsole.registerCommand('tp', {
  help: 'teleport to a named camp',
  run: (args) => {
    const requested = args
      .join(' ')
      .replace(/^['"]|['"]$/g, '')
      .toLowerCase();
    const camp = camps().find((entry) => entry.name.toLowerCase() === requested);
    if (!camp)
      return `camps: ${camps()
        .map(({ name }) => name)
        .join(', ')}`;
    player.teleport(camp.x, camp.z);
    return `teleported: ${camp.name}`;
  },
});

const render = (): void => {
  renderer.render(scene, camera);
  statsPanel.afterRender(renderer);
};
const loop = createLoop({
  update: (dtSeconds) => {
    setElapsedSeconds(elapsedSeconds + dtSeconds);
    player.update(dtSeconds);
    const region = pointToRegion(player.object.position.x, player.object.position.z);
    const clock = timeAt(elapsedSeconds);
    sky.update(clock.dayProgress);
    sun.target.position.set(player.object.position.x, 0, player.object.position.z);
    sun.position.set(
      player.object.position.x + 30,
      player.object.position.y + 55,
      player.object.position.z + 25,
    );
    sun.target.updateMatrixWorld();
    hud.update({
      ...clock,
      regionName: region?.name ?? null,
      biome: terrain.biomeAt(player.object.position.x, player.object.position.z),
    });
    input.endFrame();
  },
  render,
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__wyld = {
  getState: () =>
    buildState({
      version: __GAME_VERSION__,
      elapsedSeconds,
      camera: camera.position,
      player: player.object.position,
      seed,
      stance: player.stance,
      region: pointToRegion(player.object.position.x, player.object.position.z)?.id ?? null,
      biome: terrain.biomeAt(player.object.position.x, player.object.position.z),
      ...timeAt(elapsedSeconds),
      waterDepth: water.depthAt(player.object.position.x, player.object.position.z),
    }),
  screenshot: () => {
    render();
    return renderer.domElement.toDataURL('image/jpeg', 0.6);
  },
  debug: debugConsole.run,
  perf: statsPanel.read,
};

loop.start();
