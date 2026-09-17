// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import type { CombatState } from '../combat/encounter.js';
import type { Individual } from '../creatures/individual.js';
import { createHud, traySizing, updateDetectionTarget, type HudState } from './hud.js';

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
const combatState = (party = [creature('a')]): CombatState => {
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
    cooldowns: { 'loamox:move': { remaining: 2, total: 4 } },
    desiredTile: null,
    threat: 0,
    lineToEnemy: true,
    blockedAt: null,
    reachTiles: 1.25,
    grace: 0,
  });
  return {
    phase: 'fight',
    elapsed: 1,
    enemy: member(creature('enemy')),
    party: party.map((entry, index) => member(entry, index === 2)),
    reserveId: party[2]?.individual.id ?? null,
    autoDeployIn: null,
    swapCooldown: { remaining: 0, total: 6 },
    projectiles: [],
    flashes: [],
  };
};
afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
});
describe('thumb HUD', () => {
  it('uses the published tray sizing table', () => {
    expect([2, 3, 4].map((scale) => traySizing(scale).controlPx)).toEqual([44, 56, 64]);
    for (const scale of [2, 3, 4]) {
      expect(traySizing(scale).font).toMatch(/ui-monospace,monospace$/);
      expect(traySizing(scale).detailFont).toMatch(/ui-monospace,monospace$/);
    }
    expect([2, 3, 4].map((scale) => traySizing(scale).detailFont)).toEqual([
      '9px/10px ui-monospace,monospace',
      '9px/11px ui-monospace,monospace',
      '10px/12px ui-monospace,monospace',
    ]);
    expect(traySizing(99)).toEqual(traySizing(3));
  });
  it('a second update with the same state makes no DOM mutations', () => {
    const hud = createHud(false, document.body);
    const current = state(undefined, 'a');
    hud.update(current);
    const observer = new MutationObserver(() => undefined);
    observer.observe(hud.tray, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    hud.update(current);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('a running cooldown updates the move button in place', () => {
    const party = [creature('a')];
    const combat = combatState(party);
    const hud = createHud(false, document.body);
    hud.update({ ...state(party, 'a'), combat });
    const button = document.querySelector('[data-move-id]') as HTMLButtonElement;
    const observer = new MutationObserver(() => undefined);
    observer.observe(hud.tray, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    const changed = structuredClone(combat);
    changed.party[0]!.cooldowns['loamox:move']!.remaining = 1;
    hud.update({ ...state(party, 'a'), combat: changed });
    expect(document.querySelector('[data-move-id]')).toBe(button);
    const records = observer.takeRecords();
    expect(records).toHaveLength(2);
    expect(records.map(({ target }) => target)).toEqual([button.firstChild, button]);
    observer.disconnect();
  });

  it('a party member going down updates its card in place', () => {
    const party = [creature('a')];
    const combat = combatState(party);
    const hud = createHud(false, document.body);
    hud.update({ ...state(party), combat });
    const card = document.querySelector('[data-party-id]') as HTMLButtonElement;
    const changed = structuredClone(combat);
    changed.party[0]!.downed = true;
    hud.update({ ...state(party), combat: changed });
    expect(document.querySelector('[data-party-id]')).toBe(card);
    expect(card.childNodes[0]?.textContent).toBe('a\nDown');
  });

  it('the reserve card appears when a member is benched and disappears when it is not', () => {
    const party = [creature('a'), creature('b'), creature('reserve')];
    const combat = combatState(party);
    const hud = createHud(false, document.body);
    hud.update({ ...state(party), combat });
    const first = document.querySelector('[data-party-id="a"]');
    const reserve = document.querySelector('[data-reserve]');
    expect(reserve).not.toBeNull();
    const changed = structuredClone(combat);
    changed.party[2]!.benched = false;
    hud.update({ ...state(party), combat: changed });
    expect(document.querySelector('[data-party-id="a"]')).toBe(first);
    expect(document.querySelector('[data-party-id="reserve"]')).toBe(reserve);
    expect(document.querySelector('[data-reserve]')).toBeNull();
  });
  it('renders one party card per party member', () => {
    const hud = createHud(false, document.body);
    hud.update(state([creature('a'), creature('b')]));
    expect(document.querySelectorAll('[data-party-id]')).toHaveLength(2);
  });
  it('shows the temperament word on a party card', () => {
    const hud = createHud(false, document.body);
    hud.update(state([creature('Barrow')]));
    const card = document.querySelector('[data-party-id="Barrow"]');
    expect(card?.textContent).toBe('Barrow\nSteady');
    expect(card?.getAttribute('title')).toBe('loamox');
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
  it('dims the autopilot mark while the creature is out of reach', () => {
    const hud = createHud(false, document.body);
    hud.update({
      ...state(undefined, 'a'),
      autopilotMoveId: 'loamox:move',
      autopilotYielding: true,
    });
    const button = document.querySelector('[data-move-id]') as HTMLButtonElement;
    expect(button.dataset.autopilot).toBe('yielding');
    expect(button.style.outline).toBe('2px dashed #bd7132');
    expect(button.textContent).toContain('↻');
    expect(button.getAttribute('aria-pressed')).toBe('true');
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
      threat: 0,
      lineToEnemy: true,
      blockedAt: null,
      reachTiles: 1.25,
      grace: 0,
    };
    const combat: CombatState = {
      phase: 'fight',
      elapsed: 1,
      enemy: combatant,
      party: [combatant],
      reserveId: null,
      autoDeployIn: null,
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
  it.each([
    { scale: 2, controlPx: 44 },
    { scale: 3, controlPx: 56 },
  ])('keeps the one-out tray inside 375px at scale $scale', ({ scale, controlPx }) => {
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
      threat: 0,
      lineToEnemy: true,
      blockedAt: null,
      reachTiles: 1.25,
      grace: 0,
    });
    const combat: CombatState = {
      phase: 'fight',
      elapsed: 1,
      enemy: combatant(creature('enemy')),
      party: party.map((member, index) => ({ ...combatant(member), benched: index > 0 })),
      reserveId: 'Quill',
      autoDeployIn: null,
      swapCooldown: { remaining: 0, total: 6 },
      projectiles: [],
      flashes: [],
    };
    const hud = createHud(true, document.body, {}, { scale });
    hud.update({ ...state(party, 'Barrow'), combat } satisfies HudState);

    const innerWidth = 375 - 16;
    const gap = 4;
    const moves = [...document.querySelectorAll<HTMLButtonElement>('[data-move-id]')];
    const tools = [
      ...document.querySelectorAll<HTMLButtonElement>('[data-tray-row="tools"] button'),
    ];
    const cards = [...document.querySelectorAll<HTMLButtonElement>('[data-party-id]')];
    const moveWidth = (innerWidth - gap * (moves.length - 1)) / moves.length;
    const toolWidth = controlPx;
    const cardArea = innerWidth - tools.length * toolWidth - gap * tools.length;
    const cardSpace = cardArea - gap * (cards.length - 1);
    const reserveWidth = Math.max(controlPx, cardSpace / 4);
    const cardWidths = [cardSpace - 2 * reserveWidth, reserveWidth, reserveWidth];
    const rightEdges = [
      ...moves.map((_, index) => 8 + (index + 1) * moveWidth + index * gap),
      ...cardWidths.map(
        (_, index) =>
          8 + cardWidths.slice(0, index + 1).reduce((sum, width) => sum + width, 0) + index * gap,
      ),
      ...tools.map((_, index) => 8 + cardArea + gap + (index + 1) * toolWidth + index * gap),
    ];

    expect(moves).toHaveLength(3);
    expect(rightEdges.every((edge) => edge <= 375 - 8)).toBe(true);
    expect([...moves, ...cards, ...tools].map((button) => button.style.height)).toEqual(
      Array.from({ length: moves.length + cards.length + tools.length }, () => `${controlPx}px`),
    );
  });
  it('shows one out card and two reserve cards, in party order', () => {
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
      threat: 0,
      lineToEnemy: true,
      blockedAt: null,
      reachTiles: 1.25,
      grace: 0,
    });
    const combat: CombatState = {
      phase: 'fight',
      elapsed: 0,
      enemy: combatant(creature('enemy')),
      party: [combatant(party[0]!), combatant(party[1]!, true), combatant(party[2]!, true)],
      reserveId: 'Quill',
      autoDeployIn: null,
      swapCooldown: { remaining: 0, total: 6 },
      projectiles: [],
      flashes: [],
    };
    const swapped: string[] = [];
    const hud = createHud(false, document.body, { swapIn: (id) => swapped.push(id) });
    hud.update({ ...state(party), combat });
    const cards = [...document.querySelectorAll<HTMLButtonElement>('[data-party-id]')];
    expect(cards.map((card) => card.dataset.partyId)).toEqual(['Barrow', 'Quill', 'Pip']);
    expect(cards.map((card) => card.style.flex)).toEqual(['2 1 0px', '1 1 0px', '1 1 0px']);
    expect(cards.map((card) => card.hasAttribute('data-reserve'))).toEqual([false, true, true]);
    expect(cards[1]!.textContent).toContain('Quillreserve · tap to swap');
    expect(cards[2]!.textContent).toContain('Pipreserve · tap to swap');
    cards[2]!.click();
    expect(swapped).toEqual(['Pip']);
  });

  it('glows the reserve card when a swap is ready', () => {
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
      threat: 0,
      lineToEnemy: true,
      blockedAt: null,
      reachTiles: 1.25,
      grace: 0,
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
        autoDeployIn: null,
        swapCooldown: { remaining: 0, total: 6 },
        projectiles: [],
        flashes: [],
      },
    });
    expect(document.querySelector('[data-reserve]')?.getAttribute('data-swap-state')).toBe('ready');
  });

  it('keeps the reserve card tappable during the swap cooldown', () => {
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
      threat: 0,
      lineToEnemy: true,
      blockedAt: null,
      reachTiles: 1.25,
      grace: 0,
    });
    hud.update({
      ...state(party),
      combat: {
        phase: 'fight',
        elapsed: 0,
        enemy: member(creature('enemy')),
        party: [member(party[0]!), member(party[1]!), member(party[2]!, true)],
        reserveId: 'reserve',
        autoDeployIn: null,
        swapCooldown: { remaining: 4.2, total: 6 },
        projectiles: [],
        flashes: [],
      },
    });
    const button = document.querySelector('[data-reserve]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('◷5');
    expect(button.style.background).toContain('linear-gradient');
  });
  it("a standing reserve's card drops the cooldown fill when the cooldown ends", () => {
    const party = [creature('a'), creature('b'), creature('reserve')];
    const combat = combatState(party);
    combat.swapCooldown = { remaining: 3, total: 6 };
    const hud = createHud(false, document.body);
    hud.update({ ...state(party), combat });
    const button = document.querySelector('[data-reserve]') as HTMLButtonElement;
    expect(button.style.background).toContain('linear-gradient');

    combat.swapCooldown = { remaining: 0, total: 6 };
    hud.update({ ...state(party), combat });
    expect(document.querySelector('[data-reserve]')).toBe(button);
    expect(button.style.background).toBe('rgba(244, 239, 217, 0.933)');
  });
  it('suppresses location for a synthetic scenario', () => {
    const hud = createHud(true, document.body);
    hud.update({ ...state(), biome: null });
    expect(document.querySelector('[aria-label="Time and place"]')?.children[2]).toHaveProperty(
      'hidden',
      true,
    );
  });
  const reserveHud = (
    options: { downed?: boolean; autoDeployIn?: number | null; notice?: HudState['notice'] } = {},
  ) => {
    const party = [creature('a'), creature('b'), creature('reserve')];
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
      downed: Boolean(options.downed && entry.individual.id === 'a'),
      benched,
      cooldowns: {},
      desiredTile: null,
      threat: 0,
      lineToEnemy: true,
      blockedAt: null,
      grace: 0,
    });
    const combat: CombatState = {
      phase: 'fight',
      elapsed: 1,
      enemy: { ...member(creature('enemy')), reachTiles: 1.25 },
      party: [member(party[0]!), member(party[1]!), member(party[2]!, true)],
      reserveId: 'reserve',
      autoDeployIn: options.autoDeployIn ?? null,
      swapCooldown: { remaining: 0, total: 6 },
      projectiles: [],
      flashes: [],
    };
    const hud = createHud(false, document.body);
    hud.update({ ...state(party, 'a'), combat, notice: options.notice });
    return hud;
  };
  it('pulses the reserve card while an active creature is down', () => {
    reserveHud({ downed: true });
    expect(document.querySelector('[data-reserve]')?.getAttribute('data-swap-state')).toBe(
      'urgent',
    );
  });
  it('shows the countdown on the reserve card while the reserve is coming in', () => {
    reserveHud({ autoDeployIn: 1.2 });
    expect(document.querySelector('[data-reserve] small')?.textContent).toBe('Coming in… 2');
  });
  it('shows a reason on the card that was tapped', () => {
    reserveHud({ notice: { id: 'reserve', text: 'Pick who to swap out', refused: false } });
    expect(document.querySelector('[data-reserve]')?.getAttribute('data-notice')).toBe(
      'Pick who to swap out',
    );
  });
  it('flashes a dashed outline and reason on a refused move', () => {
    reserveHud({ notice: { id: 'loamox:move', text: 'Too far — get closer', refused: true } });
    const button = document.querySelector('[data-move-id]') as HTMLButtonElement;
    expect(button.dataset.refused).toBe('');
    expect(button.style.outline).toBe('3px dashed #b3261e');
  });
  it('labels the two tray rows Yours and Moves', () => {
    reserveHud();
    expect(
      [...document.querySelectorAll('[data-tray-label]')].map((label) => label.textContent),
    ).toEqual(['Moves', 'Yours']);
  });
  it('has no separate swap button', () => {
    reserveHud();
    expect(document.querySelector('[data-swap]')).toBeNull();
  });
  it('renders a downed reserve as a dim, inert plain card', () => {
    const party = [creature('a'), creature('b'), creature('reserve')];
    const selected: string[] = [];
    const combatant = (entry: (typeof party)[number], benched = false) => ({
      id: entry.individual.id,
      speciesId: entry.individual.speciesId,
      hp: 0,
      maxHp: 70,
      focus: 40,
      maxFocus: 40,
      tile: { x: 1, y: 1 },
      facing: 0,
      windup: null,
      downed: benched,
      benched,
      cooldowns: {},
      desiredTile: null,
      threat: 0,
      lineToEnemy: true,
      blockedAt: null,
      grace: 0,
    });
    const hud = createHud(false, document.body, {
      selectCreature: (id) => selected.push(id),
      swapIn: (id) => selected.push(id),
    });
    hud.update({
      ...state(party),
      combat: {
        phase: 'fight',
        elapsed: 1,
        enemy: { ...combatant(creature('enemy')), reachTiles: 1.25 },
        party: [combatant(party[0]!), combatant(party[1]!), combatant(party[2]!, true)],
        reserveId: 'reserve',
        autoDeployIn: null,
        swapCooldown: { remaining: 0, total: 6 },
        projectiles: [],
        flashes: [],
      },
    });
    const card = document.querySelector<HTMLButtonElement>('[data-party-id="reserve"]')!;
    expect(card.childNodes[0]?.textContent).toBe('reserve\nDown');
    expect(card.style.opacity).toBe('0.45');
    expect(card.hasAttribute('data-reserve')).toBe(false);
    card.click();
    expect(selected).toEqual([]);
  });
});
