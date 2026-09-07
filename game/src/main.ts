import * as THREE from 'three';

import { createInput } from './engine/input.js';
import { createLoop } from './engine/loop.js';
import { createRng, resolveSeed } from './engine/rng.js';
import { createPlayerController } from './player/controller.js';
import { buildState } from './state.js';
import { createDebugConsole } from './ui/debug.js';

document.documentElement.style.cssText = 'height:100%;background:#a9c9c1';
document.body.style.cssText = 'height:100%;margin:0;overflow:hidden;background:#a9c9c1';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa9c9c1);
scene.fog = new THREE.Fog(0xa9c9c1, 90, 350);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(800, 800),
  new THREE.MeshStandardMaterial({ color: 0x64805a, roughness: 1, flatShading: true }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

scene.add(new THREE.HemisphereLight(0xcfe7ff, 0x3a4b31, 2.2));
const sun = new THREE.DirectionalLight(0xffefd0, 3);
sun.position.set(30, 55, 25);
sun.castShadow = true;
scene.add(sun);

const gameRng = createRng(resolveSeed());
const seed = gameRng.seed();
const debugConsole = createDebugConsole({ seed });
const input = createInput(renderer.domElement);
const player = createPlayerController({
  scene,
  camera,
  input,
  heightAt: () => 0,
  canMove: () => !debugConsole.isOpen,
});
let elapsedSeconds = 0;

const render = (): void => renderer.render(scene, camera);
const loop = createLoop({
  update: (dtSeconds) => {
    elapsedSeconds += dtSeconds;
    player.update(dtSeconds);
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
    }),
  screenshot: () => {
    render();
    return renderer.domElement.toDataURL('image/jpeg', 0.6);
  },
  debug: debugConsole.run,
};

loop.start();
