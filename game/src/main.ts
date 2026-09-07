import worldData from './data/world.json';
import { createInput } from './engine/input.js';
import { createLoop } from './engine/loop.js';
import { createRng, resolveSeed } from './engine/rng.js';
import { createNotebook, stubTitle } from './guide/notebook.js';
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
import { camps, pointToRegion } from './world/regions.js';
import { createTerrain } from './world/terrain.js';
import { createTileGrid } from './world/tiles.js';
import { nextPhaseStart, phases, timeAt } from './world/time.js';
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
const view = createCanvas(),
  tiles = createTileRenderer(grid),
  debugConsole = createDebugConsole({ seed }),
  stats = createStatsPanel(debugConsole.available),
  toasts = createToastStack(),
  hud = createHud(debugConsole.available, toasts.root),
  notebook = createNotebook();
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
const input = createInput(
  view.canvas,
  () => debugConsole.isOpen || guide?.isOpen || Boolean(player.sliding),
);
createControlsCard(debugConsole.available, () => debugConsole.isOpen);
let elapsedSeconds = 0;
const setTime = (n: number) => {
  elapsedSeconds = n;
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
    setTime(nextPhaseStart(elapsedSeconds, phase));
    return `time: ${phase}, day ${timeAt(elapsedSeconds).day}`;
  },
});
debugConsole.registerCommand('tp', {
  help: 'tp <campName> or tp <x> <z>',
  run: (args) => {
    const x = Number(args[0]),
      z = Number(args[1]);
    if (args.length === 2 && Number.isFinite(x) && Number.isFinite(z)) {
      player.teleport(x, z);
      return `teleported: ${x}, ${z}`;
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
    if (target === 'map') {
      notebook.revealAllFog();
      guide.refresh();
      return 'map revealed';
    }
    if (target === 'guide') return 'guide revealed';
    return 'usage: reveal <guide|map>';
  },
});
const render = () => {
  const clock = timeAt(elapsedSeconds),
    palette = paletteAt(clock.phase, clock.phaseProgress),
    screen = player.screen;
  const layer = tiles.layer(
    screen.x,
    screen.y,
    view.cols,
    view.rows,
    palette,
    paletteKey(clock.phase, clock.phaseProgress),
  );
  view.context.drawImage(layer, 0, 0);
  const tile = player.tile,
    x = (tile.x - screen.x * view.cols) * 16 - 8,
    y = (tile.y - screen.y * view.rows) * 16 - 20,
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
  stats.afterRender(tiles.tileMs, calls);
  document.body.style.background = `rgb(${palette.ash.shade.join(',')})`;
};
const loop = createLoop({
  update: (dt) => {
    elapsedSeconds += dt;
    for (const tap of input.taps()) player.tap(tap.clientX, tap.clientY);
    player.update(dt);
    const world = player.world,
      region = pointToRegion(world.x, world.z),
      clock = timeAt(elapsedSeconds);
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
  log: () => [],
};
loop.start();
