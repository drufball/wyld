import type { Achievement, Retro } from '@wyld/shared';
import { useEffect, useState } from 'react';
import { listAchievements, listQuests, listRetros } from '../api/client.js';
import { Card } from '../components/ui/card.js';

const knownStats: Record<string, string> = {
  eventsTotal: 'Events',
  questsShipped: 'Shipped',
  rumblesDecided: 'Decisions',
};
export function humaniseStat(key: string) {
  return (
    knownStats[key] ??
    key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
  );
}
function readableDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(year!, month! - 1, day));
}
export function Memory() {
  const [retros, setRetros] = useState<Retro[] | null>(null);
  const [titles, setTitles] = useState(new Map<string, string>());
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    void listRetros(30)
      .then((items) => {
        setRetros([...items].sort((a, b) => b.date.localeCompare(a.date)));
        setError(false);
      })
      .catch(() => setError(true));
    void listQuests()
      .then((quests) => setTitles(new Map(quests.map((quest) => [quest.id, quest.title]))))
      .catch(() => undefined);
    void listAchievements()
      .then(setAchievements)
      .catch(() => undefined);
  }, []);
  return (
    <div className="grid min-w-0 gap-5">
      <h1 className="m-0">MEMORY</h1>
      {retros === null ? (
        <p>{error ? "Memory couldn't load. Try again." : 'Loading save files…'}</p>
      ) : retros.length === 0 ? (
        <p>No nights have been recorded yet.</p>
      ) : (
        retros.map((retro) => (
          <Card
            key={retro.date}
            variant="bevel"
            data-tone="accent"
            className="grid min-w-0 gap-4 overflow-hidden p-4"
          >
            <h2 className="m-0 font-display text-xs text-dracula-pink">
              <time dateTime={retro.date} aria-label={retro.date}>
                {readableDate(retro.date)}
              </time>
            </h2>
            <p className="m-0 break-words">{retro.summary}</p>
            {retro.wins.length > 0 && (
              <section>
                <h3 className="font-display text-[10px] text-dracula-green">WINS</h3>
                <ul className="list-disc pl-5">
                  {retro.wins.map((win) => (
                    <li className="break-words" key={win}>
                      {win}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {retro.misses.length > 0 && (
              <section>
                <h3 className="font-display text-[10px] text-dracula-red">MISSES</h3>
                <ul className="list-disc pl-5">
                  {retro.misses.map((miss) => (
                    <li className="break-words" key={miss}>
                      {miss}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {retro.factoryImprovements.length > 0 && (
              <section>
                <h3 className="font-display text-[10px] text-dracula-cyan">Factory improvements</h3>
                <ul className="list-disc pl-5">
                  {retro.factoryImprovements.map((id) => (
                    <li className="break-words" key={id}>
                      {titles.get(id) ?? id}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {Object.keys(retro.stats).length > 0 && (
              <dl className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3 text-sm">
                {Object.entries(retro.stats).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-muted-foreground">{humaniseStat(key)}</dt>
                    <dd className="m-0 text-dracula-yellow">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        ))
      )}
      {achievements.length > 0 && (
        <section className="grid gap-3" aria-label="Achievements">
          <h2 className="m-0 font-display text-xs text-dracula-pink">ACHIEVEMENTS</h2>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2 p-0">
            {achievements.map((achievement) => {
              const unlocked = achievement.unlockedAt !== null;
              return (
                <li
                  key={achievement.id}
                  className="min-w-0"
                  aria-label={`${achievement.name}, ${unlocked ? 'unlocked' : 'locked'}`}
                >
                  <Card
                    variant="bevel"
                    className={`achievement-tile grid h-full min-h-24 min-w-0 gap-1 p-3 text-center ${unlocked ? '' : 'opacity-50'}`}
                  >
                    <span aria-hidden="true" className="text-2xl">
                      {unlocked ? achievement.badge : '???'}
                    </span>
                    <span className="min-w-0">{achievement.name}</span>
                    {achievement.unlockedAt !== null && (
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={achievement.unlockedAt}
                      >
                        {new Intl.DateTimeFormat(undefined, {
                          day: 'numeric',
                          month: 'short',
                        }).format(new Date(achievement.unlockedAt))}
                      </time>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
