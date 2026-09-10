import worldData from './data/world.json';
import { createInput } from './engine/input.js';
import { installEmbedBridge } from './ui/embed-bridge.js';
import { createEventBus } from './engine/events.js';
import { createLoop } from './engine/loop.js';
import { createRng, resolveSeed } from './engine/rng.js';
import { createNotebook, stubTitle } from './guide/notebook.js';
import { createObserver } from './guide/observe.js';
import { createCreatureRegistry } from './creatures/registry2d.js';
import { createSpawnSystem } from './creatures/spawn.js';
import { createWander } from './creatures/wander.js';
import { FACING_YAW, spriteFacingFromCardinal, spriteFacingFromYaw } from './creatures/facing.js';
import { roll } from './creatures/individual.js';
import {
  addPartyMember,
  createParty,
  groundTapped,
  removePartyMember,
  selectCreature,
  selectPlayer,
  targetWildCreature,
} from './party/party.js';
import { buildArena, scenarioFromQuery } from './scenarios/scenarios.js';
import { speciesById } from './creatures/species.js';
import {
  canHearPlayer,
  canSeePlayer,
  facingToward,
  reactionFor,
  releaseBehaviour,
  stepDetection,
  visionRange,
  type Behaviour,
} from './creatures/ai.js';
import { drawCreatureSprite } from './render2d/creature-sprite.js';
import { TILE_METRES, tileToWorld, worldToTile } from './world/tiles.js';
import { createCallAudio } from './audio/calls.js';
import { placeTracks } from './world/tracks.js';
import { species, type Temperament } from './creatures/species.js';
import { createPlayerController } from './player/controller.js';
import { ARENA_PACE, arenaSpeedTilesPerSecond, worldSpeedTilesPerSecond } from './combat/pace.js';
import { blit } from './render2d/blit.js';
import { createCanvas } from './render2d/canvas.js';
import { pixelScale, screenCols, screenRows } from './render2d/canvas.js';
import { lookFromQuery } from './render3d/look.js';
import { createDiorama } from './render3d/renderer.js';
import { createVignette } from './render3d/vignette.js';
import { paletteAt, paletteKey } from './render2d/palette.js';
import { playerSprite } from './render2d/player-sprite.js';
import { spriteOrigin } from './render2d/placement.js';
import { combatBarOrigin } from './render2d/combat-bar.js';
import { anchorFor } from './render3d/anchors.js';
import { cameraTarget, orthoFrustum } from './render3d/camera.js';
import { TIER_LENGTH_TILES } from './render3d/bodyplans/index.js';
import { createTileRenderer } from './render2d/tiles.js';
import { buildState } from './state.js';
import { createControlsCard, shouldIgnoreArenaKey } from './ui/controls.js';
import { createDebugConsole } from './ui/debug.js';
import { createGuideBook } from './ui/guide.js';
import { createHud } from './ui/hud.js';
import { createStatsPanel } from './ui/stats.js';
import { createArenaPick } from './ui/arena-pick.js';
import { buildArenaIndividual, enemy, rosterMember } from './arena/roster.js';
import { createPick, chooseEnemy, toggleMember, startFight, type PickState } from './arena/pick.js';
import { resistance, weakness } from './combat/hides.js';
import { createEncounter, shouldAskForReserve } from './combat/encounter.js';
import { createAutopilot } from './combat/autopilot.js';
import { LUNGE_SECONDS, createAnimations } from './combat/anim.js';
import { createToastStack } from './ui/toasts.js';
import { learnedFactText, learnFromCombat, type LearnedFact } from './arena/learning.js';
import { createTellStack, tellsFromEvents } from './combat/tells.js';
import { createCombatTellOverlay } from './ui/combat-tell.js';
import { loadArenaProgress, saveArenaProgress, wipeArenaProgress } from './arena/persistence.js';
import { safeStorage } from './persist/storage.js';
import { createArenaResult } from './ui/arena-result.js';
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
const scenario = scenarioFromQuery(location.search);
const look = lookFromQuery(location.search);
const synthetic = scenario?.synthetic === true;
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
const initialScale = pixelScale(innerWidth, innerHeight),
  initialCols = screenCols(innerWidth, initialScale),
  initialRows = screenRows(innerHeight, initialScale);
const grid = synthetic
  ? buildArena(initialCols, initialRows)
  : createTileGrid({ ...terrain, depthAt, propPlacements });
const trackPlacements = placeTracks({
  rng: createRng(seed ^ 0x71ac),
  propPlacements,
  heightAt: terrain.heightAt,
  slopeAt: terrain.slopeAt,
  depthAt,
  isWalkable: (x, z) => {
    const { tx, ty } = worldToTile(x, z);
    return grid.isWalkable(tx, ty);
  },
});
let activeFlatScreen = { sx: 0, sy: 0 };
const dioramaView =
  look === 'diorama' ? createDiorama(grid, synthetic ? [] : trackPlacements) : null;
const vignette = look === 'diorama' ? createVignette() : null;
const flatView = look === 'flat' ? createCanvas({ screen: () => activeFlatScreen }) : null;
const view = dioramaView ?? flatView!;
const scenarioStart = synthetic
  ? { tx: Math.floor(view.cols / 2), ty: Math.floor(view.rows / 2) }
  : scenario?.start;
