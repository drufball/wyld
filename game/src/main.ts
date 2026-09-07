import worldData from './data/world.json';
import { createInput } from './engine/input.js';
import { createEventBus } from './engine/events.js';
import { createLoop } from './engine/loop.js';
import { createRng, resolveSeed } from './engine/rng.js';
import { createNotebook, stubTitle } from './guide/notebook.js';
import { createObserver } from './guide/observe.js';
import { createCreatureRegistry } from './creatures/registry2d.js';
import { createSpawnSystem } from './creatures/spawn.js';
import { createWander } from './creatures/wander.js';
import { roll } from './creatures/individual.js';
import { speciesById } from './creatures/species.js';
import {
  canHearPlayer,
  canSeePlayer,
  reactionFor,
  releaseBehaviour,
  stepDetection,
  visionRange,
  type Behaviour,
} from './creatures/ai.js';
import { drawCreatureSprite } from './render2d/creature-sprite.js';
import { worldToTile } from './world/tiles.js';
import { createCallAudio } from './audio/calls.js';
import { placeTracks } from './world/tracks.js';
import { species, type Temperament } from './creatures/species.js';
import { createPlayerController } from './player/controller.js';
import { blit } from './render2d/blit.js';
import { createCanvas } from './render2d/canvas.js';
import { paletteAt, paletteKey } from './render2d/palette.js';
import { playerSprite } from './render2d/player-sprite.js';
import { createTileRenderer } from './render2d/tiles.js';
import { buildState } from './state.js';
import { createControlsCard } from './ui/controls.js';
import { createDebugConsole } from './ui/debug.js';
import { createGuideBook } from './ui/guide.js';
import { createHud } from './ui/hud.js';
import { createStatsPanel } from './ui/stats.js';
import { createToastStack } from './ui/toasts.js';
import { placeProps } from './world/props.js';
import { camps, pointToRegion, regions } from './world/regions.js';
import { createTerrain } from './world/terrain.js';
import { createTileGrid } from './world/tiles.js';
import { nextPhaseStart, phaseBoundariesBetween, phases, timeAt } from './world/time.js';
import type { Phase } from './world/time.js';
import { createDepthAt } from './world/water.js';
document.documentElement.style.cssText = 'height:100%;background:#19212d';
document.body.style.cssText =
  'height:100%;margin:0;overflow:hidden;display:grid;place-items:center;background:#19212d';
const seed = resolveSeed(),
  rng = createRng(seed),
  terrain = createTerrain(seed),
  depthAt = createDepthAt(terrain.heightAt);
const propPlacements = placeProps({
  rng,
  heightAt: terrain.heightAt,
  slopeAt: terrain.slopeAt,
  depthAt,
  biomeWeightsAt: terrain.biomeWeightsAt,
  densities: worldData.props,
  bounds: { minX: -400, maxX: 400, minZ: -400, maxZ: 400 },
});
const grid = createTileGrid({ ...terrain, depthAt, propPlacements });
const trackPlacements = placeTracks({
  rng: createRng(seed ^ 0x71ac),
  propPlacements,
  heightAt: terrain.heightAt,
  slopeAt: terrain.slopeAt,
  depthAt,
});
const view = createCanvas(),
  tiles = createTileRenderer(grid, trackPlacements),
  debugConsole = createDebugConsole({ seed }),
  stats = createStatsPanel(debugConsole.available),
  toasts = createToastStack(),
  hud = createHud(debugConsole.available, toasts.root),
  notebook = createNotebook(),
  registry = createCreatureRegistry(terrain.heightAt),
  observer = createObserver({ notebook }),
  callAudio = createCallAudio();
callAudio.resumeOnGesture(window);
// Initialised after the loop so its callback can pause it.
// eslint-disable-next-line prefer-const
let guide!: ReturnType<typeof createGuideBook>;
const player = createPlayerController({
  grid,
  canvas: view.canvas,
  cols: () => view.cols,
  rows: () => view.rows,
  start: { x: -150, z: 50 },
});
const onScreen = (x: number, z: number, margin = 0): boolean => {
  const t = worldToTile(x, z),
    sc = player.screen;
  return (
    t.tx >= sc.x * view.cols - margin &&
    t.tx < (sc.x + 1) * view.cols + margin &&
    t.ty >= sc.y * view.rows - margin &&
    t.ty < (sc.y + 1) * view.rows + margin
  );
};
const registryWorld = {
  regions,
  populationFor: (id: string) => {
    const rule =
      worldData.spawnRules.byRegion[id as keyof typeof worldData.spawnRules.byRegion] ??
      worldData.spawnRules.default;
    return rule;
  },
  heightAt: terrain.heightAt,
  slopeAt: terrain.slopeAt,
  depthAt,
  isWalkable: (x: number, z: number, aquatic: boolean) => {
    const t = worldToTile(x, z),
      kind = grid.tileAt(t.tx, t.ty).class;
    return grid.isWalkable(t.tx, t.ty) || (aquatic && kind === 'water');
  },
  isOnScreen: (x: number, z: number) => onScreen(x, z),
};
const spawnSystem = createSpawnSystem({
    world: registryWorld,
    host: registry,
    rng: createRng(seed ^ 0x5a17),
  }),
  wander = createWander(createRng(seed ^ 0x33)),
  wanderStates = new Map<string, ReturnType<typeof wander.begin>>(),
  nextCalls = new Map<string, number>();
