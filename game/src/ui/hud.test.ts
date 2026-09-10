// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import type { CombatState } from '../combat/encounter.js';
import type { Individual } from '../creatures/individual.js';
import { createHud, updateDetectionTarget, type HudState } from './hud.js';

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
  it("executes the selected creature's move button", () => {
    let used = '';
    const hud = createHud(false, document.body, { useMove: (id) => (used = id) });
    hud.update(state(undefined, 'a'));
    const button = document.querySelector('[data-move-id]') as HTMLButtonElement;
    button.click();
    expect(used).toBe('loamox:move');
  });
  it('lights the armed move button and marks it pressed', () => {
    const hud = createHud(false, document.body);
    hud.update({ ...state(undefined, 'a'), autopilotMoveId: 'loamox:move' });
    const button = document.querySelector('[data-move-id]') as HTMLButtonElement;
    expect(button.textContent).toContain('Move ↻');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.style.outline).toBe('2px solid #bd7132');
  });
  it('leaves every move button tappable during a fight', () => {
    const selected = creature('a');
    const combatant = {
      id: 'a',
      speciesId: 'loamox',
      hp: 70,
      maxHp: 70,
      focus: 0,
      maxFocus: 40,
      tile: { x: 1, y: 1 },
      facing: 0,
      windup: null,
      downed: false,
      benched: false,
      cooldowns: { 'loamox:move': { remaining: 1, total: 2 } },
      desiredTile: null,
    };
    const combat: CombatState = {
      phase: 'fight',
      elapsed: 1,
      enemy: combatant,
      party: [combatant],
      reserveId: null,
      swapCooldown: { remaining: 0, total: 6 },
      projectiles: [],
      flashes: [],
    };
    const hud = createHud(false, document.body);
    hud.update({ ...state([selected], 'a'), combat });
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('[data-move-id]')].every(
        (button) => !button.disabled,
      ),
    ).toBe(true);
  });
  it('hides the console button when the console is unavailable', () => {
    createHud(false, document.body);
    expect(document.querySelector('[aria-label="Console"]')).toBeNull();
  });
  it('keeps three party cards, three moves, and all tools inside a 375px tray', () => {
    const selected = creature('Barrow');
    selected.individual.repertoire = [
      ...selected.individual.repertoire,
      { ...selected.individual.repertoire[0]!, id: 'loamox:move-2', name: 'Trample' },
      { ...selected.individual.repertoire[0]!, id: 'loamox:move-3', name: 'Stampede' },
    ];
    const party = [selected, creature('Quill'), creature('Pip')];
    const combatant = (member: (typeof party)[number]) => ({
      id: member.individual.id,
      speciesId: member.individual.speciesId,
      hp: 70,
      maxHp: 70,
      focus: 40,
      maxFocus: 40,
      tile: { x: 1, y: 1 },
      facing: 0,
      windup: null,
      downed: false,
      benched: false,
      cooldowns: {},
      desiredTile: null,
    });
    const combat: CombatState = {
      phase: 'fight',
      elapsed: 1,
      enemy: combatant(creature('enemy')),
      party: party.map(combatant),
      reserveId: null,
      swapCooldown: { remaining: 0, total: 6 },
      projectiles: [],
      flashes: [],
    };
    const hud = createHud(true, document.body);
    hud.update({ ...state(party, 'Barrow'), combat } satisfies HudState);

    const innerWidth = 375 - 16;
    const gap = 4;
    const moves = [...document.querySelectorAll<HTMLButtonElement>('[data-move-id]')];
    const tools = [
      ...document.querySelectorAll<HTMLButtonElement>('[data-tray-row="tools"] button'),
    ];
    const cards = [...document.querySelectorAll<HTMLButtonElement>('[data-party-id]')];
    const moveWidth = (innerWidth - gap * (moves.length - 1)) / moves.length;
    const toolWidth = 44;
    const cardArea = innerWidth - tools.length * toolWidth - gap * tools.length;
    const cardWidth = (cardArea - gap * (cards.length - 1)) / cards.length;
    const rightEdges = [
      ...moves.map((_, index) => 8 + (index + 1) * moveWidth + index * gap),
      ...cards.map((_, index) => 8 + (index + 1) * cardWidth + index * gap),
      ...tools.map((_, index) => 8 + cardArea + gap + (index + 1) * toolWidth + index * gap),
    ];

    expect(moves).toHaveLength(3);
    expect(rightEdges.every((edge) => edge <= 375 - 8)).toBe(true);
    expect([...moves, ...cards, ...tools].map((button) => button.style.height)).toEqual(
      Array.from({ length: moves.length + cards.length + tools.length }, () => '44px'),
    );
  });
  it('offers a forty-four pixel swap button naming the reserve', () => {
    const party = [creature('Barrow'), creature('Quill'), creature('Pip')];
    const combatant = (member: (typeof party)[number], benched = false) => ({
      id: member.individual.id,
      speciesId: member.individual.speciesId,
      hp: 70,
      maxHp: 70,
      focus: 40,
      maxFocus: 40,
      tile: { x: 1, y: 1 },
      facing: 0,
      windup: null,
      downed: false,
      benched,
      cooldowns: {},
      desiredTile: null,
    });
    const combat: CombatState = {
      phase: 'fight',
      elapsed: 0,
      enemy: combatant(creature('enemy')),
      party: [combatant(party[0]!), combatant(party[1]!), combatant(party[2]!, true)],
      reserveId: 'Pip',
      swapCooldown: { remaining: 0, total: 6 },
      projectiles: [],
      flashes: [],
    };
    const swapped: string[] = [];
    const hud = createHud(false, document.body, { swap: () => swapped.push('swap') });
    hud.update({ ...state(party), combat });
    const button = document.querySelector('[data-swap]') as HTMLButtonElement;
    expect(button.textContent).toBe('Swap · Pipshrugs off Surge');
    expect(button.style.minWidth).toBe('44px');
    expect(button.style.height).toBe('44px');
    button.click();
    expect(swapped).toEqual(['swap']);
  });

  it('shows what the reserve shrugs off on the swap button', () => {
    const party = [creature('Barrow'), creature('Quill'), creature('Pip')];
    const member = (entry: (typeof party)[number], benched = false) => ({
      id: entry.individual.id,
      speciesId: entry.individual.speciesId,
      hp: 70,
      maxHp: 70,
      focus: 40,
      maxFocus: 40,
      tile: { x: 1, y: 1 },
      facing: 0,
      windup: null,
      downed: false,
      benched,
      cooldowns: {},
      desiredTile: null,
    });
    const hud = createHud(false, document.body);
    hud.update({
      ...state(party),
      combat: {
        phase: 'fight',
        elapsed: 0,
        enemy: member(creature('enemy')),
        party: [member(party[0]!), member(party[1]!), member(party[2]!, true)],
        reserveId: 'Pip',
        swapCooldown: { remaining: 0, total: 6 },
        projectiles: [],
        flashes: [],
      },
    });
    expect(document.querySelector('[data-swap] small')?.textContent).toBe('shrugs off Surge');
  });

  it('disables the swap button while its cooldown runs', () => {
    const party = [creature('a'), creature('b'), creature('reserve')];
    const hud = createHud(false, document.body);
    const member = (entry: (typeof party)[number], benched = false) => ({
      id: entry.individual.id,
      speciesId: entry.individual.speciesId,
      hp: 70,
      maxHp: 70,
      focus: 40,
      maxFocus: 40,
      tile: { x: 1, y: 1 },
      facing: 0,
      windup: null,
      downed: false,
      benched,
      cooldowns: {},
      desiredTile: null,
    });
    hud.update({
      ...state(party),
      combat: {
        phase: 'fight',
        elapsed: 0,
        enemy: member(creature('enemy')),
        party: [member(party[0]!), member(party[1]!), member(party[2]!, true)],
        reserveId: 'reserve',
        swapCooldown: { remaining: 4.2, total: 6 },
        projectiles: [],
        flashes: [],
      },
    });
    const button = document.querySelector('[data-swap]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('◷5');
    expect(button.style.background).toContain('linear-gradient');
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
