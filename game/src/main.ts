import * as THREE from 'three';

import { createCallAudio } from './audio/calls.js';
import { hasCover, reactionFor, stepDetection, visionRange } from './creatures/ai.js';
import type { Behaviour, PropObstacle } from './creatures/ai.js';
import { createInput } from './engine/input.js';
import { createEventBus } from './engine/events.js';
import { createLoop } from './engine/loop.js';
import { createRng, resolveSeed } from './engine/rng.js';
import { roll } from './creatures/individual.js';
import { createCreatureRegistry, spawnPoint } from './creatures/registry.js';
import type { SpawnedCreature } from './creatures/registry.js';
import { createSpawnSystem } from './creatures/spawn.js';
import { createWander } from './creatures/wander.js';
import { isEligible, species, speciesById } from './creatures/species.js';
import type { CreatureState } from './creatures/bodyplans/types.js';
import type { Temperament } from './creatures/species.js';
import { createPlayerController } from './player/controller.js';
import { buildState } from './state.js';
import { createDebugConsole } from './ui/debug.js';
import { createHud } from './ui/hud.js';
import { createStatsPanel } from './ui/stats.js';
import { camps, pointToRegion, populationFor, regions } from './world/regions.js';
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
sun.shadow.camera.far = 260;
sun.shadow.bias = -0.0004;
scene.add(sun);

const gameRng = createRng(resolveSeed());
const seed = gameRng.seed();
// Independent streams keep frame-rate-dependent wandering and calls from perturbing spawns.
const spawnRng = createRng(seed ^ 0x5fa1);
const wanderRng = createRng(seed ^ 0x3b2d);
const callRng = createRng(seed ^ 0x0ca1);
const aiRng = createRng(seed ^ 0xa17e);
const terrain = createTerrain(seed);
scene.add(terrain.group);
const water = createWater(terrain.heightAt);
scene.add(water.group);
const registry = createCreatureRegistry({
  scene,
  heightAt: terrain.heightAt,
  depthAt: water.depthAt,
});
const propPlacements = placeProps({
  rng: gameRng,
  heightAt: terrain.heightAt,
  slopeAt: terrain.slopeAt,
  depthAt: water.depthAt,
  biomeWeightsAt: terrain.biomeWeightsAt,
  densities: worldData.props,
  bounds: { minX: -400, maxX: 400, minZ: -400, maxZ: 400 },
});
const propObstacles: PropObstacle[] = propPlacements
  .filter((placement) => placement.kind !== 'fern')
  .map(({ x, z, scale }) => ({ x, z, radius: scale * 0.5, height: scale * 2 }));
