import type { Quest } from '@wyld/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listQuests, listWorlds } from '../api/client.js';
import { useLiveEvents } from '../live/LiveEvents.js';
import { countInWords } from '../words.js';
import { Badge } from './ui/badge.js';
import { Card } from './ui/card.js';

const liveKinds = ['planner.quest_updated', 'planner.note', 'human.park'] as const;

export function InFlight() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [worldNames, setWorldNames] = useState(new Map<string, string>());
  const { subscribe } = useLiveEvents();
  const load = useCallback(() => {
    void Promise.all([listQuests(), listWorlds()])
      .then(([allQuests, worlds]) => {
        setQuests(allQuests.filter(({ status }) => status === 'building' || status === 'demo'));
        setWorldNames(new Map(worlds.map((world) => [world.id, world.name])));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const unsubscribes = liveKinds.map((kind) => subscribe(kind, load));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [load, subscribe]);

  if (quests.length === 0) return null;
  return (
    <section className="grid gap-3">
      <h2 className="m-0 font-display text-[11px] leading-loose">
        Cranking on {countInWords(quests.length)} {quests.length === 1 ? 'quest' : 'quests'}.
      </h2>
      <div className="grid gap-2">
        {quests.map((quest) => (
          <Card variant="bevel" className="p-0" key={quest.id}>
            <Link
              className="today-quest block min-h-11 min-w-0 p-3 text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
              to={`/quests?quest=${encodeURIComponent(quest.id)}`}
            >
              <header className="flex items-start justify-between gap-2">
                <h3 className="m-0 wrap-anywhere text-base">{quest.title}</h3>
                <Badge variant="tone" data-tone={quest.status === 'demo' ? 'ok' : 'accent'}>
                  {quest.status}
                </Badge>
              </header>
              <div
                className="quest-progress"
                role="progressbar"
                aria-label={`${quest.title} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(quest.progress * 100)}
              >
                <span style={{ width: `${quest.progress * 100}%` }} />
              </div>
              <p className="my-2 wrap-anywhere whitespace-pre-wrap text-muted-foreground">
                {quest.sinceYouLooked || quest.pitch}
              </p>
              <Badge variant="outline">{worldNames.get(quest.worldId) ?? quest.worldId}</Badge>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
