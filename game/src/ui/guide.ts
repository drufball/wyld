import * as THREE from 'three';

import { buildBodyPlan } from '../creatures/bodyplans/index.js';
import { speciesById } from '../creatures/species.js';
import { stubTitle, type Notebook } from '../guide/notebook.js';
import { regions } from '../world/regions.js';

const BLANK = '______';
type GuideTab = 'index' | 'species' | 'fragments' | 'map';
type IndexRow =
  | {
      kind: 'page';
      speciesId: string;
      name: string;
      have: number;
      total: number;
      complete: boolean;
    }
  | { kind: 'stub'; id: string; title: string; hint: string }
  | { kind: 'final'; title: string };
type SpeciesPageView = {
  speciesId: string;
  name: string;
  have: number;
  total: number;
  complete: boolean;
  tracks: string;
  call: string;
  habitat: string;
  seen: string;
  hide: string;
  weakness: string;
  resistance: string;
  moves: { name: string; delivery?: string; force?: string }[] | typeof BLANK;
  temperament: string;
  bonded: string;
  sightings: { region: string; phase: string; day: string }[] | 'No sightings recorded';
};

const buildIndex = (notebook: Notebook): { rows: IndexRow[] } => {
  const pages: IndexRow[] = notebook.pages().map((page) => ({
    kind: 'page',
    speciesId: page.speciesId,
    name: page.name!,
    ...notebook.completionFraction(page.speciesId),
    complete: notebook.completion(page.speciesId),
  }));
  const stubs: IndexRow[] = notebook.stubs().map((stub) => ({
    kind: 'stub',
    id: stub.id,
    title: stubTitle(stub),
    hint: stub.hint,
  }));
  const text = (row: IndexRow): string => (row.kind === 'page' ? row.name : row.title);
  const incomplete = pages.filter((row) => row.kind === 'page' && !row.complete);
  const complete = pages.filter((row) => row.kind === 'page' && row.complete);
  incomplete.sort((a, b) => text(a).localeCompare(text(b)));
  stubs.sort((a, b) => text(a).localeCompare(text(b)));
  complete.sort((a, b) => text(a).localeCompare(text(b)));
  const rows = [...incomplete, ...stubs, ...complete];
  if (notebook.finalPage() !== null) rows.push({ kind: 'final', title: 'Final page' });
  return { rows };
};

const buildSpeciesPage = (notebook: Notebook, speciesId: string): SpeciesPageView => {
  const page = notebook.page(speciesId);
  const definition = speciesById(speciesId);
  if (!page || !definition) throw new Error(`Unknown or unidentified species: ${speciesId}`);
  const regionName = (id: string): string =>
    regions().find((region) => region.id === id)?.name ?? id;
  const fraction = notebook.completionFraction(speciesId);
  const moves =
    page.moves.length === 0
      ? BLANK
      : page.moves.map((name) => {
          const move = definition.signatureMoves.find((entry) => entry.name === name);
          return { name, delivery: move?.delivery, force: move?.force };
        });
  return {
    speciesId,
    name: page.name!,
    ...fraction,
    complete: notebook.completion(speciesId),
    tracks: page.tracks ? definition.hints.tracks : BLANK,
    call: page.call ? definition.hints.call : BLANK,
    habitat: page.habitat.length ? page.habitat.map(regionName).join(', ') : BLANK,
    seen: page.phases.length ? page.phases.join(', ') : BLANK,
    hide: page.hide ?? BLANK,
    weakness: page.weakness ? `Takes heavy damage from ${page.weakness}` : BLANK,
    resistance: page.resistance ? `Shrugs off ${page.resistance}` : BLANK,
    moves,
    temperament: page.temperaments.length ? page.temperaments.join(', ') : BLANK,
    bonded: page.captured ? 'Yes' : BLANK,
    sightings: page.sightings.length
      ? page.sightings.map((sighting) => ({
          region: sighting.region === null ? 'Uncharted' : regionName(sighting.region),
          phase: sighting.phase,
          day: sighting.day === 0 ? 'before the journal began' : `Day ${sighting.day}`,
        }))
      : 'No sightings recorded',
  };
};

const buildFragments = (): { rows: []; empty: 'Nothing yet.' } => ({
  rows: [],
  empty: 'Nothing yet.',
});