type AiState = { meter: number; behaviour: Behaviour; fleeUntil: number };
const aiStates = new Map<string, AiState>();
const seedCreature = (id: string): void => {
  const c = registry.get(id);
  if (!c) return;
  wanderStates.set(id, wander.begin(c.position.x, c.position.z, 30, elapsedSeconds, c.facing));
  nextCalls.set(id, elapsedSeconds + createRng(seed + id.length).range(10, 20));
  aiStates.set(id, { meter: 0, behaviour: 'wander', fleeUntil: 0 });
};
const input = createInput(
  view.canvas,
  () => debugConsole.isOpen || guide?.isOpen || Boolean(player.sliding),
);
createControlsCard(debugConsole.available, () => debugConsole.isOpen);
let elapsedSeconds = 0;
let renderedPaletteKey = '';
type GameEvents = {
  phaseChanged: { phase: Phase; day: number };
  creatureCalled: { id: string; species: string; position: { x: number; y: number; z: number } };
  creatureExecutedMove: { species: string; move: string; distance: number; inView: boolean };
};
const events = createEventBus<GameEvents>();
const eventLog: { kind: string; ts: number; payload: unknown }[] = [];
for (const kind of ['phaseChanged', 'creatureCalled', 'creatureExecutedMove'] as const)
  events.on(kind, (payload) => {
    eventLog.push({ kind, ts: Date.now(), payload });
    if (eventLog.length > 200) eventLog.shift();
  });
