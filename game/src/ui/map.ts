import { species, speciesById } from '../creatures/species.js';
import type { Notebook } from '../guide/notebook.js';
import { FOG_CELL_METRES, FOG_COLUMNS, cellCentre } from '../guide/fog.js';
import { camps, regions } from '../world/regions.js';

type WorldSampler = {
  biomeAt(x: number, z: number): 'forest' | 'desert' | 'archipelago' | 'volcano';
  waterAt(x: number, z: number): number;
  heightAt(x: number, z: number): number;
};
type MapViewOptions = {
  notebook: Notebook;
  sampler: WorldSampler;
  player?: () => { x: number; z: number; heading: number };
  selectedSpecies?: () => string | null;
};

const SIZE = 200;
const DISPLAY_SCALE = 4;
const PAPER = '#f4efd9';
const washes = { forest: '#8fa17b', desert: '#cdbb82', archipelago: '#93aea5', volcano: '#9a7766' };
const createMapView = ({
  notebook,
  sampler,
  player = () => ({ x: 0, z: 0, heading: 0 }),
  selectedSpecies = () => null,
}: MapViewOptions) => {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE * DISPLAY_SCALE;
  canvas.height = SIZE * DISPLAY_SCALE;
  canvas.setAttribute('aria-label', 'Field guide map');
  canvas.style.cssText =
    'display:block;width:min(100%,min(72vh,800px));height:auto;aspect-ratio:1;margin:auto;border:1px solid #777566;background:#f4efd9';
  let base: HTMLCanvasElement | null = null;
  const pixel = (metres: number): number => ((metres + 400) / 800) * SIZE;
  const buildBase = (): HTMLCanvasElement => {
    const result = document.createElement('canvas');
    result.width = SIZE;
    result.height = SIZE;
    const context = result.getContext('2d')!;
    const image = context.createImageData(SIZE, SIZE);
    for (let row = 0; row < SIZE; row += 1)
      for (let column = 0; column < SIZE; column += 1) {
        const x = -398 + column * 4;
        const z = -398 + row * 4;
        const colour = sampler.waterAt(x, z) > 0 ? '#afc8c4' : washes[sampler.biomeAt(x, z)];
        const rgb = colour.match(/[a-f\d]{2}/gi)!.map((part) => Number.parseInt(part, 16));
        const offset = (row * SIZE + column) * 4;
        image.data.set([...rgb, 220], offset);
      }
    context.putImageData(image, 0, 0);
    context.strokeStyle = '#586c68';
    context.globalAlpha = 0.45;
    // A sampled shoreline gives the wash an inked boundary without world-module coupling.
    for (let row = 1; row < SIZE; row += 1)
      for (let column = 1; column < SIZE; column += 1) {
        const x = -398 + column * 4;
        const z = -398 + row * 4;
        const wet = sampler.waterAt(x, z) > 0;
        if (wet !== sampler.waterAt(x - 4, z) > 0 || wet !== sampler.waterAt(x, z - 4) > 0)
          context.strokeRect(column, row, 1, 1);
      }
    return result;
  };
  const render = (): void => {
    base ??= buildBase();
    const context = canvas.getContext('2d')!;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(base, 0, 0, canvas.width, canvas.height);
    context.scale(DISPLAY_SCALE, DISPLAY_SCALE);
    context.fillStyle = PAPER;
    context.shadowColor = PAPER;
    context.shadowBlur = 3;
    for (let index = 0; index < FOG_COLUMNS * FOG_COLUMNS; index += 1)
      if (!notebook.fog().isRevealed(index)) {
        const centre = cellCentre(index);
        context.fillRect(
          pixel(centre.x) - 3,
          pixel(centre.z) - 3,
          FOG_CELL_METRES / 4 + 1,
          FOG_CELL_METRES / 4 + 1,
        );
      }
    context.shadowBlur = 0;
    const selected = speciesById(selectedSpecies() ?? '');
    if (selected) {
      context.strokeStyle = selected.palette.primary;
      context.lineWidth = 1.3;
      context.setLineDash([3, 2]);
      for (const habitat of selected.habitat) {
        const region = regions().find(({ id }) => id === habitat.region);
        if (region) {
          context.beginPath();
          context.arc(pixel(region.x), pixel(region.z), region.radius / 4, 0, Math.PI * 2);
          context.stroke();
        }
      }
      context.setLineDash([]);
    }
    const knownCamps = new Set(notebook.discoveredCamps());
    context.font = '3px ui-monospace,monospace';
    context.fillStyle = '#292b25';
    for (const camp of camps())
      if (knownCamps.has(camp.id)) {
        const x = pixel(camp.x),
          y = pixel(camp.z);
        context.fillRect(x - 1, y - 1, 3, 3);
        context.fillText(camp.name, x + 3, y + 1);
      }
    for (const definition of species()) {
      const page = notebook.page(definition.id);
      if (!page) continue;
      context.fillStyle = definition.palette.primary;
      for (const sighting of page.sightings) {
        const x = pixel(sighting.position.x),
          y = pixel(sighting.position.z);
        context.beginPath();
        context.arc(x, y, 1.5, 0, Math.PI * 2);
        context.fill();
      }
    }
    const position = player();
    const x = pixel(position.x),
      y = pixel(position.z);
    context.fillStyle = '#292b25';
    context.beginPath();
    context.arc(x, y, 2, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#292b25';
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.sin(position.heading) * 7, y + Math.cos(position.heading) * 7);
    context.stroke();
  };
  return { canvas, render };
};

export { createMapView };
export type { MapViewOptions, WorldSampler };
