// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNotebook } from '../guide/notebook.js';
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
});