let tiles = createTileRenderer(grid, synthetic ? [] : trackPlacements);
const debugConsole = createDebugConsole({ seed }),
  stats = createStatsPanel(debugConsole.available),
  toasts = createToastStack(),
  tellStack = createTellStack(),
  tellOverlay = createCombatTellOverlay(),
  arenaStorage = safeStorage(),
  hudActions: Parameters<typeof createHud>[2] = {},
  hud = createHud(debugConsole.available, toasts.root, hudActions, { showMap: !synthetic }),
  arenaProgress = synthetic ? loadArenaProgress(arenaStorage) : null,
  notebook = arenaProgress?.notebook ?? createNotebook(),
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
  start: scenarioStart ? tileToWorld(scenarioStart.tx, scenarioStart.ty) : { x: -150, z: 50 },
  screenFlipping: scenario?.id !== 'arena',
  pick: (x, y) => view.pickTile(x, y),
  diagonals: synthetic,
  ...(synthetic ? { speedTilesPerSecond: 2 * ARENA_PACE } : {}),
});
const partySpecies = scenario?.party ?? ['loamox'];
const owned = partySpecies.map((speciesId, index) => {
  const definition = speciesById(speciesId)!;
  const individual = roll(definition, rng, `${speciesId}-party-${index + 1}`);
  if (index === 0 && speciesId === 'loamox') {
    individual.temperament = 'Steady';
    individual.stats = { vigor: 70, power: 3, speed: 4, focus: 40 };
  }
  const formation = [
    { tx: 0, ty: 1 },
    { tx: -1, ty: 1 },
    { tx: 1, ty: 1 },
  ][index]!;
  const start = {
    tx: Math.max(0, scenarioStart?.tx ?? 125) + formation.tx,
    ty: (scenarioStart?.ty ?? 225) + formation.ty,
  };
  return {
    individual,
    name: index === 0 && speciesId === 'loamox' ? 'Barrow' : definition.name,
    tile: start,
    path: [],
  };
});
let partyState = createParty(owned);
const partyControllers = new Map(
  partyState.party.map((member) => [
    member.individual.id,
    createPlayerController({
      grid,
      canvas: view.canvas,
      cols: () => view.cols,
      rows: () => view.rows,
      start: tileToWorld(member.tile.tx, member.tile.ty),
      screenFlipping: scenario?.id !== 'arena',
      pick: (x, y) => view.pickTile(x, y),
      diagonals: synthetic,
      speedTilesPerSecond: synthetic
        ? arenaSpeedTilesPerSecond(member.individual.stats.speed)
        : worldSpeedTilesPerSecond(member.individual.stats.speed),
    }),
  ]),
);
const createPartyController = (member: (typeof partyState.party)[number]) =>
  createPlayerController({
    grid,
    canvas: view.canvas,
    cols: () => view.cols,
    rows: () => view.rows,
    start: tileToWorld(member.tile.tx, member.tile.ty),
    screenFlipping: !synthetic,
    pick: (x, y) => view.pickTile(x, y),
    diagonals: synthetic,
    speedTilesPerSecond: synthetic
      ? arenaSpeedTilesPerSecond(member.individual.stats.speed)
      : worldSpeedTilesPerSecond(member.individual.stats.speed),
  });
