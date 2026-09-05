import type { Chain, Rumble as RumbleType } from '@wyld/shared';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { decideRumble, listChains, listRumbles, postChain } from '../api/client.js';
import { ChainCard } from '../components/ChainList.js';
import { useLiveEvents } from '../live/LiveEvents.js';

function DecisionButtons({
  rumble,
  options,
  deciding,
  failed,
  decide,
}: {
  rumble: RumbleType;
  options: string[];
  deciding: boolean;
  failed: string | null;
  decide: (rumble: RumbleType, chosen: string) => void;
}) {
  return (
    <>
      <div className="rumble-options">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={deciding}
            onClick={() => decide(rumble, option)}
          >
            {option}
          </button>
        ))}
      </div>
      {failed !== null && (
        <p className="rumble-retry">
          That didn't go through.{' '}
          <button type="button" onClick={() => decide(rumble, failed)}>
            Retry
          </button>
        </p>
      )}
    </>
  );
}

export function Rumble() {
  const [rumbles, setRumbles] = useState<RumbleType[]>([]);
  const [deciding, setDeciding] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [asking, setAsking] = useState<Record<string, boolean>>({});
  const [questions, setQuestions] = useState<Record<string, string>>({});
  const [chains, setChains] = useState<Record<string, Chain>>({});
  const { subscribe } = useLiveEvents();
  const load = useCallback(
    () =>
      void listRumbles()
        .then(setRumbles)
        .catch(() => undefined),
    [],
  );
  const refreshChains = useCallback(() => {
    const ids = new Set(Object.values(chains).map(({ id }) => id));
    if (ids.size === 0) return;
    void listChains()
      .then((listed) => {
        const current = new Map(listed.map((chain) => [chain.id, chain]));
        setChains((tracked) =>
          Object.fromEntries(
            Object.entries(tracked).flatMap(([rumbleId, chain]) => {
              const updated = current.get(chain.id);
              return updated ? [[rumbleId, updated]] : [];
            }),
          ),
        );
      })
      .catch(() => undefined);
  }, [chains]);
  useEffect(() => {
    load();
    const visible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', visible);
    const stops = [subscribe('human.decision', load), subscribe('planner.next_action', load)];
    return () => {
      document.removeEventListener('visibilitychange', visible);
      stops.forEach((stop) => stop());
    };
  }, [load, subscribe]);
  useEffect(() => {
    const stops = [
      subscribe('planner.chain_updated', refreshChains),
      subscribe('human.question', refreshChains),
    ];
    return () => stops.forEach((stop) => stop());
  }, [refreshChains, subscribe]);

  const decide = (rumble: RumbleType, chosen: string) => {
    setDeciding((value) => ({ ...value, [rumble.id]: true }));
    setFailed((value) => {
      const next = { ...value };
      delete next[rumble.id];
      return next;
    });
    void decideRumble(rumble.id, chosen)
      .then((updated) => {
        setRumbles((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate([40, 30, 40]);
          } catch {
            // Haptics are optional and must never turn a recorded decision into an error.
          }
        }
      })
      .catch(() => setFailed((value) => ({ ...value, [rumble.id]: chosen })))
      .finally(() => setDeciding((value) => ({ ...value, [rumble.id]: false })));
  };
  const ask = (event: FormEvent, rumble: RumbleType) => {
    event.preventDefault();
    const text = questions[rumble.id]?.trim();
    if (!text) return;
    void postChain(`About "${rumble.title}": ${text}`, rumble.blockingQuestIds[0])
      .then((chain) => {
        setChains((value) => ({ ...value, [rumble.id]: chain }));
        setQuestions((value) => ({ ...value, [rumble.id]: '' }));
      })
      .catch(() => undefined);
  };
  const open = rumbles.filter(({ chosen }) => chosen === null);
  const decided = rumbles.filter(({ chosen }) => chosen !== null);

  return (
    <div className="rumble-screen">
      <h1>Rumble</h1>
      <p className="pak-dim">Decisions only you can make.</p>
      {open.length === 0 && <p>Controller's quiet.</p>}
      <div className="rumble-list">
        {open.map((rumble) => (
          <article
            key={rumble.id}
            className={`rumble-card${rumble.kind === 'outage' ? ' rumble-card--outage' : ''}`}
          >
            <span className="rumble-kind">{rumble.kind}</span>
            <h2>{rumble.title}</h2>
            <p className="rumble-context">{rumble.context}</p>
            <DecisionButtons
              rumble={rumble}
              options={rumble.options}
              deciding={deciding[rumble.id] ?? false}
              failed={failed[rumble.id] ?? null}
              decide={decide}
            />
            <button
              className="rumble-ask"
              type="button"
              disabled={deciding[rumble.id] ?? false}
              onClick={() => setAsking((value) => ({ ...value, [rumble.id]: !value[rumble.id] }))}
            >
              Ask for more
            </button>
            {asking[rumble.id] && (
              <form className="rumble-question" onSubmit={(event) => ask(event, rumble)}>
                <label htmlFor={`rumble-question-${rumble.id}`}>
                  What else do you need to know?
                </label>
                <textarea
                  id={`rumble-question-${rumble.id}`}
                  value={questions[rumble.id] ?? ''}
                  onChange={(event) =>
                    setQuestions((value) => ({ ...value, [rumble.id]: event.target.value }))
                  }
                />
                <button type="submit">Send</button>
              </form>
            )}
            {chains[rumble.id] && (
              <ChainCard
                chain={chains[rumble.id]!}
                showQuestChip={false}
                onChange={(chain) => setChains((value) => ({ ...value, [rumble.id]: chain }))}
                onClosed={() =>
                  setChains((value) => {
                    const next = { ...value };
                    delete next[rumble.id];
                    return next;
                  })
                }
              />
            )}
          </article>
        ))}
      </div>
      <details className="rumble-decided">
        <summary>Already decided ({decided.length})</summary>
        <div className="rumble-list">
          {decided.map((rumble) => (
            <article
              key={rumble.id}
              className={`rumble-card${rumble.kind === 'outage' ? ' rumble-card--outage' : ''}`}
            >
              <h2>{rumble.title}</h2>
              <p>
                Chosen: <strong>{rumble.chosen}</strong>
              </p>
              <DecisionButtons
                rumble={rumble}
                options={rumble.options.filter((option) => option !== rumble.chosen)}
                deciding={deciding[rumble.id] ?? false}
                failed={failed[rumble.id] ?? null}
                decide={decide}
              />
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}
