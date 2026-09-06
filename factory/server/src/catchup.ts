import type { CatchupDigest, Event, QuestStatus } from '@wyld/shared';

export type CatchupQuest = {
  id: string;
  worldId: string;
  title: string;
  status: QuestStatus;
};

export function mechanicalDigest(input: {
  events: Event[];
  quests: CatchupQuest[];
  openRumbles?: { id: string; title: string }[];
  demos?: { id: string; questId: string | null; summary: string | null }[];
}): CatchupDigest {
  const quests = new Map(input.quests.map((quest) => [quest.id, quest]));
  const demos = new Map<string, NonNullable<typeof input.demos>[number]>();
  for (const demo of [...(input.demos ?? [])].sort((a, b) => a.id.localeCompare(b.id))) {
    if (demo.questId !== null && !demos.has(demo.questId)) demos.set(demo.questId, demo);
  }
  const seen = {
    shipped: new Set<string>(),
    demos: new Set<string>(),
    parked: new Set<string>(),
    building: new Set<string>(),
  };
  const digest: CatchupDigest = { rumbles: [], demos: [], shipped: [], fyi: [] };
  digest.rumbles = (input.openRumbles ?? [])
    .slice(0, 8)
    .map(({ title }) => ({ text: title, deepLink: '/rumble' }));
  const paused: string[] = [];
  const resumed: string[] = [];
  const parked: string[] = [];
  const building: string[] = [];
  const addQuest = (section: keyof typeof seen, event: Event, status: QuestStatus) => {
    if (event.questId === undefined || seen[section].has(event.questId)) return;
    const quest = quests.get(event.questId);
    if (quest === undefined || quest.status !== status) return;
    seen[section].add(quest.id);
    if (section === 'shipped' && digest.shipped.length < 8)
      digest.shipped.push({ text: quest.title, deepLink: `/worlds/${quest.worldId}` });
    if (section === 'demos' && digest.demos.length < 8) {
      const demo = demos.get(quest.id);
      digest.demos.push({
        text: demo?.summary?.trim() ? demo.summary : quest.title,
        deepLink: demo === undefined ? '/demos' : `/demos/${demo.id}`,
      });
    }
    if (section === 'parked') parked.push(`Parked: ${quest.title}.`);
    if (section === 'building') building.push(`Started building: ${quest.title}.`);
  };
  for (const event of input.events) {
    const status = event.payload.status;
    if (event.kind === 'planner.quest_updated' && status === 'done')
      addQuest('shipped', event, 'done');
    if (event.kind === 'planner.quest_updated' && status === 'demo')
      addQuest('demos', event, 'demo');
    if (event.kind === 'system.paused') {
      const reason =
        typeof event.payload.reason === 'string' && event.payload.reason.trim() !== ''
          ? event.payload.reason
          : 'something ran out';
      paused.push(`The factory paused — ${reason}.`);
    }
    if (event.kind === 'system.resumed') resumed.push('The factory is running again.');
    if (
      event.kind === 'human.park' ||
      (event.kind === 'planner.quest_updated' && status === 'parked')
    )
      addQuest('parked', event, 'parked');
    if (event.kind === 'planner.quest_updated' && status === 'building')
      addQuest('building', event, 'building');
  }
  digest.fyi = [...paused, ...resumed, ...parked, ...building].slice(0, 8);
  return digest;
}
