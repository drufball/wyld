import * as THREE from 'three';

import { buildState, cameraPosition } from './state.js';

document.documentElement.style.cssText = 'height:100%;background:#10131c';
document.body.style.cssText = 'height:100%;margin:0;overflow:hidden;background:#10131c';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10131c);
scene.fog = new THREE.Fog(0x10131c, 8, 18);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 50);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(8, 12),
  new THREE.MeshStandardMaterial({ color: 0x283e38, roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const creature = new THREE.Group();
const green = new THREE.MeshStandardMaterial({ color: 0x7ccf70, roughness: 0.75 });
const cream = new THREE.MeshStandardMaterial({ color: 0xe8dca8, roughness: 0.85 });
const dark = new THREE.MeshStandardMaterial({ color: 0x171922, roughness: 0.7 });

const body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), green);
body.scale.set(1, 0.82, 1.2);
body.position.y = 1.25;
creature.add(body);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), cream);
head.position.set(0, 1.85, 0.72);
creature.add(head);

for (const side of [-1, 1]) {
  const ear = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.75, 4), green);
  ear.position.set(side * 0.45, 2.55, 0.65);
  ear.rotation.z = side * -0.28;
  creature.add(ear);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), dark);
  eye.position.set(side * 0.24, 2.02, 1.32);
  creature.add(eye);

  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.65, 0.4), green);
  leg.position.set(side * 0.55, 0.45, 0.25);
  creature.add(leg);
}

creature.traverse((object) => {
  if (object instanceof THREE.Mesh) object.castShadow = true;
});
scene.add(creature);

scene.add(new THREE.HemisphereLight(0xbad8ff, 0x29402d, 2.2));
const sun = new THREE.DirectionalLight(0xffedc2, 3.2);
sun.position.set(4, 7, 5);
sun.castShadow = true;
scene.add(sun);

const clock = new THREE.Clock();
let elapsedSeconds = 0;

const renderFrame = (): void => {
  const position = cameraPosition(elapsedSeconds);
  camera.position.set(position.x, position.y, position.z);
  camera.lookAt(0, 1.2, 0);
  creature.position.y = Math.sin(elapsedSeconds * 1.5) * 0.08;
  creature.rotation.y = Math.sin(elapsedSeconds * 0.45) * 0.25;
  renderer.render(scene, camera);
};

const animate = (): void => {
  elapsedSeconds = clock.getElapsedTime();
  renderFrame();
  window.requestAnimationFrame(animate);
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__wyld = {
  getState: () => buildState(__GAME_VERSION__, elapsedSeconds, camera.position),
  screenshot: () => {
    renderFrame();
    return renderer.domElement.toDataURL('image/jpeg', 0.6);
  },
};

animate();
