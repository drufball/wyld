import * as THREE from 'three';

type SkyColour = { r: number; g: number; b: number };
type SkyState = {
  background: SkyColour;
  fog: SkyColour;
  sunColour: SkyColour;
  sunIntensity: number;
  hemisphereIntensity: number;
  fogNear: number;
  fogFar: number;
  sunDirection: { x: number; y: number; z: number };
};

const keys: readonly SkyState[] = [
  {
    background: { r: 0.69, g: 0.55, b: 0.48 },
    fog: { r: 0.66, g: 0.54, b: 0.47 },
    sunColour: { r: 1, g: 0.55, b: 0.28 },
    sunIntensity: 1.5,
    hemisphereIntensity: 1.25,
    fogNear: 120,
    fogFar: 500,
    sunDirection: { x: -0.75, y: 0.18, z: 0.35 },
  },
  {
    background: { r: 0.55, g: 0.72, b: 0.78 },
    fog: { r: 0.6, g: 0.74, b: 0.74 },
    sunColour: { r: 1, g: 0.94, b: 0.76 },
    sunIntensity: 3,
    hemisphereIntensity: 2.2,
    fogNear: 180,
    fogFar: 720,
    sunDirection: { x: -0.15, y: 0.95, z: -0.25 },
  },
  {
    background: { r: 0.62, g: 0.39, b: 0.35 },
    fog: { r: 0.57, g: 0.4, b: 0.37 },
    sunColour: { r: 1, g: 0.42, b: 0.2 },
    sunIntensity: 1.35,
    hemisphereIntensity: 1.05,
    fogNear: 115,
    fogFar: 460,
    sunDirection: { x: 0.78, y: 0.15, z: 0.3 },
  },
  {
    background: { r: 0.055, g: 0.085, b: 0.15 },
    fog: { r: 0.07, g: 0.11, b: 0.18 },
    sunColour: { r: 0.55, g: 0.68, b: 1 },
    sunIntensity: 0.7,
    hemisphereIntensity: 0.62,
    fogNear: 75,
    fogFar: 330,
    sunDirection: { x: 0.25, y: 0.58, z: -0.75 },
  },
];
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const colour = (a: SkyColour, b: SkyColour, t: number): SkyColour => ({
  r: lerp(a.r, b.r, t),
  g: lerp(a.g, b.g, t),
  b: lerp(a.b, b.b, t),
});
const skyAt = (normalisedDayTime: number): SkyState => {
  const wrapped = ((normalisedDayTime % 1) + 1) % 1;
  const scaled = wrapped * 4;
  const index = Math.floor(scaled);
  const t = scaled - index;
  const a = keys[index] ?? keys[0]!;
  const b = keys[(index + 1) % 4] ?? keys[0]!;
  const direction = {
    x: lerp(a.sunDirection.x, b.sunDirection.x, t),
    y: lerp(a.sunDirection.y, b.sunDirection.y, t),
    z: lerp(a.sunDirection.z, b.sunDirection.z, t),
  };
  const length = Math.hypot(direction.x, direction.y, direction.z);
  return {
    background: colour(a.background, b.background, t),
    fog: colour(a.fog, b.fog, t),
    sunColour: colour(a.sunColour, b.sunColour, t),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    hemisphereIntensity: lerp(a.hemisphereIntensity, b.hemisphereIntensity, t),
    fogNear: lerp(a.fogNear, b.fogNear, t),
    fogFar: lerp(a.fogFar, b.fogFar, t),
    sunDirection: { x: direction.x / length, y: direction.y / length, z: direction.z / length },
  };
};

const createSky = (
  scene: THREE.Scene,
  sun: THREE.DirectionalLight,
  hemisphere: THREE.HemisphereLight,
) => {
  const background = new THREE.Color();
  scene.background = background;

  return {
    update(dayProgress: number): SkyState['sunDirection'] {
      const state = skyAt(dayProgress);
      background.setRGB(
        state.background.r,
        state.background.g,
        state.background.b,
        THREE.SRGBColorSpace,
      );
      if (!(scene.fog instanceof THREE.Fog))
        scene.fog = new THREE.Fog(0, state.fogNear, state.fogFar);
      scene.fog.color.setRGB(state.fog.r, state.fog.g, state.fog.b, THREE.SRGBColorSpace);
      scene.fog.near = state.fogNear;
      scene.fog.far = state.fogFar;
      sun.color.setRGB(
        state.sunColour.r,
        state.sunColour.g,
        state.sunColour.b,
        THREE.SRGBColorSpace,
      );
      sun.intensity = state.sunIntensity;
      hemisphere.intensity = state.hemisphereIntensity;
      return state.sunDirection;
    },
  };
};

export { createSky, skyAt };
export type { SkyColour, SkyState };
