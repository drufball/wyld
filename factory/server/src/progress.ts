import type { Quest, QuestLink } from '@wyld/shared';

export function deriveProgress(status: Quest['status'], links: QuestLink[]): number {
  if (status === 'done') return 1;
  const countable = links.filter((link) => link.ghKind === 'issue' || link.ghKind === 'pr');
  if (countable.length === 0) return 0;
  const complete = countable.filter((link) =>
    ['closed', 'merged'].includes(link.state.toLowerCase()),
  );
  return Math.round((complete.length / countable.length) * 100) / 100;
}
