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
import { blit } from './render2d/blit.js';
import { createCanvas } from './render2d/canvas.js';
import { pixelScale, screenCols, screenRows } from './render2d/canvas.js';
import { lookFromQuery } from './render3d/look.js';
import { createDiorama } from './render3d/renderer.js';
import { paletteAt, paletteKey } from './render2d/palette.js';
import { playerSprite } from './render2d/player-sprite.js';
import { spriteOrigin } from './render2d/placement.js';
import { createTileRenderer } from './render2d/tiles.js';
import { buildState } from './state.js';
import { createControlsCard } from './ui/controls.js';
import { createDebugConsole } from './ui/debug.js';
import { createGuideBook } from './ui/guide.js';
import { createHud } from './ui/hud.js';
import { createStatsPanel } from './ui/stats.js';
import { createArenaPick } from './ui/arena-pick.js';
import { buildArenaIndividual, enemy, rosterMember } from './arena/roster.js';
import { createPick, chooseEnemy, toggleMember, startFight, type PickState } from './arena/pick.js';
import { resistance, weakness } from './combat/hides.js';
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
const flatView = look === 'flat' ? createCanvas({ screen: () => activeFlatScreen }) : null;
const view = dioramaView ?? flatView!;
const scenarioStart = synthetic
  ? { tx: Math.floor(view.cols / 2), ty: Math.floor(view.rows / 2) }
  : scenario?.start;
let tiles = createTileRenderer(grid, synthetic ? [] : trackPlacements);
const debugConsole = createDebugConsole({ seed }),
  stats = createStatsPanel(debugConsole.available),
  toasts = createToastStack(),
  hudActions: Parameters<typeof createHud>[2] = {},
  hud = createHud(debugConsole.available, toasts.root, hudActions),
  notebook = createNotebook(),
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
      speedTilesPerSecond: (3 + member.individual.stats.speed * 0.6) / 2,
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
    speedTilesPerSecond: (3 + member.individual.stats.speed * 0.6) / 2,
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
  arenaState = state;
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
};
let arenaPick: ReturnType<typeof createArenaPick> | null = null;
if (synthetic) arenaPick = createArenaPick(notebook, beginArena, (state) => (arenaState = state));
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
const render = (alpha = 1) => {
  const clock = timeAt(elapsedSeconds),
    palette = paletteAt(clock.phase, clock.phaseProgress),
    key = paletteKey(clock.phase, clock.phaseProgress),
    screen = player.screen;
  activeFlatScreen = { sx: screen.x, sy: screen.y };
  if (look === 'diorama') {
    const yaw = { down: 0, up: Math.PI, right: -Math.PI / 2, left: Math.PI / 2 } as const;
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
      creatures: registry
        .list()
        .filter((creature) => onScreen(creature.position.x, creature.position.z, 1))
        .map((creature) => ({
          key: creature.id,
          speciesId: creature.speciesId,
          tileX: (creature.position.x + 400) / TILE_METRES,
          tileY: (creature.position.z + 400) / TILE_METRES,
          facing: creature.facing,
          state: creature.state,
          phaseOffset: creature.frameClock,
          meter: aiStates.get(creature.id)?.meter ?? 0,
        })),
      party: partyState.party.flatMap((member, index) => {
        const controller = partyControllers.get(member.individual.id)!;
        const tile = controller.interpolated(alpha);
        if (!tileOnScreen(tile.x, tile.y, 1)) return [];
        return [
          {
            key: member.individual.id,
            speciesId: member.individual.speciesId,
            tileX: tile.x,
            tileY: tile.y,
            facing: yaw[controller.facing],
            state: controller.moving ? ('walk' as const) : ('idle' as const),
            phaseOffset: index,
          },
        ];
      }),
      selection: partyState.selection,
    });
    stats.afterRender(result.frameMs, result.drawCalls);
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
  const calls =
    1 +
    blit(
      flat.context,
      playerSprite(
        player.facing === 'left' || player.facing === 'right' ? 'side' : player.facing,
        frame,
      ),
      x,
      y,
      player.facing === 'left',
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
      origin = spriteOrigin(tx, ty, size, size);
    if (partyState.selection === member.individual.id) {
      flat.context.strokeStyle = definition.palette.accent ?? '#bd7132';
      flat.context.lineWidth = 1;
      flat.context.beginPath();
      flat.context.ellipse(Math.round(tx * 16), Math.round(ty * 16 + 4), 7, 3, 0, 0, Math.PI * 2);
      flat.context.stroke();
    }
    drawCalls += drawCreatureSprite(
      flat.context,
      member.individual.speciesId,
      'down',
      controller.moving ? 'walk0' : 'idle',
      origin.x,
      origin.y,
      false,
    );
  }
  for (const creature of registry.list()) {
    if (!onScreen(creature.position.x, creature.position.z, 1)) continue;
    const definition = speciesById(creature.speciesId)!;
    const tx = (creature.position.x + 400) / 2 - screen.x * view.cols,
      ty = (creature.position.z + 400) / 2 - screen.y * view.rows,
      size = definition.tier === 1 ? 16 : definition.tier === 2 ? 24 : 32,
      origin = spriteOrigin(tx, ty, size, size);
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
      flat.context,
      creature.speciesId,
      facing,
      frame,
      origin.x,
      origin.y,
      flip,
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
  stats.afterRender(tiles.tileMs, drawCalls);
  if (key !== renderedPaletteKey) {
    document.body.style.background = `rgb(${palette.ash.shade.join(',')})`;
    renderedPaletteKey = key;
  }
};
const loop = createLoop({
  update: (dt) => {
    setElapsedSeconds(elapsedSeconds + dt);
    for (const tap of input.taps()) {
      activeFlatScreen = { sx: player.screen.x, sy: player.screen.y };
      const { tx, ty } = view.pickTile(tap.clientX, tap.clientY);
      const partyHit = partyState.party.find(({ individual }) => {
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
    for (const controller of partyControllers.values()) controller.update(dt);
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
    });
    input.endFrame();
  },
  render,
});
guide = createGuideBook({
  notebook,
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
      party: partyState.party.map(({ individual, name }) => {
        const tile = partyControllers.get(individual.id)!.tile;
        return {
          id: individual.id,
          speciesId: individual.speciesId,
          name,
          tile: { x: tile.x, y: tile.y },
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
loop.start();
