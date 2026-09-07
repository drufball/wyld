import { generateSprite } from '@wyld/sprites';
import type { Notebook } from '../guide/notebook.js';
import { arenaEnemies, arenaRoster, buildArenaIndividual } from '../arena/roster.js';
import {
  backToEnemies,
  canFight,
  chooseEnemy,
  createPick,
  startFight,
  toggleMember,
  type PickState,
} from '../arena/pick.js';
import { speciesById } from '../creatures/species.js';

const createArenaPick = (
  notebook: Notebook,
  onFight: (state: PickState) => void,
  onChange: (state: PickState) => void = () => undefined,
) => {
  const root = document.createElement('main');
  let state = createPick();
  root.setAttribute('aria-label', 'Arena selection');
  root.style.cssText =
    'position:fixed;inset:0;z-index:9;overflow:auto;box-sizing:border-box;padding:24px 16px 88px;background:#f5f0dc;background-image:repeating-linear-gradient(0deg,transparent 0 27px,#77756635 27px 28px),linear-gradient(120deg,#fff8e8aa,#e8dfc5aa);color:#292b25;font:14px/1.45 ui-monospace,monospace';
  document.body.append(root);
  const sprite = (id: string) => {
    const canvas = document.createElement('canvas');
    const definition = speciesById(id)!,
      generated = generateSprite(definition, 'down', 'idle'),
      context = canvas.getContext('2d')!;
    canvas.width = generated.width;
    canvas.height = generated.height;
    for (let y = 0; y < generated.height; y++)
      for (let x = 0; x < generated.width; x++) {
        const color = generated.palette[generated.grid[y * generated.width + x]!];
        if (color) {
          context.fillStyle = color;
          context.fillRect(x, y, 1, 1);
        }
      }
    canvas.style.cssText = `display:block;image-rendering:pixelated;width:auto;height:56px;margin:auto`;
    return canvas;
  };
  const card = (id: string, title: string, body: string, selected: boolean, click: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(selected));
    b.style.cssText = `padding:10px;border:1px solid #55584b;border-radius:2px;background:#f8f3e3;color:inherit;text-align:left;font:inherit;box-shadow:${selected ? '0 0 0 3px #8a542e' : '1px 2px 2px #0002'}`;
    b.append(sprite(id));
    const text = document.createElement('span');
    text.style.display = 'block';
    text.innerHTML = `<strong>${title}</strong><br>${body}`;
    b.append(text);
    b.onclick = click;
    return b;
  };
  const render = () => {
    root.replaceChildren();
    root.scrollTop = 0;
    const wrap = document.createElement('section');
    wrap.style.cssText = 'max-width:960px;margin:auto';
    const h = document.createElement('h1');
    h.textContent = state.phase === 'pick-enemy' ? 'Pick an enemy' : 'Pick your three';
    h.style.cssText = 'font-size:18px;line-height:1.3;font-weight:bold;margin:0 0 14px';
    wrap.append(h);
    const cards = document.createElement('div');
    cards.style.cssText =
      'display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px';
    if (state.phase === 'pick-enemy')
      for (const foe of arenaEnemies()) {
        const page = notebook.page(foe.speciesId),
          known = page && (page.identified || page.hide || page.moves.length);
        const lines = known
          ? [
              page.hide && `Hide: ${page.hide}`,
              page.weakness && `Weak to: ${page.weakness}`,
              page.resistance && `Resists: ${page.resistance}`,
              page.moves.length && `Moves: ${page.moves.join(', ')}`,
              page.temperaments.length && `Temperament: ${page.temperaments.join(', ')}`,
            ]
              .filter(Boolean)
              .join('<br>')
          : 'You have not met this one.';
        cards.append(
          card(foe.id, foe.name, lines, false, () => {
            state = chooseEnemy(state, foe.id);
            onChange(state);
            render();
          }),
        );
      }
    else
      for (const entry of arenaRoster()) {
        const individual = buildArenaIndividual(entry),
          definition = speciesById(entry.speciesId)!;
        const moves = individual.repertoire
          .map(
            (m) =>
              `<small style="display:inline-block;border:1px solid #777566;padding:2px 4px;margin:3px 2px 0 0">${m.name} · ${m.delivery} · ${m.force}</small>`,
          )
          .join('');
        cards.append(
          card(
            entry.id,
            entry.name,
            `Hide: ${definition.hide}<br>${moves}`,
            state.party.includes(entry.id),
            () => {
              state = toggleMember(state, entry.id);
              onChange(state);
              render();
            },
          ),
        );
      }
    wrap.append(cards);
    if (state.phase === 'pick-party') {
      const footer = document.createElement('div');
      footer.style.cssText =
        'position:fixed;z-index:1;left:0;right:0;bottom:0;display:flex;justify-content:center;gap:12px;align-items:center;box-sizing:border-box;padding:10px 16px;background:#f5f0dcf5;border-top:1px solid #777566;box-shadow:0 -2px 4px #0002';
      const back = document.createElement('button');
      back.textContent = 'Back';
      back.style.minHeight = '44px';
      back.onclick = () => {
        state = backToEnemies();
        onChange(state);
        render();
      };
      const count = document.createElement('span');
      count.textContent = `${state.party.length} of 3 chosen`;
      const fight = document.createElement('button');
      fight.textContent = 'Fight';
      fight.disabled = !canFight(state);
      fight.style.cssText = 'min-width:88px;min-height:44px';
      fight.onclick = () => finish();
      footer.append(back, count, fight);
      wrap.append(footer);
    }
    root.append(wrap);
  };
  const dispose = () => {
    window.removeEventListener('keydown', key);
    root.remove();
  };
  const finish = () => {
    state = startFight(state);
    if (state.phase === 'fight') {
      onChange(state);
      onFight(state);
      dispose();
    }
  };
  const key = (event: KeyboardEvent) => {
    if (state.phase === 'fight') return;
    if (state.phase === 'pick-enemy' && /^[1-3]$/.test(event.key)) {
      const x = arenaEnemies()[Number(event.key) - 1];
      if (x) {
        state = chooseEnemy(state, x.id);
        onChange(state);
        render();
      }
    } else if (state.phase === 'pick-party' && /^[1-6]$/.test(event.key)) {
      const x = arenaRoster()[Number(event.key) - 1];
      if (x) {
        state = toggleMember(state, x.id);
        onChange(state);
        render();
      }
    } else if (event.key === 'Enter') finish();
    else if (event.key === 'Escape') {
      state = backToEnemies();
      onChange(state);
      render();
    }
  };
  window.addEventListener('keydown', key);
  render();
  return {
    root,
    state: () => state,
    setState(next: PickState) {
      state = next;
      onChange(state);
      if (next.phase === 'fight') {
        onFight(next);
        dispose();
      } else render();
    },
    dispose,
  };
};
export { createArenaPick };
