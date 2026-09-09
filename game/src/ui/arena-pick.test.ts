// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyNotebook, createNotebook } from '../guide/notebook.js';
import { createPick, type PickState } from '../arena/pick.js';
import { createArenaPick } from './arena-pick.js';

describe('arena pick UI', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  it('keeps the public arena state live through both pick screens', () => {
    let publicArena: PickState = createPick();
    const picker = createArenaPick(createNotebook(), vi.fn(), (state) => (publicArena = state));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(publicArena).toMatchObject({ phase: 'pick-party', enemy: 'antlerback', party: [] });
    for (const key of ['1', '2', '3']) window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    expect(publicArena).toMatchObject({
      phase: 'pick-party',
      enemy: 'antlerback',
      party: ['loamox', 'bramblehog', 'thornwren'],
    });
    picker.dispose();
  });

  it('removes its keyboard listener after the fight starts', () => {
    const fight = vi.fn();
    const picker = createArenaPick(createNotebook(), fight);
    picker.setState({
      phase: 'fight',
      enemy: 'antlerback',
      party: ['loamox', 'bramblehog', 'thornwren'],
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fight).toHaveBeenCalledTimes(1);
    expect(picker.state().phase).toBe('fight');
  });

  it('shows the hide name with no hint sentence on the enemy card', () => {
    const notebook = createEmptyNotebook();
    notebook.identify('antlerback', {
      region: null,
      phase: 'Day',
      position: { x: 0, y: 0, z: 0 },
      day: 0,
    });
    notebook.recordHide('antlerback', 'Bark');
    createArenaPick(notebook, vi.fn());
    const card = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Antlerback'),
    );
    expect(card?.textContent).toBe('AntlerbackHide: Bark');
  });

  it('shows nothing about the hide until it is known', () => {
    createArenaPick(createEmptyNotebook(), vi.fn());
    const card = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Antlerback'),
    );
    expect(card?.textContent).toBe('AntlerbackYou have not met this one.');
    expect(card?.textContent).not.toContain('Bark');
  });
});