hudActions.selectCreature = (id) => {
  partyState = selectCreature(partyState, id);
};
const registry = createCreatureRegistry(terrain.heightAt, () => player.world);
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
const tileOnScreen = (tx: number, ty: number, margin = 1): boolean => {
  const sc = player.screen;
  return (
    tx >= sc.x * view.cols - margin &&
    tx < (sc.x + 1) * view.cols + margin &&
    ty >= sc.y * view.rows - margin &&
    ty < (sc.y + 1) * view.rows + margin
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
  callRng = createRng(seed ^ 0x0ca1),
  wanderStates = new Map<string, ReturnType<typeof wander.begin>>(),
  nextCalls = new Map<string, number>();
type AiState = { meter: number; behaviour: Behaviour; fleeUntil: number };
const aiStates = new Map<string, AiState>();
let arenaState: PickState | null = synthetic ? createPick() : null;
let encounter: ReturnType<typeof createEncounter> | null = null;
const autopilot = createAutopilot();
const animations = createAnimations();
let fightLearned: LearnedFact[] = [];
let resultScreen: ReturnType<typeof createArenaResult> | null = null;
let fightRecorded = false;
let reservePrompted = false;
let damageLogging = false;
const seedCreature = (id: string): void => {
  const c = registry.get(id);
  if (!c) return;
  wanderStates.set(id, wander.begin(c.position.x, c.position.z, 30, elapsedSeconds, c.facing));
  nextCalls.set(id, elapsedSeconds + callRng.range(10, 20));
  aiStates.set(id, { meter: 0, behaviour: 'wander', fleeUntil: 0 });
};
const input = createInput(
  view.canvas,
  () => debugConsole.isOpen || guide?.isOpen || Boolean(player.sliding),
);
createControlsCard(debugConsole.available, () => debugConsole.isOpen, synthetic);
let elapsedSeconds = scenario ? { Dawn: 0, Day: 180, Dusk: 360, Night: 540 }[scenario.phase] : 0;
if (scenario) {
  for (const spawn of scenario.spawns) {
    const definition = speciesById(spawn.speciesId)!;
    const individual = roll(definition, rng);
    if (spawn.temperament) individual.temperament = spawn.temperament;
    const at = tileToWorld(spawn.tx, spawn.ty);
    const creature = registry.add(individual, at.x, at.z, 0);
    seedCreature(creature.id);
  }
  const goal = document.createElement('section');
  goal.textContent = scenario.goal;
  goal.style.cssText =
    'position:fixed;z-index:7;top:70px;left:50%;transform:translateX(-50%);box-sizing:border-box;width:min(420px,calc(100vw - 32px));padding:10px 14px;border:1px solid #777566;background:#f4efd9f5;color:#292b25;text-align:center;font:700 13px/18px ui-monospace,monospace;box-shadow:1px 2px 2px #0004';
  document.body.append(goal);
  window.setTimeout(() => goal.remove(), 6000);
}
let renderedPaletteKey = '';
const visitedScreens = new Set<string>();
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
      notebook.recordWeakness(definition.id, weakness(definition.hide));
      notebook.recordResistance(definition.id, resistance(definition.hide));
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
    const angle = FACING_YAW[player.facing],
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
debugConsole.registerCommand('party', {
  help: 'party <add speciesId|remove id|list>',
  run: ([action = '', id = '']) => {
    if (action === 'list')
      return (
        partyState.party
          .map(({ individual, name }) => `${individual.id} ${individual.speciesId} ${name}`)
          .join('\n') || 'party empty'
      );
    if (action === 'add') {
      if (partyState.party.length >= 3) return 'party full (maximum 3)';
      const definition = speciesById(id);
      if (!definition) return `unknown species: ${id}`;
      const index = partyState.party.length;
      const offset = [
        { tx: 0, ty: 1 },
        { tx: -1, ty: 1 },
        { tx: 1, ty: 1 },
      ][index]!;
      const member = {
        individual: roll(definition, rng),
        name: definition.name,
        tile: {
          tx: Math.floor(player.tile.x) + offset.tx,
          ty: Math.floor(player.tile.y) + offset.ty,
        },
        path: [],
      };
      partyState = addPartyMember(partyState, member);
      partyControllers.set(member.individual.id, createPartyController(member));
      return `party added: ${member.individual.id} ${member.individual.speciesId}`;
    }
    if (action === 'remove') {
      if (!partyState.party.some(({ individual }) => individual.id === id))
        return `unknown party member: ${id}`;
      partyState = removePartyMember(partyState, id);
      partyControllers.delete(id);
      return `party removed: ${id}`;
    }
    return 'usage: party <add speciesId|remove id|list>';
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
const beginArena = (state: PickState): void => {
  const foe = state.enemy ? enemy(state.enemy) : null;
  if (!foe || state.party.length !== 3) return;
  animations.clear();
  autopilot.clearAll();
  arenaState = state;
  fightLearned = [];
  fightRecorded = false;
  reservePrompted = false;
  resultScreen?.dispose();
  resultScreen = null;
  const built = buildArena(view.cols, view.rows, foe.biome);
  Object.assign(grid, built);
  tiles = createTileRenderer(grid, []);
  registry.clear();
  partyControllers.clear();
  const centre = { tx: Math.floor(view.cols / 2), ty: Math.floor(view.rows / 2) };
  player.teleport(tileToWorld(centre.tx, centre.ty).x, tileToWorld(centre.tx, centre.ty).z);
  const offsets = [
    { tx: 0, ty: 1 },
    { tx: -1, ty: 1 },
    { tx: 1, ty: 1 },
  ];
  const members = state.party.map((id, index) => {
    const entry = rosterMember(id)!;
    return {
      individual: buildArenaIndividual(entry),
      name: entry.name,
      tile: { tx: centre.tx + offsets[index]!.tx, ty: centre.ty + offsets[index]!.ty },
      path: [],
    };
  });
  partyState = createParty(members);
  for (const member of members)
    partyControllers.set(member.individual.id, createPartyController(member));
  let enemyTile = { tx: centre.tx, ty: Math.max(0, centre.ty - 6) };
  if (!grid.isWalkable(enemyTile.tx, enemyTile.ty)) {
    for (let radius = 1; radius < view.cols; radius++) {
      const found = [-radius, radius]
        .map((dx) => ({ tx: centre.tx + dx, ty: enemyTile.ty }))
        .find((p) => grid.isWalkable(p.tx, p.ty));
      if (found) {
        enemyTile = found;
        break;
      }
    }
  }
  const at = tileToWorld(enemyTile.tx, enemyTile.ty);
  registry.add(buildArenaIndividual(foe), at.x, at.z, 0);
  encounter = createEncounter({
    party: members.map((m) => m.individual),
    enemy: buildArenaIndividual(foe),
    grid,
    rng,
    player: { x: centre.tx, y: centre.ty },
    partyTiles: Object.fromEntries(
      members.map((member) => [
        member.individual.id,
        { x: member.tile.tx + 0.5, y: member.tile.ty + 0.5 },
      ]),
    ),
    enemyTile: { x: enemyTile.tx + 0.5, y: enemyTile.ty + 0.5 },
  });
};
let arenaPick: ReturnType<typeof createArenaPick> | null = null;
if (synthetic)
  arenaPick = createArenaPick(notebook, beginArena, (state) => (arenaState = state), {
    close: () => guide?.close(),
  });
const showEnemyPicker = (): void => {
  resultScreen?.dispose();
  resultScreen = null;
  encounter = null;
  autopilot.clearAll();
  animations.clear();
  arenaState = createPick();
  arenaPick = createArenaPick(notebook, beginArena, (state) => (arenaState = state), {
    close: () => guide?.close(),
  });
};
debugConsole.registerCommand('fight', {
  help: 'fight <enemyId> <a,b,c>',
  run: ([enemyId = '', partyList = '']) => {
    if (!synthetic) return 'not in the arena';
    if (!enemy(enemyId)) return `unknown enemy: ${enemyId}`;
    const ids = partyList.split(',').filter(Boolean);
    if (ids.length !== 3) return 'choose exactly three roster creatures';
    const unknown = ids.find((id) => !rosterMember(id));
    if (unknown) return `unknown roster creature: ${unknown}`;
    let next = chooseEnemy(createPick(), enemyId);
    for (const id of ids) next = toggleMember(next, id);
    next = startFight(next);
    arenaPick?.setState(next);
    return 'fight started';
  },
});
debugConsole.registerCommand('damage', {
  help: 'damage log',
  run: ([arg = '']) => {
    if (arg !== 'log') return 'usage: damage log';
    damageLogging = !damageLogging;
    return `damage log: ${damageLogging ? 'on' : 'off'}`;
  },
});
debugConsole.registerCommand('heal', {
  help: 'restore combatants',
  run: () => {
    if (!encounter) return 'no fight';
    encounter.heal();
    return 'combatants healed';
  },
});
debugConsole.registerCommand('wipe', {
  help: 'clear arena field guide progress',
  run: () => {
    if (!synthetic) return 'not in the arena';
    if (arenaProgress) Object.assign(arenaProgress, wipeArenaProgress(arenaStorage));
    return 'arena progress wiped';
  },
});
hudActions.useMove = (moveId) => {
  if (partyState.selection !== 'player' && encounter?.state().phase === 'fight')
    autopilot.tap(partyState.selection, moveId, encounter.state().elapsed);
};
const swapSelected = (): boolean => {
  if (!encounter) return false;
  const combat = encounter.state();
  const outgoing =
    combat.party.find((member) => member.id === partyState.selection && !member.benched) ??
    combat.party.find((member) => !member.benched);
  if (!outgoing || !encounter.swap(outgoing.id)) return false;
  autopilot.clear(outgoing.id);
  const incoming = combat.party.find((member) => member.id === combat.reserveId);
  if (!incoming) return false;
  const destination = tileToWorld(outgoing.tile.x - 0.5, outgoing.tile.y - 0.5);
  partyControllers.get(incoming.id)?.teleport(destination.x, destination.z);
  partyControllers.get(outgoing.id)?.clearPath();
  partyState = selectCreature(partyState, incoming.id);
  return true;
};
hudActions.swap = () => void swapSelected();
window.addEventListener('keydown', (event) => {
  if (shouldIgnoreArenaKey(event, debugConsole.isOpen, guide?.isOpen ?? false)) return;
  if (event.key.toLowerCase() === 's' && encounter?.state().phase === 'fight') swapSelected();
});
const render = (alpha = 1) => {
  const clock = timeAt(elapsedSeconds),
    palette = paletteAt(clock.phase, clock.phaseProgress),
    key = paletteKey(clock.phase, clock.phaseProgress),
    screen = player.screen;
  activeFlatScreen = { sx: screen.x, sy: screen.y };
  if (look === 'diorama') {
    const combat = encounter?.state() ?? null;
    const enemyCreature = combat
      ? registry.list().find(({ speciesId }) => speciesId === combat.enemy.speciesId)
      : undefined;
    const result = dioramaView!.render({
      screen,
      sliding: player.sliding,
      phase: clock.phase,
      phaseProgress: clock.phaseProgress,
      elapsedSeconds,
      alpha,
      player: {
        tileX: player.interpolated(alpha).x,
        tileY: player.interpolated(alpha).y,
        facing: player.facing,
        moving: player.moving,
      },
      creatures: registry.list().flatMap((creature) => {
        const enemy = creature.id === enemyCreature?.id ? combat?.enemy : undefined;
        const offset = animations.offsetFor(creature.id);
        const tileX = (enemy ? enemy.tile.x : (creature.position.x + 400) / TILE_METRES) + offset.x;
        const tileY = (enemy ? enemy.tile.y : (creature.position.z + 400) / TILE_METRES) + offset.y;
        if (!tileOnScreen(tileX, tileY, 1)) return [];
        return [
          {
            key: creature.id,
            speciesId: creature.speciesId,
            tileX,
            tileY,
            facing: enemy?.facing ?? creature.facing,
            state: animations.lunging(creature.id) ? ('execute' as const) : creature.state,
            phaseOffset: creature.frameClock,
            meter: aiStates.get(creature.id)?.meter ?? 0,
            downed: enemy?.downed,
            hp: enemy ? { value: enemy.hp, max: enemy.maxHp } : undefined,
            focus: enemy ? { value: enemy.focus, max: enemy.maxFocus } : undefined,
            windup: enemy?.windup?.progress,
          },
        ];
      }),
      party: partyState.party.flatMap((member, index) => {
        const controller = partyControllers.get(member.individual.id)!;
        const tile = controller.interpolated(alpha);
        const offset = animations.offsetFor(member.individual.id);
        const combatant = combat?.party.find(({ id }) => id === member.individual.id);
        if (combatant?.benched) return [];
        if (!tileOnScreen(tile.x, tile.y, 1)) return [];
        return [
          {
            key: member.individual.id,
            speciesId: member.individual.speciesId,
            tileX: tile.x + offset.x,
            tileY: tile.y + offset.y,
            facing: FACING_YAW[controller.facing],
            state: animations.lunging(member.individual.id)
              ? ('execute' as const)
              : controller.moving
                ? ('walk' as const)
                : ('idle' as const),
            phaseOffset: index,
            downed: combatant?.downed,
            windup: combatant?.windup?.progress,
          },
        ];
      }),
      selection: partyState.selection,
      combat: combat ? { projectiles: combat.projectiles, flashes: combat.flashes } : null,
    });
    if (combat) {
      const rect = dioramaView!.canvas.getBoundingClientRect();
      const target = cameraTarget(screen, player.sliding, view.cols, view.rows);
      const frustum = orthoFrustum(view.cols, view.rows);
      const stackIndexes = new Map<string, number>();
      tellOverlay.sync(
        tellStack.list().flatMap((tell) => {
          const combatant = combat.party.find(({ id }) => id === tell.targetId) ?? combat.enemy;
          if (!combatant) return [];
          const definition = speciesById(combatant.speciesId)!;
          const anchor = anchorFor(
            combatant.tile.x,
            combatant.tile.y,
            TIER_LENGTH_TILES[definition.tier] * 0.6,
            target,
            frustum,
            rect,
          );
          const index = stackIndexes.get(tell.targetId) ?? 0;
          stackIndexes.set(tell.targetId, index + 1);
          return [{ ...tell, left: anchor.left, top: anchor.top - 20 - index * 24 }];
        }),
      );
    } else tellOverlay.sync([]);
    stats.afterRender(result.frameMs, result.drawCalls);
    vignette!.refresh(stats.read());
    return;
  }
  const flat = flatView!;
  const layer = tiles.layer(screen.x, screen.y, view.cols, view.rows, palette, key);
  flat.context.drawImage(layer, 0, 0);
  const tile = player.interpolated(alpha),
    localTileX = tile.x - screen.x * view.cols,
    localTileY = tile.y - screen.y * view.rows,
    playerOrigin = spriteOrigin(localTileX, localTileY, 16, 24),
    x = playerOrigin.x,
    y = playerOrigin.y + (player.moving ? 0 : Math.round(Math.sin(elapsedSeconds * 2) * 0.5 + 0.5)),
    frame = player.moving ? ((Math.floor(elapsedSeconds * 8) % 2) as 0 | 1) : 'idle';
  const playerSpriteFacing = spriteFacingFromCardinal(player.facing);
  const calls =
    1 +
    blit(
      flat.context,
      playerSprite(playerSpriteFacing.facing, frame),
      x,
      y,
      playerSpriteFacing.flip,
    );
  let drawCalls = calls;
  for (const member of partyState.party) {
    const controller = partyControllers.get(member.individual.id)!;
    const tile = controller.interpolated(alpha);
    if (Math.floor(tile.x / view.cols) !== screen.x || Math.floor(tile.y / view.rows) !== screen.y)
      continue;
    const definition = speciesById(member.individual.speciesId)!;
    const tx = tile.x - screen.x * view.cols,
      ty = tile.y - screen.y * view.rows,
      size = definition.tier === 1 ? 16 : definition.tier === 2 ? 24 : 32,
      origin = spriteOrigin(tx, ty, size, size),
      offset = animations.offsetFor(member.individual.id),
      bodyOrigin = { x: origin.x + offset.x * 16, y: origin.y + offset.y * 16 };
    const combatant = encounter?.state().party.find((c) => c.id === member.individual.id);
    if (combatant?.benched) continue;
    if (partyState.selection === member.individual.id && !combatant?.downed) {
      flat.context.strokeStyle = definition.palette.accent ?? '#bd7132';
      flat.context.lineWidth = 1;
      flat.context.beginPath();
      flat.context.ellipse(Math.round(tx * 16), Math.round(ty * 16 + 4), 7, 3, 0, 0, Math.PI * 2);
      flat.context.stroke();
    }
    if (combatant?.downed) flat.context.globalAlpha = 0.3;
    const memberSpriteFacing = spriteFacingFromCardinal(controller.facing);
    drawCalls += drawCreatureSprite(
      flat.context,
      member.individual.speciesId,
      memberSpriteFacing.facing,
      controller.moving ? 'walk0' : 'idle',
      bodyOrigin.x,
      bodyOrigin.y + (combatant?.downed ? Math.floor(size / 3) : 0),
      memberSpriteFacing.flip,
    );
    flat.context.globalAlpha = 1;
    if (combatant?.windup) {
      flat.context.fillStyle = '#292b25';
      flat.context.fillRect(origin.x, origin.y - 4, size, 3);
      flat.context.fillStyle = '#f4efd9';
      flat.context.fillRect(origin.x, origin.y - 4, size * combatant.windup.progress, 2);
    }
  }
  for (const creature of registry.list()) {
    if (!onScreen(creature.position.x, creature.position.z, 1)) continue;
    const definition = speciesById(creature.speciesId)!;
    const tx = (creature.position.x + 400) / 2 - screen.x * view.cols,
      ty = (creature.position.z + 400) / 2 - screen.y * view.rows,
      size = definition.tier === 1 ? 16 : definition.tier === 2 ? 24 : 32,
      origin = spriteOrigin(tx, ty, size, size),
      offset = animations.offsetFor(creature.id),
      bodyOrigin = { x: origin.x + offset.x * 16, y: origin.y + offset.y * 16 };
    const spriteFacing = spriteFacingFromYaw(creature.facing);
    const frame =
      creature.state === 'walk'
        ? Math.floor(creature.frameClock * 8) % 2
          ? 'walk1'
          : 'walk0'
        : creature.state;
    drawCalls += drawCreatureSprite(
      flat.context,
      creature.speciesId,
      spriteFacing.facing,
      frame,
      bodyOrigin.x,
      bodyOrigin.y,
      spriteFacing.flip,
    );
    const meter = aiStates.get(creature.id)?.meter ?? 0;
    if (meter > 0) {
      const ex = Math.round(tx * 16 - 3),
        ey = origin.y - 5;
      flat.context.fillStyle = '#292b25';
      flat.context.fillRect(ex, ey + 1, 7, 3);
      flat.context.fillRect(ex + 2, ey, 3, 5);
      flat.context.fillStyle = '#f5f0dc';
      flat.context.fillRect(ex + 2, ey + 2, Math.ceil(meter * 3), 1);
    }
  }
  const combat = encounter?.state();
  if (combat) {
    const definition = speciesById(combat.enemy.speciesId)!;
    const size = definition.tier === 1 ? 16 : definition.tier === 2 ? 24 : 32;
    const bar = (hp: number, maxHp: number, focus: number, maxFocus: number) => {
      const { x: bx, y: by } = combatBarOrigin(
        combat.enemy.tile,
        screen,
        view.cols,
        view.rows,
        size,
      );
      flat.context.fillStyle = '#292b25';
      flat.context.fillRect(bx, by, size, 3);
      flat.context.fillStyle = '#bd7132';
      flat.context.fillRect(bx, by, (size * hp) / maxHp, 1);
      flat.context.fillStyle = '#4e8292';
      flat.context.fillRect(bx, by + 2, (size * focus) / maxFocus, 1);
    };
    bar(combat.enemy.hp, combat.enemy.maxHp, combat.enemy.focus, combat.enemy.maxFocus);
    for (const p of combat.projectiles) {
      flat.context.fillStyle = '#f4efd9';
      flat.context.fillRect(
        Math.round((p.position.x - screen.x * view.cols) * 16) - 2,
        Math.round((p.position.y - screen.y * view.rows) * 16) - 2,
        4,
        4,
      );
    }
    for (const flash of combat.flashes) {
      flat.context.fillStyle = '#ffffff99';
      flat.context.fillRect(
        Math.round((flash.at.x - screen.x * view.cols) * 16) - 8,
        Math.round((flash.at.y - screen.y * view.rows) * 16) - 12,
        16,
        16,
      );
    }
    const rect = flat.canvas.getBoundingClientRect();
    const scaleX = rect.width / flat.canvas.width;
    const scaleY = rect.height / flat.canvas.height;
    const stackIndexes = new Map<string, number>();
    tellOverlay.sync(
      tellStack.list().flatMap((tell) => {
        const combatant = combat.party.find(({ id }) => id === tell.targetId) ?? combat.enemy;
        if (!combatant) return [];
        const targetDefinition = speciesById(combatant.speciesId)!;
        const targetSize = targetDefinition.tier === 1 ? 16 : targetDefinition.tier === 2 ? 24 : 32;
        const origin = combatBarOrigin(combatant.tile, screen, view.cols, view.rows, targetSize);
        const index = stackIndexes.get(tell.targetId) ?? 0;
        stackIndexes.set(tell.targetId, index + 1);
        return [
          {
            ...tell,
            left: rect.left + (origin.x + targetSize / 2) * scaleX,
            top: rect.top + (origin.y - 8) * scaleY - index * 24,
          },
        ];
      }),
    );
  } else tellOverlay.sync([]);
  stats.afterRender(tiles.tileMs, drawCalls);
  if (key !== renderedPaletteKey) {
    document.body.style.background = `rgb(${palette.ash.shade.join(',')})`;
    renderedPaletteKey = key;
  }
};
const loop = createLoop({
  update: (dt) => {
    setElapsedSeconds(elapsedSeconds + dt);
    tellStack.update(dt);
    let combat = encounter?.state() ?? null;
    if (encounter && combat) {
      const preUpdateCombat = combat;
      if (preUpdateCombat.phase === 'fight')
        for (const member of preUpdateCombat.party) {
          const moveId = autopilot.armed(member.id);
          if (moveId && !member.downed && !member.benched) encounter.useMove(member.id, moveId);
        }
      const combatEvents = encounter.update(
        dt,
        Object.fromEntries(
          partyState.party.flatMap(({ individual }) => {
            const combatant = preUpdateCombat.party.find((member) => member.id === individual.id);
            if (combatant?.benched) return [];
            const t = partyControllers.get(individual.id)!.tile;
            return [[individual.id, { x: t.x, y: t.y }] as const];
          }),
        ),
        { x: player.tile.x, y: player.tile.y },
      );
      combat = encounter.state();
      const postUpdateCombat = combat;
      for (const event of combatEvents)
        if (event.type === 'downed' && event.target) autopilot.clear(event.target);
      if (combat.phase !== 'fight') autopilot.clearAll();
      if (shouldAskForReserve(combat, reservePrompted)) {
        const reserve = partyState.party.find(
          ({ individual }) => individual.id === postUpdateCombat.reserveId,
        );
        const reserveName = reserve ? rosterMember(reserve.individual.id)?.name : null;
        if (reserveName) {
          reservePrompted = true;
          toasts.note(`Both are down — swap ${reserveName} in.`);
        }
      }
      for (const member of combat.party)
        if (!member.downed && !member.benched)
          partyControllers.get(member.id)?.nudge(member.tile.x, member.tile.y);
      const foeEntry = arenaState?.enemy ? enemy(arenaState.enemy) : null;
      animations.push(combatEvents, (id) => {
        const partyCombatant = postUpdateCombat.party.find((candidate) => candidate.id === id);
        if (partyCombatant) return partyCombatant.tile;
        return id === foeEntry?.id ? postUpdateCombat.enemy.tile : undefined;
      });
      animations.update(dt);
      if (combat.phase !== 'fight') animations.clear();
      if (foeEntry) {
        const partyMoves = partyState.party.flatMap(({ individual }) => individual.repertoire);
        const foeIndividual = buildArenaIndividual(foeEntry);
        const newlyLearned = learnFromCombat({
          notebook,
          events: combatEvents,
          enemySpeciesId: foeEntry.speciesId,
          enemyId: foeEntry.id,
          moves: [...partyMoves, ...foeIndividual.repertoire],
          ownedIds: partyState.party.map(({ individual }) => individual.id),
          hide: speciesById(foeEntry.speciesId)!.hide,
          temperament: foeEntry.temperament,
          fightEnded: combat.phase !== 'fight',
          fightsFought: arenaProgress?.fightsFought[foeEntry.speciesId] ?? 0,
        });
        fightLearned.push(...newlyLearned);
        for (const fact of newlyLearned) toasts.note(learnedFactText(fact));
        for (const tell of tellsFromEvents(combatEvents, {
          enemyId: foeEntry.id,
          ownedIds: partyState.party.map(({ individual }) => individual.id),
        }))
          tellStack.push(tell);
        if (combat.phase !== 'fight' && !fightRecorded && arenaProgress) {
          fightRecorded = true;
          arenaProgress.runCount += 1;
          arenaProgress.fightsFought[foeEntry.speciesId] =
            (arenaProgress.fightsFought[foeEntry.speciesId] ?? 0) + 1;
          saveArenaProgress(arenaStorage, arenaProgress);
          resultScreen = createArenaResult({
            phase: combat.phase,
            enemyName: foeEntry.name,
            elapsed: combat.elapsed,
            learned: fightLearned,
            runCount: arenaProgress.runCount,
            onPickEnemy: showEnemyPicker,
            onOpenGuide: () => guide.openSpecies(foeEntry.speciesId),
          });
        }
      }
      const foe = registry
        .list()
        .find(({ speciesId }) => speciesId === postUpdateCombat.enemy.speciesId);
      if (foe) {
        const at = tileToWorld(combat.enemy.tile.x - 0.5, combat.enemy.tile.y - 0.5);
        foe.position.x = at.x;
        foe.position.z = at.z;
        foe.facing = combat.enemy.facing;
        registry.setState(foe.id, combat.enemy.downed ? 'idle' : 'walk');
      }
      for (const member of combat.party) {
        if (!member.desiredTile || member.downed || member.benched) continue;
        const controller = partyControllers.get(member.id);
        if (!controller?.moving)
          controller?.moveTo({
            tx: Math.floor(member.desiredTile.x),
            ty: Math.floor(member.desiredTile.y),
          });
      }
      for (const event of combatEvents)
        if (damageLogging && event.type === 'hit')
          eventLog.push({
            kind: 'damage',
            ts: Date.now(),
            payload: {
              attacker: event.attacker,
              move: event.move,
              base: event.base,
              hideMult: event.hideMult,
              final: event.final,
            },
          });
    }
    for (const tap of input.taps()) {
      activeFlatScreen = { sx: player.screen.x, sy: player.screen.y };
      const { tx, ty } = view.pickTile(tap.clientX, tap.clientY);
      const partyHit = partyState.party.find(({ individual }) => {
        if (combat?.party.find((member) => member.id === individual.id)?.benched) return false;
        const tile = partyControllers.get(individual.id)!.tile;
        return Math.floor(tile.x) === tx && Math.floor(tile.y) === ty;
      });
      const wildHit = registry.list().find((creature) => {
        const tile = worldToTile(creature.position.x, creature.position.z);
        return tile.tx === tx && tile.ty === ty;
      });
      if (partyHit) partyState = selectCreature(partyState, partyHit.individual.id);
      else if (Math.floor(player.tile.x) === tx && Math.floor(player.tile.y) === ty)
        partyState = selectPlayer(partyState);
      else if (wildHit)
        partyState = targetWildCreature(partyState, {
          id: wildHit.id,
          speciesId: wildHit.speciesId,
        });
      else {
        partyState = groundTapped(partyState);
        if (partyState.selection === 'player') player.tap(tap.clientX, tap.clientY);
        else partyControllers.get(partyState.selection)?.tap(tap.clientX, tap.clientY);
      }
    }
    player.update(dt);
    if (!synthetic && partyState.selection === 'player') {
      const offsets = [
        { tx: 0, ty: 1 },
        { tx: -1, ty: 1 },
        { tx: 1, ty: 1 },
      ];
      partyState.party.forEach(({ individual }, index) => {
        const follower = partyControllers.get(individual.id)!;
        const wanted = {
          tx: Math.floor(player.tile.x) + offsets[index]!.tx,
          ty: Math.floor(player.tile.y) + offsets[index]!.ty,
        };
        if (
          !follower.moving &&
          Math.hypot(follower.tile.x - wanted.tx, follower.tile.y - wanted.ty) > 2
        )
          follower.moveTo(wanted);
      });
    }
    for (const [id, controller] of partyControllers)
      if (!combat?.party.find((member) => member.id === id)?.benched) controller.update(dt);
    if (partyState.selection !== 'player') {
      const leader = partyControllers.get(partyState.selection);
      if (leader && (leader.screen.x !== player.screen.x || leader.screen.y !== player.screen.y)) {
        const destination = leader.world;
        player.teleport(destination.x, destination.z);
        partyState.party.forEach(({ individual }, index) => {
          if (individual.id === partyState.selection) return;
          const offset = [
            { x: 0, z: 2 },
            { x: -2, z: 2 },
            { x: 2, z: 2 },
          ][index]!;
          partyControllers
            .get(individual.id)!
            .teleport(destination.x + offset.x, destination.z + offset.z);
        });
      }
    }
    const world = player.world,
      region = synthetic ? null : pointToRegion(world.x, world.z),
      clock = timeAt(elapsedSeconds);
    visitedScreens.add(`${player.screen.x},${player.screen.y}`);
    const spawned = scenario
      ? { spawned: [] as string[], despawned: [] as string[] }
      : spawnSystem.update(dt, clock.phase, {
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
      if (synthetic) continue;
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
      const heard = canHearPlayer(distanceTiles, player.moving);
      if (heard) creature.facing = facingToward({ x: ct.tx, y: ct.ty }, { x: pt.tx, y: pt.ty });
      const visible = canSeePlayer(
        grid,
        { x: ct.tx, y: ct.ty },
        { x: pt.tx, y: pt.ty },
        creature.facing,
        creature.temperament,
      );
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
        nextCalls.set(creature.id, elapsedSeconds + callRng.range(10, 20));
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
    if (!synthetic) {
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
    }
    hud.update({
      ...clock,
      regionName: region?.name ?? null,
      biome: synthetic ? null : terrain.biomeAt(world.x, world.z),
      target: partyState.target
        ? { detection: aiStates.get(partyState.target.id)?.meter ?? 0.001 }
        : null,
      party: partyState.party,
      selection: partyState.selection,
      combat: encounter?.state() ?? null,
      autopilotMoveId:
        encounter?.state().phase === 'fight' ? autopilot.armed(partyState.selection) : null,
    });
    input.endFrame();
  },
  render,
});
guide = createGuideBook({
  notebook,
  mapAvailable: !synthetic,
  contextualSpecies: () => {
    const foe = arenaState?.enemy ? enemy(arenaState.enemy) : null;
    return foe?.speciesId ?? null;
  },
  debugOpen: () => debugConsole.isOpen,
  map: {
    sampler: {
      biomeAt: (x, z) => grid.tileAt(worldToTile(x, z).tx, worldToTile(x, z).ty).biome,
      waterAt: (x, z) =>
        grid.tileAt(worldToTile(x, z).tx, worldToTile(x, z).ty).surface === 'water' ? 1 : 0,
      heightAt: terrain.heightAt,
    },
    player: () => ({ ...player.world, heading: 0 }),
    screen: () => ({ ...player.screen, cols: view.cols, rows: view.rows }),
    visitedScreens: () => [...visitedScreens],
  },
  onOpenChange: (open) => (open ? loop.stop() : loop.start()),
});
hudActions.openBook = () => guide.open('index');
hudActions.openMap = () => guide.open('map');
hudActions.openConsole = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }));
window.__wyld = {
  anim: () =>
    animations.list().map((lunge) => ({
      attacker: lunge.attacker,
      moveId: lunge.moveId,
      progress: lunge.elapsed / LUNGE_SECONDS,
      offset: animations.offsetFor(lunge.attacker),
    })),
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
      region: synthetic ? null : (pointToRegion(world.x, world.z)?.id ?? null),
      biome: synthetic ? null : terrain.biomeAt(world.x, world.z),
      ...clock,
      waterDepth: depthAt(world.x, world.z),
      arena: arenaState,
      combat: encounter?.state() ?? null,
      autopilot: encounter?.state().phase === 'fight' ? [...autopilot.list()] : [],
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
          facing: c.facing,
        };
      }),
      party: partyState.party.map(({ individual, name }) => {
        const controller = partyControllers.get(individual.id)!,
          tile = controller.tile;
        return {
          id: individual.id,
          speciesId: individual.speciesId,
          name,
          tile: { x: tile.x, y: tile.y },
          facing: controller.facing,
          yaw: FACING_YAW[controller.facing],
        };
      }),
      selection: partyState.selection,
      target: partyState.target,
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
  perf: () => ({ ...stats.read(), ...(look === 'diorama' ? dioramaView!.perf() : {}) }),
  log: () => eventLog.map((entry) => ({ ...entry })),
};
installEmbedBridge();
loop.start();