const setElapsedSeconds = (next: number): void => {
  for (const boundary of phaseBoundariesBetween(elapsedSeconds, next))
    events.emit('phaseChanged', { phase: boundary.phase, day: boundary.day });
  elapsedSeconds = next;
};
debugConsole.registerCommand('time', {
  help: 'jump to the next Dawn, Day, Dusk, or Night',
  run: (args) => {
    const wanted = args
        .join(' ')
        .replace(/^['"]|['"]$/g, '')
        .toLowerCase(),
      phase = phases.find((p) => p.toLowerCase() === wanted);
    if (!phase) return `valid phases: ${phases.join(', ')}`;
    setElapsedSeconds(nextPhaseStart(elapsedSeconds, phase));
    return `time: ${phase}, day ${timeAt(elapsedSeconds).day}`;
  },
});
debugConsole.registerCommand('tp', {
  help: 'tp <campName> or tp <x> <z>',
  run: (args) => {
    const x = Number(args[0]),
      z = Number(args[1]);
    if (args.length === 2 && Number.isFinite(x) && Number.isFinite(z)) {
      const landed = player.teleport(x, z);
      return `teleported: ${landed.x}, ${landed.z}`;
    }
    const name = args
        .join(' ')
        .replace(/^['"]|['"]$/g, '')
        .toLowerCase(),
      camp = camps().find((c) => c.name.toLowerCase() === name);
    if (!camp) return 'coordinates must be numbers, or a camp name';
    player.teleport(camp.x, camp.z);
    return `teleported: ${camp.name}`;
  },
});
debugConsole.registerCommand('reveal', {
  help: 'reveal <guide|map>',
  run: ([target = '']) => {
    if (target.toLowerCase() === 'map') {
      notebook.revealAllFog();
      guide.refresh();
      return 'map revealed';
    }
    if (target.toLowerCase() !== 'guide') return 'usage: reveal <guide|map>';
    const forcesByHide = {
      Bark: ['Heat', 'Cut'],
      Shell: ['Impact', 'Cut'],
      Scale: ['Surge', 'Heat'],
      Hide: ['Cut', 'Surge'],
      Stone: ['Surge', 'Impact'],
    } as const;
    const clock = timeAt(elapsedSeconds);
    for (const definition of species()) {
      const habitat = definition.habitat[0]!,
        region = regions().find(({ id }) => id === habitat.region)!;
      const located = { region: region.id, day: clock.day };
      notebook.identify(definition.id, {
        ...located,
        phase: habitat.phases[0]!,
        position: { x: region.x, y: terrain.heightAt(region.x, region.z), z: region.z },
      });
      notebook.recordTracks(definition.id, located);
      notebook.recordCall(definition.id, located);
      notebook.recordHide(definition.id, definition.hide);
      notebook.recordWeakness(definition.id, forcesByHide[definition.hide][0]);
      notebook.recordResistance(definition.id, forcesByHide[definition.hide][1]);
      definition.signatureMoves.forEach(({ name }) => notebook.recordMove(definition.id, name));
      notebook.recordTemperament(
        definition.id,
        Object.keys(definition.temperament)[0] as Temperament,
      );
      notebook.recordCapture(definition.id);
    }
    guide.refresh();
    return 'guide revealed';
  },
});
debugConsole.registerCommand('spawn', {
  help: 'spawn <speciesId> [temperament]',
  run: ([id = '', requested]) => {
    const definition = speciesById(id);
    if (!definition) return `unknown species: ${id}`;
    const angle = { up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2, down: 0 }[player.facing],
      world = player.world,
      x = world.x + Math.sin(angle) * 15,
      z = world.z + Math.cos(angle) * 15,
      individual = roll(definition, rng);
    if (requested && ['Skittish', 'Bold', 'Steady', 'Erratic'].includes(requested))
      individual.temperament = requested as Temperament;
    const creature = registry.add(individual, x, z, angle);
    seedCreature(creature.id);
    return `${creature.speciesId} ${creature.temperament} ${creature.id}`;
  },
});
debugConsole.registerCommand('creatures', {
  help: 'list live creatures',
  run: () =>
    registry
      .list()
      .map((c) => `${c.id} ${c.speciesId} ${c.state}`)
      .join('\n') || 'no live creatures',
});
debugConsole.registerCommand('state', {
  help: 'state <creatureId> <idle|walk|execute>',
  run: ([id = '', state = '']) => {
    if (!registry.get(id)) return `unknown creature: ${id}`;
    if (!['idle', 'walk', 'execute'].includes(state)) return 'valid states: idle, walk, execute';
    registry.setState(id, state as 'idle' | 'walk' | 'execute');
    return `${id}: ${state}`;
  },
});
debugConsole.registerCommand('face', {
  help: 'face <speciesId|creatureId>',
  run: ([wanted = '']) => {
    const w = player.world,
      match = registry
        .list()
        .filter((c) => c.id === wanted || c.speciesId === wanted)
        .sort(
          (a, b) =>
            Math.hypot(a.position.x - w.x, a.position.z - w.z) -
            Math.hypot(b.position.x - w.x, b.position.z - w.z),
        )[0];
    if (!match) return `no live creature matches: ${wanted}`;
    const dx = match.position.x - w.x,
      dz = match.position.z - w.z;
    return `face ${Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : dz > 0 ? 'down' : 'up'}: ${match.id}`;
  },
});
debugConsole.registerCommand('tracks', {
  help: 'tracks [speciesId]',
  run: ([wanted]) =>
    trackPlacements
      .filter((t) => !wanted || t.speciesId === wanted)
      .map((t) => `${t.speciesId} ${t.regionId} ${t.x.toFixed(1)},${t.z.toFixed(1)}`)
      .join('\n') || 'no tracks',
});
const render = () => {
  const clock = timeAt(elapsedSeconds),
    palette = paletteAt(clock.phase, clock.phaseProgress),
    key = paletteKey(clock.phase, clock.phaseProgress),
    screen = player.screen;
  const layer = tiles.layer(screen.x, screen.y, view.cols, view.rows, palette, key);
  view.context.drawImage(layer, 0, 0);
  const tile = player.tile,
    x = (tile.x - screen.x * view.cols) * 16 - 8,
    y =
      (tile.y - screen.y * view.rows) * 16 -
      20 +
      (player.moving ? 0 : Math.round(Math.sin(elapsedSeconds * 2) * 0.5 + 0.5)),
    frame = player.moving ? ((Math.floor(elapsedSeconds * 8) % 2) as 0 | 1) : 'idle';
  const calls =
    1 +
    blit(
      view.context,
      playerSprite(
        player.facing === 'left' || player.facing === 'right' ? 'side' : player.facing,
        frame,
      ),
      x,
      y,
      player.facing === 'left',
    );
  let drawCalls = calls;
  for (const creature of registry.list()) {
    if (!onScreen(creature.position.x, creature.position.z, 1)) continue;
    const definition = speciesById(creature.speciesId)!;
    const tx = (creature.position.x + 400) / 2 - screen.x * view.cols,
      ty = (creature.position.z + 400) / 2 - screen.y * view.rows;
    const side = Math.abs(Math.sin(creature.facing)) > 0.5,
      facing = side ? 'side' : Math.cos(creature.facing) < 0 ? 'up' : 'down',
      flip = side && Math.sin(creature.facing) < 0;
    const frame =
      creature.state === 'walk'
        ? Math.floor(creature.frameClock * 8) % 2
          ? 'walk1'
          : 'walk0'
        : creature.state;
    drawCalls += drawCreatureSprite(
      view.context,
      creature.speciesId,
      facing,
      frame,
      Math.round(tx * 16 - definition.tier * 4),
      Math.round(ty * 16 - (definition.tier === 1 ? 16 : definition.tier === 2 ? 24 : 32)),
      flip,
    );
    const meter = aiStates.get(creature.id)?.meter ?? 0;
    if (meter > 0) {
      const ex = Math.round(tx * 16 - 3),
        ey = Math.round(ty * 16 - (definition.tier === 1 ? 21 : definition.tier === 2 ? 29 : 37));
      view.context.fillStyle = '#292b25';
      view.context.fillRect(ex, ey + 1, 7, 3);
      view.context.fillRect(ex + 2, ey, 3, 5);
      view.context.fillStyle = '#f5f0dc';
      view.context.fillRect(ex + 2, ey + 2, Math.ceil(meter * 3), 1);
    }
  }
  stats.afterRender(tiles.tileMs, drawCalls);
  if (key !== renderedPaletteKey) {
    document.body.style.background = `rgb(${palette.ash.shade.join(',')})`;
    renderedPaletteKey = key;
  }
};
const loop = createLoop({
  update: (dt) => {
    setElapsedSeconds(elapsedSeconds + dt);
    for (const tap of input.taps()) player.tap(tap.clientX, tap.clientY);
    player.update(dt);
    const world = player.world,
      region = pointToRegion(world.x, world.z),
      clock = timeAt(elapsedSeconds);
    const spawned = spawnSystem.update(dt, clock.phase, {
      x: world.x,
      y: terrain.heightAt(world.x, world.z),
      z: world.z,
    });
    for (const id of spawned.spawned) seedCreature(id);
    for (const id of spawned.despawned) {
      wanderStates.delete(id);
      nextCalls.delete(id);
      aiStates.delete(id);
    }
    for (const creature of registry.list()) {
      const definition = speciesById(creature.speciesId)!,
        ct = worldToTile(creature.position.x, creature.position.z),
        pt = worldToTile(world.x, world.z),
        distanceTiles = Math.hypot(ct.tx - pt.tx, ct.ty - pt.ty),
        ai = aiStates.get(creature.id) ?? {
          meter: 0,
          behaviour: 'wander' as Behaviour,
          fleeUntil: 0,
        };
      aiStates.set(creature.id, ai);
      const visible = canSeePlayer(
          grid,
          { x: ct.tx, y: ct.ty },
          { x: pt.tx, y: pt.ty },
          creature.facing,
          creature.temperament,
        ),
        heard = canHearPlayer(distanceTiles, player.moving);
      ai.meter = stepDetection(
        ai.meter,
        { distance: distanceTiles, visionRange: visionRange(creature.temperament), visible, heard },
        dt,
      );
      if (ai.meter >= 1 && ai.behaviour === 'wander') {
        ai.behaviour = reactionFor(creature.temperament, rng);
        ai.fleeUntil = elapsedSeconds + 5;
      }
      ai.behaviour = releaseBehaviour(
        ai.behaviour,
        distanceTiles,
        visionRange(creature.temperament),
        ai.meter,
        elapsedSeconds >= ai.fleeUntil,
      );
      const ws = wanderStates.get(creature.id);
      if (ws && ai.behaviour === 'wander') {
        const moved = wander.step(ws, creature.position, elapsedSeconds, dt, {
          speedStat: creature.individual.stats.speed,
          canSwim: definition.innate.includes('Swim'),
          depthAt,
          slopeAt: terrain.slopeAt,
          walkableAt: registryWorld.isWalkable,
        });
        creature.position.x = moved.x;
        creature.position.z = moved.z;
        creature.facing = moved.facing;
        registry.setState(creature.id, moved.moving ? 'walk' : 'idle');
      }
      if ((nextCalls.get(creature.id) ?? Infinity) <= elapsedSeconds) {
        const payload = {
          id: creature.id,
          species: creature.speciesId,
          position: { ...creature.position },
        };
        events.emit('creatureCalled', payload);
        callAudio.play(
          definition.call,
          Math.max(
            0,
            1 - Math.hypot(creature.position.x - world.x, creature.position.z - world.z) / 25,
          ),
        );
        nextCalls.set(creature.id, elapsedSeconds + rng.range(10, 20));
        observer.onCreatureCalled(payload, {
          day: clock.day,
          phase: clock.phase,
          region: pointToRegion(world.x, world.z)?.id ?? null,
          playerPosition: { x: world.x, y: 0, z: world.z },
          tracks: trackPlacements,
          creatures: [],
        });
      }
    }
    registry.update(dt);
    const observed = registry.list().map((c) => {
      const t = worldToTile(c.position.x, c.position.z),
        p = worldToTile(world.x, world.z);
      return {
        id: c.id,
        speciesId: c.speciesId,
        region: pointToRegion(c.position.x, c.position.z)?.id ?? null,
        position: { ...c.position },
        distance: Math.hypot(t.tx - p.tx, t.ty - p.ty),
        moving: c.state === 'walk',
        inView:
          onScreen(c.position.x, c.position.z) &&
          canSeePlayer(grid, { x: p.tx, y: p.ty }, { x: t.tx, y: t.ty }, 0, 'Skittish'),
        wild: true,
        temperament: c.temperament,
      };
    });
    observer.update(dt, {
      day: clock.day,
      phase: clock.phase,
      region: pointToRegion(world.x, world.z)?.id ?? null,
      playerPosition: { x: world.x, y: 0, z: world.z },
      tracks: trackPlacements,
      creatures: observed,
    });
    notebook.revealFog(world.x, world.z);
    for (const camp of camps())
      if (Math.hypot(camp.x - world.x, camp.z - world.z) <= 6) notebook.discoverCamp(camp.id);
    hud.update({
      ...clock,
      regionName: region?.name ?? null,
      biome: terrain.biomeAt(world.x, world.z),
      target: null,
    });
    input.endFrame();
  },
  render,
});
guide = createGuideBook({
  notebook,
  debugOpen: () => debugConsole.isOpen,
  map: {
    sampler: { biomeAt: terrain.biomeAt, waterAt: depthAt, heightAt: terrain.heightAt },
    player: () => ({ ...player.world, heading: 0 }),
  },
  onOpenChange: (open) => (open ? loop.stop() : loop.start()),
});
window.__wyld = {
  getState: () => {
    const world = player.world,
      clock = timeAt(elapsedSeconds);
    return buildState({
      version: __GAME_VERSION__,
      elapsedSeconds,
      player: { x: world.x, y: terrain.heightAt(world.x, world.z), z: world.z },
      screen: player.screen,
      tile: player.tile,
      seed,
      region: pointToRegion(world.x, world.z)?.id ?? null,
      biome: terrain.biomeAt(world.x, world.z),
      ...clock,
      waterDepth: depthAt(world.x, world.z),
      creatures: registry.list().map((c) => {
        const t = worldToTile(c.position.x, c.position.z),
          ai = aiStates.get(c.id);
        return {
          id: c.id,
          species: c.speciesId,
          temperament: c.temperament,
          position: { ...c.position },
          tile: { x: t.tx, y: t.ty },
          state: c.state,
          region: pointToRegion(c.position.x, c.position.z)?.id ?? null,
          detection: ai?.meter ?? 0,
          behaviour: ai?.behaviour ?? 'wander',
        };
      }),
      observe: { identifying: observer.identifying() },
      guide: {
        open: guide.isOpen,
        tab: guide.tab,
        completion: notebook.overallCompletion(),
        pages: notebook.pages().map((p) => ({
          speciesId: p.speciesId,
          name: p.name,
          complete: notebook.completion(p.speciesId),
          ...notebook.completionFraction(p.speciesId),
        })),
        stubs: notebook
          .stubs()
          .map((s) => ({ id: s.id, speciesId: s.speciesId, slot: s.slot, title: stubTitle(s) })),
        fog: { revealed: notebook.fog().revealedCount(), total: 1600 },
        camps: [...notebook.discoveredCamps()],
      },
    });
  },
  screenshot: view.screenshot,
  debug: debugConsole.run,
  perf: stats.read,
  log: () => eventLog.map((entry) => ({ ...entry })),
};
loop.start();
