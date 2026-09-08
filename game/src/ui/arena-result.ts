import { learnedFactText, type LearnedFact } from '../arena/learning.js';

type ArenaResultOptions = {
  phase: 'win' | 'driven-off';
  enemyName: string;
  elapsed: number;
  learned: readonly LearnedFact[];
  runCount: number;
  onPickEnemy(): void;
  onOpenGuide(): void;
};
const createArenaResult = (options: ArenaResultOptions) => {
  const root = document.createElement('main');
  root.setAttribute('aria-label', 'Arena result');
  root.style.cssText =
    'position:fixed;inset:0;z-index:10;overflow:auto;box-sizing:border-box;padding:clamp(20px,8vw,72px);background:repeating-linear-gradient(0deg,#f5f0dc 0 27px,#cac3a8 28px);color:#292b25;font:15px/1.55 ui-monospace,monospace';
  const outcome = document.createElement('h1');
  const seconds = Math.round(options.elapsed);
  outcome.textContent =
    options.phase === 'win'
      ? `Downed the ${options.enemyName} in ${seconds} s`
      : `Driven off after ${seconds} s`;
  const run = document.createElement('p');
  run.textContent = `Run ${options.runCount}`;
  const learned = document.createElement('section');
  if (options.learned.length) {
    const heading = document.createElement('h2');
    heading.textContent = 'You learned:';
    learned.append(heading);
    for (const fact of options.learned) {
      const line = document.createElement('p');
      line.textContent = learnedFactText(fact);
      learned.append(line);
    }
  } else learned.textContent = 'You learned nothing new this time.';
  const pick = document.createElement('button');
  pick.textContent = 'Pick an enemy';
  pick.onclick = options.onPickEnemy;
  const guide = document.createElement('button');
  guide.textContent = `Open ${options.enemyName} guide page`;
  guide.onclick = options.onOpenGuide;
  for (const button of [pick, guide])
    button.style.cssText = 'min-height:48px;margin:16px 12px 0 0;padding:8px 14px;font:inherit';
  root.append(outcome, run, learned, pick, guide);
  document.body.append(root);
  return { root, dispose: () => root.remove() };
};
export { createArenaResult };
export type { ArenaResultOptions };
