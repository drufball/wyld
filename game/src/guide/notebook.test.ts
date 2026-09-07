import { describe, expect, it } from 'vitest';
import { species } from '../creatures/species.js';
import {
  createEmptyNotebook,
  createNotebook,
  notebookFromJSON,
  stubTitle,
  type Notebook,
} from './notebook.js';

const observation = (day = 1) => ({
  region: 'hollow',
  phase: 'Day' as const,
  position: { x: 1, y: 2, z: 3 },
  day,
});

const completeSpecies = (notebook: Notebook, id: string): void => {
  const definition = species().find((entry) => entry.id === id)!;
  notebook.recordTracks(id, { region: 'hollow', day: 1 });
  notebook.recordCall(id, { region: 'hollow', day: 1 });
  notebook.identify(id, observation());
  notebook.recordHide(id, definition.hide);
  notebook.recordWeakness(id, 'Impact');
  notebook.recordResistance(id, 'Cut');
  definition.signatureMoves.forEach(({ name }) => notebook.recordMove(id, name));
  notebook.recordTemperament(id, 'Bold');
  notebook.recordCapture(id);
};

describe('field guide notebook', () => {
  it('adding tracks then call for bramblehog yields exactly two stubs and no page', () => {
    const notebook = createEmptyNotebook();
    notebook.recordTracks('bramblehog', { region: 'hollow', day: 1 });
    notebook.recordCall('bramblehog', { region: 'hollow', day: 1 });
    expect(notebook.stubs()).toHaveLength(2);
    expect(notebook.page('bramblehog')).toBeNull();
  });

  it('identifying bramblehog yields one page carrying both facts and zero stubs, with merged 2', () => {
    const notebook = createEmptyNotebook();
    notebook.recordTracks('bramblehog', { region: 'hollow', day: 1 });
    notebook.recordCall('bramblehog', { region: 'hollow', day: 1 });
    expect(notebook.identify('bramblehog', observation())).toEqual({ identified: true, merged: 2 });
    expect(notebook.pages()).toHaveLength(1);
    expect(notebook.page('bramblehog')).toMatchObject({ tracks: { day: 1 }, call: { day: 1 } });
    expect(notebook.stubs()).toHaveLength(0);
  });

  it("completion('bramblehog') is false after identification", () => {
    const notebook = createEmptyNotebook();
    notebook.identify('bramblehog', observation());
    expect(notebook.completion('bramblehog')).toBe(false);
  });

  it("filling every slot for bramblehog makes completion('bramblehog') true", () => {
    const notebook = createEmptyNotebook();
    completeSpecies(notebook, 'bramblehog');
    expect(notebook.completion('bramblehog')).toBe(true);
    expect(notebook.completionFraction('bramblehog')).toEqual({ have: 12, total: 12 });
  });

  it('overallCompletion on a fresh createNotebook is 1/13 and only Loamox is complete', () => {
    const notebook = createNotebook();
    expect(notebook.overallCompletion()).toBe(1 / 13);
    expect(
      species()
        .filter(({ id }) => notebook.completion(id))
        .map(({ id }) => id),
    ).toEqual(['loamox']);
    expect(notebook.page('loamox')?.sightings).toHaveLength(2);
  });

  it('a fully-populated notebook round-trips deep-equal through JSON', () => {
    const notebook = createEmptyNotebook();
    species().forEach(({ id }) => completeSpecies(notebook, id));
    notebook.recordRumour('bramblehog', { region: null, day: 3 });
    const restored = notebookFromJSON(JSON.parse(JSON.stringify(notebook.toJSON())));
    expect(restored.toJSON()).toEqual(notebook.toJSON());
  });

  it('notebookFromJSON throws on a wrong schemaVersion', () => {
    expect(() =>
      notebookFromJSON({ schemaVersion: 2, pages: [], stubs: [], completedAt: null }),
    ).toThrow(/schemaVersion/);
  });

  it('appending 21 sightings caps the list at 20 and drops the oldest', () => {
    const notebook = createEmptyNotebook();
    for (let day = 1; day <= 21; day += 1) notebook.recordSighting('bramblehog', observation(day));
    expect(notebook.identify('bramblehog', observation(22))).toEqual({
      identified: true,
      merged: 0,
    });
    expect(notebook.page('bramblehog')?.sightings.map(({ day }) => day)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 3),
    );
  });

  it('appending 11 rumours caps the list at 10 and drops the oldest', () => {
    const notebook = createEmptyNotebook();
    for (let day = 1; day <= 11; day += 1)
      notebook.recordRumour('bramblehog', { region: null, day });
    notebook.identify('bramblehog', observation());
    expect(notebook.page('bramblehog')?.rumours.map(({ day }) => day)).toEqual(
      Array.from({ length: 10 }, (_, index) => index + 2),
    );
  });

  it('stubTitle renders Forest (Pond Hollow) and omits the place for a null region', () => {
    const notebook = createEmptyNotebook();
    const located = notebook.recordTracks('bramblehog', { region: 'pond-hollow', day: 1 }).stub!;
    const unknown = createEmptyNotebook().recordTracks('bramblehog', {
      region: null,
      day: 1,
    }).stub!;
    expect(stubTitle(located)).toContain('Forest (Pond Hollow)');
    expect(stubTitle(unknown)).not.toContain('Forest');
  });

  it('createNotebook has no pyreclaw page', () => {
    expect(createNotebook().page('pyreclaw')).toBeNull();
  });

  it('recording the same fact twice is a no-op', () => {
    const notebook = createEmptyNotebook();
    expect(notebook.recordTracks('bramblehog', { region: null, day: 1 }).recorded).toBe(true);
    expect(notebook.recordTracks('bramblehog', { region: null, day: 2 }).recorded).toBe(false);
    expect(notebook.recordHide('bramblehog', 'Bark')).toBe(true);
    expect(notebook.recordHide('bramblehog', 'Bark')).toBe(false);
    expect(notebook.recordMove('bramblehog', 'Tumble')).toBe(true);
    expect(notebook.recordMove('bramblehog', 'Tumble')).toBe(false);
  });

  it('finalPage is null until every species is complete, then returns the closing text', () => {
    const notebook = createEmptyNotebook();
    expect(notebook.finalPage()).toBeNull();
    species().forEach(({ id }) => completeSpecies(notebook, id));
    expect(notebook.finalPage()).toEqual({
      text: notebook.closingText(),
      completedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
    });
  });
});
