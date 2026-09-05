import { type QuestStatus, type WorldWithQuestCounts } from '@wyld/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listWorlds } from '../api/client.js';
import { useLiveEvents } from '../live/LiveEvents.js';
import { countInWords } from '../words.js';

const statuses: QuestStatus[] = ['building', 'planning', 'idea', 'demo', 'done', 'parked'];

function countSummary(world: WorldWithQuestCounts) {
  const parts = statuses.flatMap((status) => {
    const count = world.questCounts[status];
    if (count === 0) return [];
    const label = count === 1 ? status : status === 'idea' ? 'ideas' : status;
    return [`${countInWords(count)} ${label}`];
  });
  if (parts.length === 0) return 'No quests yet.';
  const summary = parts.join(', ');
  return `${summary.charAt(0).toUpperCase()}${summary.slice(1)}.`;
}

export function Worlds() {
  const [worlds, setWorlds] = useState<WorldWithQuestCounts[] | null>(null);
  const { subscribe } = useLiveEvents();
  const load = useCallback(
    () =>
      void listWorlds()
        .then(setWorlds)
        .catch(() => setWorlds([])),
    [],
  );

  useEffect(() => {
    load();
    const unsubscribes = [
      subscribe('planner.quest_updated', load),
      subscribe('planner.world_updated', load),
    ];
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [load, subscribe]);

  return (
    <section className="worlds">
      <h1>Worlds</h1>
      {worlds !== null && worlds.length === 0 ? (
        <p className="pak-dim">The worlds are quiet for now.</p>
      ) : (
        <div className="world-grid">
          {worlds?.map((world) => (
            <Link
              className={`world-door world-door--${world.order % 4}`}
              key={world.id}
              to={`/worlds/${world.id}`}
            >
              <span className="world-door__icon" aria-hidden="true">
                {world.icon}
              </span>
              <strong>{world.name}</strong>
              <span>{countSummary(world)}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
