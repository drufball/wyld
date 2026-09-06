import type { Chain } from '@wyld/shared';
import { useCallback, useEffect, useState } from 'react';
import { decideRumble, listChains } from '../api/client.js';
import { ChainCard } from '../components/ChainList.js';
import { DecisionButtons } from '../components/DecisionButtons.js';
import { Badge } from '../components/ui/badge.js';
import { Card } from '../components/ui/card.js';
import { useLiveEvents } from '../live/LiveEvents.js';

export function Rumble() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [deciding, setDeciding] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const { subscribe } = useLiveEvents();
  const load = useCallback(
    () =>
      void listChains({ kind: 'rumble', status: 'all', includeSnoozed: true })
        .then(setChains)
        .catch(() => undefined),
    [],
  );
  useEffect(() => {
    load();
    const visible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', visible);
    const stops = [
      subscribe('human.decision', load),
      subscribe('planner.next_action', load),
      subscribe('planner.chain_updated', load),
      subscribe('human.question', load),
    ];
    return () => {
      document.removeEventListener('visibilitychange', visible);
      stops.forEach((stop) => stop());
    };
  }, [load, subscribe]);
  const decide = (id: string, chosen: string) => {
    setDeciding((value) => ({ ...value, [id]: true }));
    setFailed((value) => {
      const next = { ...value };
      delete next[id];
      return next;
    });
    void decideRumble(id, chosen)
      .then(() => {
        load();
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate([40, 30, 40]);
          } catch {
            /* Haptics are optional. */
          }
        }
      })
      .catch(() => setFailed((value) => ({ ...value, [id]: chosen })))
      .finally(() => setDeciding((value) => ({ ...value, [id]: false })));
  };
  const open = chains.filter((chain) => chain.rumble?.chosen === null);
  const decided = chains.filter((chain) => chain.rumble?.chosen !== null);
  const update = (changed: Chain) =>
    setChains((items) => items.map((item) => (item.id === changed.id ? changed : item)));
  return (
    <div className="mx-auto grid max-w-[760px] gap-5">
      <div>
        <h1>Rumble</h1>
        <p className="text-muted-foreground">Decisions only you can make.</p>
      </div>
      {open.length === 0 && <p>Controller's quiet.</p>}
      <div className="grid gap-5">
        {open.map((chain) => (
          <ChainCard
            key={chain.id}
            chain={chain}
            onChange={update}
            onClosed={load}
            onSnoozed={load}
            rumbleCard
          />
        ))}
      </div>
      {decided.length > 0 && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center py-2 font-display text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Already decided ({decided.length})
          </summary>
          <div className="grid gap-5 pt-3">
            {decided.map((chain) => {
              const rumble = chain.rumble!;
              return (
                <Card
                  asChild
                  variant="bevel"
                  data-tone={rumble.kind === 'outage' ? 'bad' : 'accent'}
                  key={chain.id}
                >
                  <article className="rumble-card grid min-w-0 gap-3 p-5">
                    <Badge variant="tone" data-tone={rumble.kind === 'outage' ? 'bad' : 'accent'}>
                      rumble
                    </Badge>
                    <h2 className="m-0 wrap-anywhere text-xl leading-snug">{rumble.title}</h2>
                    <p className="m-0">
                      Chosen: <strong>{rumble.chosen}</strong>
                    </p>
                    <DecisionButtons
                      id={rumble.id}
                      options={rumble.options.filter((option) => option !== rumble.chosen)}
                      deciding={deciding[rumble.id] ?? false}
                      failed={failed[rumble.id] ?? null}
                      decide={decide}
                    />
                  </article>
                </Card>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
