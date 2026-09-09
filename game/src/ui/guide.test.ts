// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { buildArenaIndividual, enemy, rosterMember } from '../arena/roster.js';
import { createEncounter } from '../combat/encounter.js';
import { speciesById } from '../creatures/species.js';
import { createEmptyNotebook, type Notebook } from '../guide/notebook.js';
import { BLANK, buildFragments, buildIndex, buildSpeciesPage, createGuideBook } from './guide.js';

const observation = (day = 1) => ({
  region: 'hollow',
  phase: 'Day' as const,
  position: { x: 0, y: 0, z: 0 },
  day,
});
const identify = (notebook: Notebook, id: string): void => {
  notebook.identify(id, observation());
};
const map = {
  sampler: {
    biomeAt: () => 'forest' as const,
    waterAt: () => 0,
    heightAt: () => 0,
  },
};
const complete = (notebook: Notebook, id: string): void => {
  const data = speciesById(id)!;
  identify(notebook, id);
  notebook.recordTracks(id, observation());
  notebook.recordCall(id, observation());
  notebook.recordHide(id, data.hide);
  notebook.recordWeakness(id, 'Cut');
  notebook.recordResistance(id, 'Surge');
  data.signatureMoves.forEach(({ name }) => notebook.recordMove(id, name));
  notebook.recordTemperament(id, 'Steady');
  notebook.recordCapture(id);
};

describe('field guide view model', () => {
  afterEach(() => document.body.replaceChildren());

  it('orders incomplete pages, stubs, then complete pages', () => {
    const notebook = createEmptyNotebook();
    identify(notebook, 'glasswing');
    notebook.recordTracks('bramblehog', { region: 'hollow', day: 1 });
    complete(notebook, 'loamox');
    expect(
      buildIndex(notebook)
        .rows.slice(0, 3)
        .map(({ kind }) => kind),
    ).toEqual(['page', 'stub', 'page']);
  });

  it('sorts displayed text alphabetically within each group', () => {
    const notebook = createEmptyNotebook();
    identify(notebook, 'loamox');
    identify(notebook, 'glasswing');
    const names = buildIndex(notebook)
      .rows.filter((row) => row.kind === 'page')
      .map((row) => row.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('does not expose species name or id in stub rendered fields', () => {
    const notebook = createEmptyNotebook();
    notebook.recordCall('glasswing', { region: null, day: 1 });
    const row = buildIndex(notebook).rows[0]!;
    expect(row.kind).toBe('stub');
    if (row.kind === 'stub')
      expect(`${row.title} ${row.hint}`.toLowerCase()).not.toContain('glasswing');
  });

  it('uses the notebook completion fraction including three moves', () => {
    const notebook = createEmptyNotebook();
    identify(notebook, 'glasswing');
    const row = buildIndex(notebook).rows[0];
    expect(row?.kind === 'page' && row.total).toBe(notebook.completionFraction('glasswing').total);
  });

  it('resolves discovered identification facts and missing facts', () => {
    const notebook = createEmptyNotebook();
    notebook.recordTracks('glasswing', { region: 'hollow', day: 1 });
    identify(notebook, 'glasswing');
    const page = buildSpeciesPage(notebook, 'glasswing');
    expect(page.tracks).not.toBe(BLANK);
    expect(page.habitat).not.toBe(BLANK);
    expect(page.seen).not.toBe(BLANK);
    expect([
      page.call,
      page.hide,
      page.weakness,
      page.resistance,
      page.moves,
      page.temperament,
      page.bonded,
    ]).toEqual(Array(7).fill(BLANK));
  });

  it('formats day zero and later sightings', () => {
    const notebook = createEmptyNotebook();
    notebook.identify('glasswing', observation(0));
    notebook.recordSighting('glasswing', observation(3));
    const sightings = buildSpeciesPage(notebook, 'glasswing').sightings;
    expect(sightings).not.toBe('No sightings recorded');
    if (typeof sightings !== 'string')
      expect(sightings.map(({ day }) => day)).toEqual(['before the journal began', 'Day 3']);
  });

  it('uses field-guide weakness and resistance wording', () => {
    const notebook = createEmptyNotebook();
    identify(notebook, 'loamox');
    notebook.recordWeakness('loamox', 'Cut');
    notebook.recordResistance('loamox', 'Surge');
    expect(buildSpeciesPage(notebook, 'loamox')).toMatchObject({
      weakness: 'Takes heavy damage from Cut',
      resistance: 'Shrugs off Surge',
    });
  });

  it('shows the hide name with no hint sentence on the guide species page', () => {
    const notebook = createEmptyNotebook();
    identify(notebook, 'antlerback');
    notebook.recordHide('antlerback', 'Bark');
    expect(buildSpeciesPage(notebook, 'antlerback').hide).toBe('Bark');
  });

  it('shows nothing about the hide until it is known', () => {
    const notebook = createEmptyNotebook();
    identify(notebook, 'antlerback');
    expect(buildSpeciesPage(notebook, 'antlerback').hide).toBe(BLANK);
  });

  it('builds the empty fragments view', () =>
    expect(buildFragments()).toEqual({ rows: [], empty: 'Nothing yet.' }));

  it('renders blanks and discovered hints into the open book', () => {
    const notebook = createEmptyNotebook();
    notebook.recordTracks('glasswing', { region: 'hollow', day: 1 });
    identify(notebook, 'glasswing');
    const book = createGuideBook({ notebook, map });
    book.open();
    [...document.querySelectorAll('button')]
      .find((item) => item.textContent?.includes('Glasswing'))
      ?.click();
    expect(document.body.textContent).toContain(BLANK);
    expect(document.body.textContent).toContain(speciesById('glasswing')!.hints.tracks);
    book.dispose();
  });

  it('does not advance the encounter while the guide is open', () => {
    const member = buildArenaIndividual(rosterMember('loamox')!);
    const foe = buildArenaIndividual(enemy('antlerback')!);
    const encounter = createEncounter({
      party: [member],
      enemy: foe,
      grid: { isWalkable: () => true },
      rng: { next: () => 0 },
      partyTiles: { [member.id]: { x: 0, y: 0 } },
      enemyTile: { x: 1, y: 0 },
      player: { x: 0, y: 0 },
    });
    const move = member.repertoire[0]!;
    expect(encounter.useMove(member.id, move.id)).toBe(true);

    let running = true;
    const frame = (): void => {
      if (running) encounter.update(0.25);
    };
    const book = createGuideBook({
      notebook: createEmptyNotebook(),
      map,
      onOpenChange: (open) => (running = !open),
    });
    frame();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    const paused = encounter.state();
    frame();
    frame();
    expect(encounter.state().elapsed).toBe(paused.elapsed);
    expect(encounter.state().party[0]!.cooldowns[move.id]!.remaining).toBe(
      paused.party[0]!.cooldowns[move.id]!.remaining,
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    frame();
    expect(encounter.state().elapsed).toBeGreaterThan(paused.elapsed);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    const pausedAgain = encounter.state().elapsed;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    frame();
    expect(encounter.state().elapsed).toBeGreaterThan(pausedAgain);
    book.dispose();
  });
});