type GuideOptions = {
  notebook: Notebook;
  renderer: THREE.WebGLRenderer;
  onOpenChange?(open: boolean): void;
  debugOpen?(): boolean;
};
const createGuideBook = ({
  notebook,
  renderer,
  onOpenChange,
  debugOpen = () => false,
}: GuideOptions) => {
  let opened = false;
  let currentTab: GuideTab = 'index';
  let speciesId: string | null = null;
  let final = false;
  let pending: { speciesId: string; merged: number } | null = null;
  const silhouettes = new Map<string, HTMLCanvasElement>();
  const root = document.createElement('section');
  root.hidden = true;
  root.setAttribute('aria-label', 'Field guide');
  root.style.cssText =
    'position:fixed;inset:0;z-index:8;box-sizing:border-box;padding:clamp(8px,3vw,28px);overflow:hidden;color:#292b25;background:#252820cc;font:14px/1.55 ui-monospace,"Segoe UI",monospace';
  document.body.append(root);

  const button = (text: string, action: () => void): HTMLButtonElement => {
    const element = document.createElement('button');
    element.textContent = text;
    element.style.cssText =
      'border:0;border-bottom:1px solid #777566;padding:7px 12px;background:transparent;color:inherit;font:inherit;cursor:pointer';
    element.addEventListener('click', action);
    return element;
  };
  const silhouette = (id: string): HTMLCanvasElement => {
    const cached = silhouettes.get(id);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const definition = speciesById(id);
    if (!('getRenderTarget' in renderer)) return canvas;
    const context = canvas.getContext('2d');
    if (!definition || !context) return canvas;
    const model = buildBodyPlan(definition);
    const material = new THREE.MeshBasicMaterial({ color: 0x292b25 });
    model.group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.material = material;
    });
    const box = new THREE.Box3().setFromObject(model.group);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y) * 0.65;
    const camera = new THREE.OrthographicCamera(-span, span, span * 0.56, -span * 0.56, 0.01, 100);
    camera.position.set(centre.x + size.z * 1.8 + 2, centre.y, centre.z + size.x * 1.8 + 2);
    camera.lookAt(centre);
    const target = new THREE.WebGLRenderTarget(canvas.width, canvas.height);
    const previousTarget = renderer.getRenderTarget();
    const previousColour = renderer.getClearColor(new THREE.Color());
    const previousAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(model.group, camera);
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, canvas.width, canvas.height, pixels);
    const flipped = new Uint8ClampedArray(pixels.length);
    const row = canvas.width * 4;
    for (let y = 0; y < canvas.height; y++)
      flipped.set(pixels.subarray(y * row, (y + 1) * row), (canvas.height - y - 1) * row);
    context.putImageData(new ImageData(flipped, canvas.width, canvas.height), 0, 0);
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousColour, previousAlpha);
    model.dispose();
    target.dispose();
    material.dispose();
    silhouettes.set(id, canvas);
    return canvas;
  };
  const renderPage = (): void => {
    root.replaceChildren();
    const book = document.createElement('div');
    book.style.cssText =
      'box-sizing:border-box;height:100%;max-width:1100px;margin:auto;padding:clamp(12px,3vw,32px);overflow:auto;border:1px solid #777566;border-radius:3px 7px 4px 9px;background:repeating-linear-gradient(0deg,transparent 0,transparent 27px,#b9b39b55 28px),repeating-linear-gradient(93deg,#f5f0dc 0,#f5f0dc 5px,#f0ead2 6px);box-shadow:1px 2px 2px #0006';
    const tabs = document.createElement('nav');
    tabs.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid #777566';
    for (const [tab, label] of [
      ['index', 'Index'],
      ['species', 'Species'],
      ['fragments', 'Fragments'],
      ['map', 'Map'],
    ] as const)
      tabs.append(
        button(label, () => {
          currentTab = tab;
          if (tab !== 'species') final = false;
          renderPage();
        }),
      );
    const content = document.createElement('main');
    content.style.cssText = 'min-width:0;padding:16px 4px';
    if (currentTab === 'index') {
      const heading = document.createElement('h1');
      heading.textContent = 'Field guide';
      content.append(heading);
      let stubHeading = false;
      for (const row of buildIndex(notebook).rows) {
        if (row.kind === 'stub' && !stubHeading) {
          const h = document.createElement('h2');
          h.textContent = 'Unidentified';
          content.append(h);
          stubHeading = true;
        }
        if (row.kind === 'page')
          content.append(
            button(`${row.name}  ${row.have}/${row.total}`, () => {
              speciesId = row.speciesId;
              currentTab = 'species';
              renderPage();
            }),
          );
        else if (row.kind === 'stub') {
          const line = document.createElement('div');
          line.textContent = `${row.title} — ${row.hint}`;
          line.style.cssText = 'padding:7px 12px';
          content.append(line);
        } else
          content.append(
            button(row.title, () => {
              final = true;
              currentTab = 'species';
              renderPage();
            }),
          );
      }
    } else if (currentTab === 'fragments') content.textContent = buildFragments().empty;
    else if (currentTab === 'map') content.textContent = 'The map is not drawn yet.';
    else if (final) {
      const h = document.createElement('h1');
      h.textContent = 'Complete';
      const p = document.createElement('p');
      p.textContent = notebook.closingText();
      const stamp = document.createElement('strong');
      stamp.textContent = 'Complete';
      stamp.style.cssText =
        'display:inline-block;border:3px double #292b25;padding:8px;transform:rotate(-3deg);text-transform:uppercase';
      content.append(h, p, stamp);
    } else if (speciesId) {
      const view = buildSpeciesPage(notebook, speciesId);
      const header = document.createElement('header');
      const h = document.createElement('h1');
      h.textContent = `${view.name}  ${view.have}/${view.total}`;
      header.append(silhouette(speciesId), h);
      content.append(header);
      const lines: [string, string][] = [
        ['Tracks', view.tracks],
        ['Call', view.call],
        ['Habitat', view.habitat],
        ['Seen', view.seen],
        ['Hide', view.hide],
        ['Weakness', view.weakness],
        ['Resistance', view.resistance],
        ['Temperament', view.temperament],
        ['Bonded', view.bonded],
      ];
      for (const [label, value] of lines) {
        const p = document.createElement('div');
        p.textContent = `${label}: ${value}`;
        content.append(p);
      }
      const moves = document.createElement('div');
      moves.append('Moves: ');
      if (view.moves === BLANK) moves.append(BLANK);
      else
        for (const move of view.moves) {
          const item = document.createElement('div');
          item.textContent = move.name + ' ';
          for (const badge of [move.delivery, move.force]) {
            const span = document.createElement('span');
            span.textContent = badge ?? '';
            span.style.cssText =
              'display:inline-block;border:1px solid #777566;border-radius:999px;padding:0 6px;margin:2px';
            item.append(span);
          }
          moves.append(item);
        }
      content.append(moves);
      const sightings = document.createElement('div');
      sightings.style.cssText =
        'max-height:150px;overflow:auto;border-top:1px solid #777566;margin-top:8px';
      sightings.append('Sightings: ');
      if (typeof view.sightings === 'string') sightings.append(view.sightings);
      else
        view.sightings.forEach((s) => {
          const line = document.createElement('div');
          line.textContent = `${s.region}, ${s.phase} — ${s.day}`;
          sightings.append(line);
        });
      content.append(sightings);
      if (pending?.speciesId === speciesId) {
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          content.style.animation = 'wyld-guide-merge 550ms ease-out';
        }
        pending = null;
      }
    }
    book.append(tabs, content);
    root.append(book);
  };
  const setOpen = (value: boolean): void => {
    if (opened === value) return;
    opened = value;
    root.hidden = !value;
    if (value) {
      if (pending) {
        speciesId = pending.speciesId;
        currentTab = 'species';
      }
      renderPage();
    }
    onOpenChange?.(value);
  };
  const keydown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (debugOpen() || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
      return;
    if (event.key.toLowerCase() === 'g') {
      event.preventDefault();
      setOpen(!opened);
    } else if (event.key === 'Escape' && opened) {
      event.preventDefault();
      setOpen(false);
    }
  };
  window.addEventListener('keydown', keydown);
  const style = document.createElement('style');
  style.textContent =
    '@keyframes wyld-guide-merge{from{transform:translateX(-18%);opacity:.25}to{transform:none;opacity:1}} @media(min-width:700px){[aria-label="Field guide"] main{columns:2;column-gap:48px}} [aria-label="Field guide"] canvas{display:block;max-width:100%;height:min(180px,22vh)}';
  document.head.append(style);
  return {
    open(tab?: GuideTab) {
      if (tab) currentTab = tab;
      setOpen(true);
    },
    close() {
      setOpen(false);
    },
    toggle() {
      setOpen(!opened);
    },
    setTab(tab: GuideTab) {
      currentTab = tab;
      if (opened) renderPage();
    },
    refresh() {
      if (opened) renderPage();
    },
    noteMerge(id: string, merged: number) {
      if (merged > 0) pending = { speciesId: id, merged };
    },
    get isOpen() {
      return opened;
    },
    get tab() {
      return currentTab;
    },
    dispose() {
      window.removeEventListener('keydown', keydown);
      root.remove();
      style.remove();
      silhouettes.clear();
    },
  };
};

export { BLANK, buildFragments, buildIndex, buildSpeciesPage, createGuideBook };
export type { GuideTab, IndexRow, SpeciesPageView };
