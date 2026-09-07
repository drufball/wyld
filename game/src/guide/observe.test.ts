import { beforeEach, describe, expect, it } from 'vitest';

import { createEmptyNotebook, type Notebook } from './notebook.js';
import { createObserver, type ObserveFrame, type ObservedCreature } from './observe.js';

const creature = (overrides: Partial<ObservedCreature> = {}): ObservedCreature => ({
  id: 'bramblehog-1',
  speciesId: 'bramblehog',
  region: 'hollow',
  position: { x: 0, y: 0, z: 0 },
  distance: 10,
  moving: false,
  inView: true,
  wild: true,
  temperament: 'Bold',
  ...overrides,
});
const frame = (overrides: Partial<ObserveFrame> = {}): ObserveFrame => ({
  day: 1,
  phase: 'Day',
  region: 'hollow',
  playerPosition: { x: 0, y: 0, z: 0 },
  tracks: [],
  creatures: [],
  ...overrides,
});

describe('observer', () => {
  let notebook: Notebook;
  beforeEach(() => {
    notebook = createEmptyNotebook();
  });

  it('records tracks within three tiles once, but not beyond three tiles', () => {
    const observer = createObserver({ notebook });
    expect(
      observer.update(0, frame({ tracks: [{ speciesId: 'bramblehog', x: 2.9, z: 0 }] })),
    ).toHaveLength(1);
    expect(
      observer.update(0, frame({ tracks: [{ speciesId: 'bramblehog', x: 2.9, z: 0 }] })),
    ).toHaveLength(0);
    const other = createObserver({ notebook: createEmptyNotebook() });
    expect(
      other.update(0, frame({ tracks: [{ speciesId: 'bramblehog', x: 3.1, z: 0 }] })),
    ).toHaveLength(0);
  });

  it('distance-gates creature calls at 25 m', () => {
    const near = createObserver({ notebook });
    expect(
      near.onCreatureCalled({ species: 'bramblehog', position: { x: 24, y: 0, z: 0 } }, frame()),
    ).toHaveLength(1);
    const far = createObserver({ notebook: createEmptyNotebook() });
    expect(
      far.onCreatureCalled({ species: 'bramblehog', position: { x: 26, y: 0, z: 0 } }, frame()),
    ).toHaveLength(0);
  });

  it('distance-gates creature aggro at 25 m without requiring a call event', () => {
    const near = createObserver({ notebook });
    expect(
      near.onCreatureAggro({ species: 'bramblehog', position: { x: 24, y: 0, z: 0 } }, frame()),
    ).toHaveLength(1);
    const far = createObserver({ notebook: createEmptyNotebook() });
    expect(
      far.onCreatureAggro({ species: 'bramblehog', position: { x: 26, y: 0, z: 0 } }, frame()),
    ).toHaveLength(0);
  });

  it('names newly found tracks for an identified species', () => {
    notebook.identify('bramblehog', {
      region: 'hollow',
      phase: 'Day',
      position: { x: 0, y: 0, z: 0 },
      day: 1,
    });
    const observer = createObserver({ notebook });
    expect(
      observer.update(0, frame({ tracks: [{ speciesId: 'bramblehog', x: 1, z: 0 }] })),
    ).toMatchObject([{ title: 'Bramblehog: tracks' }]);
  });

  it('identifies at 1.5 cumulative seconds across a gap and merges both stubs', () => {
    notebook.recordTracks('bramblehog', { region: 'hollow', day: 1 });
    notebook.recordCall('bramblehog', { region: 'hollow', day: 1 });
    const observer = createObserver({ notebook });
    expect(observer.update(0.75, frame({ creatures: [creature()] }))).toHaveLength(0);
    expect(observer.identifying()).toEqual({ species: 'bramblehog', progress: 0.5 });
    expect(observer.update(4, frame({ creatures: [creature({ inView: false })] }))).toHaveLength(0);
    const result = observer.update(0.75, frame({ creatures: [creature()] }));
    expect(result[0]).toMatchObject({
      slot: 'identified',
      merged: 2,
      title: 'Identified: Bramblehog. Two earlier notes attached.',
    });
  });

  it.each([{ inView: false }, { distance: 40.1 }, { wild: false }])(
    'does not identify an ineligible individual: %o',
    (override) => {
      const observer = createObserver({ notebook });
      expect(observer.update(2, frame({ creatures: [creature(override)] }))).toHaveLength(0);
      expect(notebook.page('bramblehog')).toBeNull();
    },
  );

  it('adds a repeat sighting and phase without a toast, with a 30 second guard', () => {
    notebook.identify('bramblehog', {
      region: 'hollow',
      phase: 'Day',
      position: { x: 0, y: 0, z: 0 },
      day: 1,
    });
    const observer = createObserver({ notebook });
    expect(observer.update(1.5, frame({ phase: 'Dusk', creatures: [creature()] }))).toEqual([]);
    expect(notebook.page('bramblehog')?.sightings).toHaveLength(2);
    observer.update(1.5, frame({ phase: 'Night', creatures: [creature()] }));
    expect(notebook.page('bramblehog')?.sightings).toHaveLength(2);
    expect(notebook.page('bramblehog')?.phases).toContain('Dusk');
  });

  it('records temperament after 20 cumulative moving seconds only', () => {
    const observer = createObserver({ notebook });
    observer.update(10, frame({ creatures: [creature({ moving: true })] }));
    observer.update(10, frame({ creatures: [creature({ moving: false })] }));
    const result = observer.update(10, frame({ creatures: [creature({ moving: true })] }));
    expect(result.some(({ slot }) => slot === 'temperament')).toBe(true);
    const stationary = createObserver({ notebook: createEmptyNotebook() });
    stationary.update(30, frame({ creatures: [creature()] }));
    expect(stationary.update(30, frame({ creatures: [creature()] }))).toEqual([]);
  });

  it('drops per-creature timers when an individual despawns', () => {
    const observer = createObserver({ notebook });
    observer.update(1, frame({ creatures: [creature()] }));
    observer.update(0, frame());
    expect(observer.identifying()).toEqual({ species: null, progress: 0 });
    observer.update(0.5, frame({ creatures: [creature()] }));
    expect(notebook.page('bramblehog')).toBeNull();
  });
});
