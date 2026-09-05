import type { Quest } from '@wyld/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listQuests, listWorlds } from '../api/client.js';
import { useLiveEvents } from '../live/LiveEvents.js';
import { countInWords } from '../words.js';

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
    <section className="today-inflight">
      <h2>
        Cranking on {countInWords(quests.length)} {quests.length === 1 ? 'quest' : 'quests'}.
      </h2>
      <div className="today-inflight__list">
        {quests.map((quest) => (
          <Link
            className="today-quest"
            to={`/quests?quest=${encodeURIComponent(quest.id)}`}
            key={quest.id}
          >
            <header>
              <h3>{quest.title}</h3>
              <span className={`quest-status quest-status--${quest.status}`}>{quest.status}</span>
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
            <p>{quest.sinceYouLooked || quest.pitch}</p>
            <span className="world-tag">{worldNames.get(quest.worldId) ?? quest.worldId}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