const props = createProps(propPlacements, camera);
scene.add(props);
const sky = createSky(scene, sun, hemisphere);
const debugConsole = createDebugConsole({ seed });
const hud = createHud(debugConsole.available);
const statsPanel = createStatsPanel(debugConsole.available);
type GameEvents = {
  phaseChanged: { phase: Phase; day: number };
  creatureCalled: { id: string; species: string; position: { x: number; y: number; z: number } };
};
const events = createEventBus<GameEvents>();
const eventLog: { kind: string; ts: number; payload: unknown }[] = [];
const record = (kind: keyof GameEvents, payload: GameEvents[keyof GameEvents]): void => {
  eventLog.push({ kind, ts: Date.now(), payload });
  if (eventLog.length > 200) eventLog.shift();
};
events.on('phaseChanged', (payload) => record('phaseChanged', payload));
events.on('creatureCalled', (payload) => record('creatureCalled', payload));
const callAudio = createCallAudio();
callAudio.resumeOnGesture(window);
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
const spawn = createSpawnSystem({
  world: {
    regions,
    populationFor,
    heightAt: terrain.heightAt,
    slopeAt: terrain.slopeAt,
    depthAt: water.depthAt,
  },
  host: registry,
  rng: spawnRng,
});
const wander = createWander(wanderRng);
const wanderStates = new Map<string, ReturnType<typeof wander.begin>>();
type CreatureAiState = { detection: number; behaviour: Behaviour; fleeUntil: number };
const creatureAi = new Map<string, CreatureAiState>();
const aiStateFor = (id: string): CreatureAiState => {
  let state = creatureAi.get(id);
  if (!state) {
    state = { detection: 0, behaviour: 'wander', fleeUntil: 0 };
    creatureAi.set(id, state);
  }
  return state;
};
const nextCalls = new Map<string, number>();
const initialiseWild = (ids: readonly string[]): void => {
  for (const id of ids) {
    const regionId = spawn.creatureRegion(id);
    const region = regions().find((entry) => entry.id === regionId);
    const creature = registry.get(id);
    if (region && creature)
      wanderStates.set(
        id,
        wander.begin(
          region.x,
          region.z,
          region.radius,
          elapsedSeconds,
          creature.model.group.rotation.y,
        ),
      );
    nextCalls.set(id, elapsedSeconds + callRng.range(10, 20));
    aiStateFor(id);
  }
};
events.on('phaseChanged', ({ phase }) => {
  const result = spawn.onPhaseChanged(phase, camera.position);
  initialiseWild(result.spawned);
  for (const id of result.despawned) {
    wanderStates.delete(id);
    nextCalls.delete(id);
    creatureAi.delete(id);
  }
});

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
const temperamentNames: readonly Temperament[] = ['Skittish', 'Bold', 'Steady', 'Erratic'];
debugConsole.registerCommand('spawn', {
  help: 'spawn <speciesId> [temperament] [lateralOffsetMetres] — 15 m ahead; positive offset is right',
  run: (args) => {
    const data = speciesById(args[0] ?? '');
    if (!data)
      return `valid species: ${species()
        .map(({ id }) => id)
        .join(', ')}`;
    const requestedTemperament = args[1];
    const temperament = requestedTemperament
      ? temperamentNames.find((entry) => entry.toLowerCase() === requestedTemperament.toLowerCase())
      : undefined;
    if (requestedTemperament && !temperament)
      return `valid temperaments: ${temperamentNames.join(', ')}`;
    const lateral = args[2] === undefined ? 0 : Number(args[2]);
    if (!Number.isFinite(lateral)) return 'lateralOffsetMetres must be a number';
    const point = spawnPoint(player.object.position, player.object.quaternion, 15, lateral);
    const rolled = roll(data, gameRng);
    const individual = temperament ? { ...rolled, temperament } : rolled;
    const facing = Math.atan2(
      player.object.position.x - point.x,
      player.object.position.z - point.z,
    );
    const creature = registry.add(individual, point.x, point.z, facing);
    aiStateFor(creature.id);
    wanderStates.set(
      creature.id,
      wander.begin(point.x, point.z, 30, elapsedSeconds, creature.model.group.rotation.y),
    );
    return `${creature.speciesId} ${creature.temperament} ${creature.id}`;
  },
});
const creatureStates: readonly CreatureState[] = ['idle', 'locomotion', 'execute'];
debugConsole.registerCommand('state', {
  help: 'state <creatureId> <idle|locomotion|execute>',
  run: ([id = '', requested = '']) => {
    const creature = registry.get(id);
    if (!creature)
      return `unknown creature: ${id || '(missing)'}; spawned: ${
        registry
          .list()
          .map(({ id: creatureId }) => creatureId)
          .join(', ') || 'none'
      }`;
    const state = creatureStates.find((entry) => entry === requested.toLowerCase());
    if (!state) return `valid states: ${creatureStates.join(', ')}`;
    registry.setState(id, state);
    return `${id}: ${state}`;
  },
});
debugConsole.registerCommand('creatures', {
  help: 'list live creatures',
  run: () =>
    registry
      .list()
      .map((creature) => {
        const region = pointToRegion(creature.position.x, creature.position.z)?.id ?? null;
        const distance = creature.position.distanceTo(player.object.position);
        return `${creature.id} ${creature.speciesId} ${region ?? 'none'} ${distance.toFixed(1)}m ${creature.state}`;
      })
      .join('\n') || 'none',
});

