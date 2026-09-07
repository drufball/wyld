import * as THREE from 'three';

import type { Input } from '../engine/input.js';

type Stance = 'walk' | 'sprint' | 'crouch';

type PlayerControllerOptions = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  input: Input;
  heightAt(x: number, z: number): number;
  slopeAt?(x: number, z: number): number;
  canStandAt?(x: number, z: number): boolean;
  canMove?: () => boolean;
};

const cameraPivot = new THREE.Vector3();
const cameraDesired = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const cameraSample = new THREE.Vector3();

const createBody = (): THREE.Group => {
  const body = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({
    color: 0x315c54,
    roughness: 0.9,
    flatShading: true,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: 0xc98962,
    roughness: 0.9,
    flatShading: true,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x263234,
    roughness: 0.95,
    flatShading: true,
  });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.65, 4, 8), cloth);
  torso.position.y = 1;
  body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), skin);
  head.position.y = 1.58;
  body.add(head);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.5, 3, 6), skin);
    arm.position.set(side * 0.34, 1.02, 0);
    body.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.58, 3, 6), dark);
    leg.position.set(side * 0.14, 0.39, 0);
    body.add(leg);
  }
  body.traverse((object) => {
    if (object instanceof THREE.Mesh) object.castShadow = true;
  });
  return body;
};

const createPlayerController = (options: PlayerControllerOptions) => {
  const { camera, input, heightAt } = options;
  const canStandAt = options.canStandAt ?? (() => true);
  const canMove = options.canMove ?? (() => true);
  const object = createBody();
  options.scene.add(object);
  let stance: Stance = 'walk';
  let yaw = 0;
  let pitch = 0.3;
  const cameraDistance = 6;
  const movement = new THREE.Vector3();

  const placeCamera = (): void => {
    const pivotHeight = stance === 'crouch' ? 1.05 : 1.45;
    const pivot = cameraPivot.set(
      object.position.x,
      object.position.y + pivotHeight,
      object.position.z,
    );
    const horizontal = Math.cos(pitch) * cameraDistance;
    const desired = cameraDesired.set(
      pivot.x + Math.sin(yaw) * horizontal,
      pivot.y + Math.sin(pitch) * cameraDistance,
      pivot.z + Math.cos(yaw) * horizontal,
    );
    const direction = cameraDirection.copy(desired).sub(pivot);
    let safeFraction = 1;
    for (let index = 1; index <= 24; index += 1) {
      const fraction = index / 24;
      const sample = cameraSample.copy(pivot).addScaledVector(direction, fraction);
      if (sample.y < heightAt(sample.x, sample.z) + 0.25) {
        safeFraction = Math.max(4 / cameraDistance, (index - 1) / 24);
        break;
      }
    }
    camera.position.copy(pivot).addScaledVector(direction, safeFraction);
    camera.position.y = Math.max(
      camera.position.y,
      heightAt(camera.position.x, camera.position.z) + 0.25,
    );
    camera.lookAt(pivot);
  };

  const update = (dtSeconds: number): void => {
    if (input.wasPressed('KeyC') && canMove()) stance = stance === 'crouch' ? 'walk' : 'crouch';
    const mouse = input.mouseDelta();
    if (canMove()) {
      yaw -= mouse.x * 0.0025;
      pitch = THREE.MathUtils.clamp(
        pitch + mouse.y * 0.0025,
        -THREE.MathUtils.degToRad(70),
        THREE.MathUtils.degToRad(70),
      );
      const forward = Number(input.isDown('KeyW')) - Number(input.isDown('KeyS'));
      const right = Number(input.isDown('KeyD')) - Number(input.isDown('KeyA'));
      movement.set(
        -Math.sin(yaw) * forward + Math.cos(yaw) * right,
        0,
        -Math.cos(yaw) * forward - Math.sin(yaw) * right,
      );
      if (movement.lengthSq() > 0) {
        movement.normalize();
        const sprinting =
          stance !== 'crouch' && (input.isDown('ShiftLeft') || input.isDown('ShiftRight'));
        stance = stance === 'crouch' ? 'crouch' : sprinting ? 'sprint' : 'walk';
        const speed = stance === 'crouch' ? 1.8 : stance === 'sprint' ? 6 : 3.5;
        const x = object.position.x + movement.x * speed * dtSeconds;
        const z = object.position.z + movement.z * speed * dtSeconds;
        if (canStandAt(x, z)) {
          object.position.set(x, heightAt(x, z), z);
          object.rotation.y = Math.atan2(movement.x, movement.z);
        }
      } else if (stance === 'sprint') stance = 'walk';
    }
    object.scale.y = THREE.MathUtils.lerp(
      object.scale.y,
      stance === 'crouch' ? 0.7 : 1,
      Math.min(1, dtSeconds * 12),
    );
    placeCamera();
  };

  object.position.y = heightAt(0, 0);
  placeCamera();
  return {
    object,
    update,
    get stance(): Stance {
      return stance;
    },
  };
};

export { createPlayerController };
export type { PlayerControllerOptions, Stance };
