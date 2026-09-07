// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import type { Individual } from '../creatures/individual.js';
import { createHud, updateDetectionTarget } from './hud.js';

const elements = () => {
  const attributes = new Map<string, string>();
  const outlineAttributes = new Map<string, string>();
  return {
    attributes,
    outlineAttributes,
    value: {
      bar: { style: { display: 'unset' } },
      fill: { setAttribute: (name: string, value: string) => attributes.set(name, value) },
      outline: {
        setAttribute: (name: string, value: string) => outlineAttributes.set(name, value),
      },
    },
  };
};

describe('HUD detection target', () => {
  it('is hidden without a target', () => {
    const target = elements();
    updateDetectionTarget(target.value, null);
    expect(target.value.bar.style.display).toBe('none');
  });

  it('is visible with a detecting target', () => {
    const target = elements();
    updateDetectionTarget(target.value, { detection: 0.25 });
    expect(target.value.bar.style.display).toBe('flex');
  });

  it('scales and completes the eye fill with the meter', () => {
    const target = elements();
    updateDetectionTarget(target.value, { detection: 0.5 });
    expect(target.attributes.get('width')).toBe('19');
    updateDetectionTarget(target.value, { detection: 1 });
    expect(target.attributes.get('width')).toBe('38');
    expect(target.outlineAttributes.get('stroke')).toBe('#292b25');
  });
});

const creature = (id: string): { individual: Individual; name: string } => ({
  name: id,
  individual: {
    id,
    speciesId: 'loamox',
    temperament: 'Steady',
    stats: { vigor: 70, power: 3, speed: 4, focus: 40 },
    repertoire: [
      {
        id: 'loamox:move',
        name: 'Move',
        delivery: 'Strike',
        force: 'Impact',
        power: 1,
        speed: 1,
        cooldownMult: 1,
        rangeMult: 1,
        modifiers: [],
        familiarity: 0,
        upgradeLevel: 0,
      },
    ],
  },
});
const state = (party = [creature('a')], selection = 'player') => ({
  phase: 'Day' as const,
  phaseProgress: 0,
  day: 1,
  dayProgress: 0,
  regionName: null,
  biome: 'forest',
  party,
  selection,
});
afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
});
describe('thumb HUD', () => {
  it('renders one party card per party member', () => {
    const hud = createHud(false, document.body);
    hud.update(state([creature('a'), creature('b')]));
    expect(document.querySelectorAll('[data-party-id]')).toHaveLength(2);
  });
  it("marks the selected creature's card", () => {
    const hud = createHud(false, document.body);
    hud.update(state(undefined, 'a'));
    expect(document.querySelector('[data-party-id="a"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
  it("renders the selected creature's move buttons as inert", () => {
    const hud = createHud(false, document.body);
    hud.update(state(undefined, 'a'));
    const button = document.querySelector('[data-move-id]') as HTMLButtonElement;
    button.click();
    expect(button.textContent).toBe('Not yet.');
  });
  it('hides the console button when the console is unavailable', () => {
    createHud(false, document.body);
    expect(
      [...document.querySelectorAll('button')].some((button) => button.textContent === 'Console'),
    ).toBe(false);
  });
  it('suppresses location for a synthetic scenario', () => {
    const hud = createHud(true, document.body);
    hud.update({ ...state(), biome: null });
    expect(document.querySelector('[aria-label="Time and place"]')?.children[2]).toHaveProperty(
      'hidden',
      true,
    );
  });
});