const render = (): void => {
  renderer.render(scene, camera);
  statsPanel.afterRender(renderer);
};
const lastPlayerPosition = player.object.position.clone();
const canCreatureStand = (x: number, z: number, canSwim: boolean): boolean =>
  Math.abs(x) <= 400 &&
  Math.abs(z) <= 400 &&
  terrain.slopeAt(x, z) < 30 &&
  (canSwim || water.depthAt(x, z) <= 0);
const moveCreature = (
  creature: SpawnedCreature,
  dx: number,
  dz: number,
  canSwim: boolean,
): boolean => {
  const candidates = [
    { dx, dz },
    { dx, dz: 0 },
    { dx: 0, dz },
  ];
  for (const candidate of candidates) {
    if (candidate.dx === 0 && candidate.dz === 0) continue;
    const x = creature.position.x + candidate.dx;
    const z = creature.position.z + candidate.dz;
    if (!canCreatureStand(x, z, canSwim)) continue;
    creature.position.x = x;
    creature.position.z = z;
    creature.model.group.rotation.y = Math.atan2(candidate.dx, candidate.dz);
    return true;
  }
  return false;
};
const loop = createLoop({
  update: (dtSeconds) => {
    player.update(dtSeconds);
    setElapsedSeconds(elapsedSeconds + dtSeconds);
    const clock = timeAt(elapsedSeconds);
    const spawnResult = spawn.update(dtSeconds, clock.phase, camera.position);
    initialiseWild(spawnResult.spawned);
    for (const id of spawnResult.despawned) {
      wanderStates.delete(id);
      nextCalls.delete(id);
      creatureAi.delete(id);
    }
    const playerMoved = player.object.position.distanceToSquared(lastPlayerPosition) > 1e-8;
    lastPlayerPosition.copy(player.object.position);
    for (const creature of registry.list()) {
      const data = speciesById(creature.speciesId);
      if (!data) continue;
      const state = aiStateFor(creature.id);
      const dxFromPlayer = creature.position.x - player.object.position.x;
      const dzFromPlayer = creature.position.z - player.object.position.z;
      const distance = Math.hypot(dxFromPlayer, dzFromPlayer);
      const range = visionRange(creature.temperament);
      const covered = hasCover(
        {
          x: player.object.position.x,
          y: player.object.position.y + 1.6,
          z: player.object.position.z,
        },
        {
          x: creature.position.x,
          y: creature.position.y + (data.visual.height ?? 0) * 0.5,
          z: creature.position.z,
        },
        terrain.heightAt,
        propObstacles,
      );
      const previousDetection = state.detection;
      state.detection = stepDetection(
        state.detection,
        {
          distance,
          visionRange: range,
          stance: player.stance,
          moving: playerMoved,
          hasCover: covered,
        },
        dtSeconds,
      );
      if (state.behaviour === 'wander' && previousDetection < 1 && state.detection >= 1) {
        state.behaviour = reactionFor(creature.temperament, aiRng);
        if (state.behaviour === 'flee') state.fleeUntil = elapsedSeconds + aiRng.range(8, 12);
      }
    }
    for (const creature of registry.list()) {
      const { id } = creature;
      const data = speciesById(creature.speciesId);
      if (!data) continue;
      const state = aiStateFor(id);
      const dxFromPlayer = creature.position.x - player.object.position.x;
      const dzFromPlayer = creature.position.z - player.object.position.z;
      const distance = Math.hypot(dxFromPlayer, dzFromPlayer);
      const range = visionRange(creature.temperament);
      const speed = 3 + creature.individual.stats.speed * 0.6;
      const canSwim = data.innate.includes('Swim');
      if (state.behaviour === 'hold' && distance < 8) state.behaviour = 'aggro';
      if (state.behaviour === 'aggro' && distance > range) {
        state.behaviour = 'wander';
        state.detection = 0;
        wanderStates.set(
          id,
          wander.begin(
            creature.position.x,
            creature.position.z,
            30,
            elapsedSeconds,
            creature.model.group.rotation.y,
          ),
        );
      }
      if (state.behaviour === 'flee' && elapsedSeconds >= state.fleeUntil) {
        state.behaviour = 'wander';
        state.detection = 0;
        wanderStates.set(
          id,
          wander.begin(
            creature.position.x,
            creature.position.z,
            30,
            elapsedSeconds,
            creature.model.group.rotation.y,
          ),
        );
      }
      if (state.behaviour === 'hold' || (state.behaviour === 'aggro' && distance <= 3)) {
        creature.model.group.rotation.y = Math.atan2(-dxFromPlayer, -dzFromPlayer);
        registry.setState(id, 'idle');
      } else if ((state.behaviour === 'flee' || state.behaviour === 'aggro') && distance > 0) {
        const direction = state.behaviour === 'flee' ? 1 : -1;
        const travel = speed * dtSeconds * direction;
        const moving = moveCreature(
          creature,
          (dxFromPlayer / distance) * travel,
          (dzFromPlayer / distance) * travel,
          canSwim,
        );
        registry.setState(id, moving ? 'locomotion' : 'idle');
      } else {
        let wanderState = wanderStates.get(id);
        if (!wanderState) {
          wanderState = wander.begin(
            creature.position.x,
            creature.position.z,
            30,
            elapsedSeconds,
            creature.model.group.rotation.y,
          );
          wanderStates.set(id, wanderState);
        }
        const moved = wander.step(wanderState, creature.position, elapsedSeconds, dtSeconds, {
          speedStat: creature.individual.stats.speed,
          canSwim,
          depthAt: water.depthAt,
          slopeAt: terrain.slopeAt,
        });
        creature.position.x = moved.x;
        creature.position.z = moved.z;
        creature.model.group.rotation.y = moved.facing;
        registry.setState(id, moved.moving ? 'locomotion' : 'idle');
      }
      if (elapsedSeconds >= (nextCalls.get(id) ?? Number.POSITIVE_INFINITY)) {
        const regionId = spawn.creatureRegion(id);
        if (regionId && isEligible(data.id, regionId, clock.phase)) {
          const distance = creature.position.distanceTo(camera.position);
          if (distance <= 60) callAudio.play(data.call, distance <= 10 ? 1 : (60 - distance) / 50);
          events.emit('creatureCalled', {
            id,
            species: data.id,
            position: { x: creature.position.x, y: creature.position.y, z: creature.position.z },
          });
        }
        nextCalls.set(id, elapsedSeconds + callRng.range(10, 20));
      }
    }
    registry.update(elapsedSeconds);
    const region = pointToRegion(player.object.position.x, player.object.position.z);
    const sunDirection = sky.update(clock.dayProgress);
    sun.target.position.copy(player.object.position);
    sun.position.set(
      player.object.position.x + sunDirection.x * 120,
      player.object.position.y + sunDirection.y * 120,
      player.object.position.z + sunDirection.z * 120,
    );
    sun.target.updateMatrixWorld();
    const target = registry
      .list()
      .map((creature) => ({
        creature,
        detection: aiStateFor(creature.id).detection,
        distance: Math.hypot(
          creature.position.x - player.object.position.x,
          creature.position.z - player.object.position.z,
        ),
      }))
      .filter(
        (entry) => entry.detection > 0 && entry.distance <= visionRange(entry.creature.temperament),
      )
      .sort((left, right) => left.distance - right.distance)[0];
    hud.update({
      ...clock,
      regionName: region?.name ?? null,
      biome: terrain.biomeAt(player.object.position.x, player.object.position.z),
      target: target ? { detection: target.detection } : null,
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
      creatures: registry.list().map((creature) => ({
        id: creature.id,
        species: creature.speciesId,
        temperament: creature.temperament,
        position: { x: creature.position.x, y: creature.position.y, z: creature.position.z },
        state: creature.state,
        region: pointToRegion(creature.position.x, creature.position.z)?.id ?? null,
        detection: Number(aiStateFor(creature.id).detection.toFixed(2)),
        behaviour: aiStateFor(creature.id).behaviour,
      })),
    }),
  screenshot: () => {
    render();
    return renderer.domElement.toDataURL('image/jpeg', 0.6);
  },
  debug: debugConsole.run,
  perf: statsPanel.read,
  log: () => eventLog.map((entry) => ({ ...entry })),
};

loop.start();
