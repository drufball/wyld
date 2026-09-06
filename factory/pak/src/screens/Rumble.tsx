import type { Chain, Rumble as RumbleType } from '@wyld/shared';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { decideRumble, listChains, listRumbles, postChain } from '../api/client.js';
import { ChainCard } from '../components/ChainList.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Textarea } from '../components/ui/textarea.js';
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
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <Button
            className="w-full wrap-anywhere"
            variant="retro"
            key={option}
            type="button"
            disabled={deciding}
            onClick={() => decide(rumble, option)}
          >
            {option}
          </Button>
        ))}
      </div>
      {failed !== null && (
        <p className="m-0 text-muted-foreground">
          That didn't go through.{' '}
          <Button variant="ghost" type="button" onClick={() => decide(rumble, failed)}>
            Retry
          </Button>
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
            /* Haptics are optional. */
          }
        }
      })
      .catch(() => setFailed((value) => ({ ...value, [rumble.id]: chosen })))
      .finally(() => setDeciding((value) => ({ ...value, [rumble.id]: false })));
  };
  const ask = (event: FormEvent, rumble: RumbleType) => {
    event.preventDefault();
    const question = questions[rumble.id]?.trim();
    if (!question) return;
    void postChain(`About "${rumble.title}": ${question}`, rumble.blockingQuestIds[0])
      .then((chain) => {
        setChains((value) => ({ ...value, [rumble.id]: chain }));
        setQuestions((value) => ({ ...value, [rumble.id]: '' }));
      })
      .catch(() => undefined);
  };
  const open = rumbles.filter(({ chosen }) => chosen === null);
  const decided = rumbles.filter(({ chosen }) => chosen !== null);
  const card = (rumble: RumbleType, isOpen: boolean) => (
    <Card
      asChild
      variant="bevel"
      data-tone={rumble.kind === 'outage' ? 'bad' : 'accent'}
      key={rumble.id}
    >
      <article className="rumble-card grid min-w-0 gap-3 p-5">
        {isOpen && (
          <Badge variant="tone" data-tone={rumble.kind === 'outage' ? 'bad' : 'accent'}>
            {rumble.kind}
          </Badge>
        )}
        <h2 className="m-0 wrap-anywhere text-xl leading-snug">{rumble.title}</h2>
        {isOpen ? (
          <p className="m-0 wrap-anywhere whitespace-pre-line text-muted-foreground">
            {rumble.context}
          </p>
        ) : (
          <p className="m-0">
            Chosen: <strong>{rumble.chosen}</strong>
          </p>
        )}
        <DecisionButtons
          rumble={rumble}
          options={
            isOpen ? rumble.options : rumble.options.filter((option) => option !== rumble.chosen)
          }
          deciding={deciding[rumble.id] ?? false}
          failed={failed[rumble.id] ?? null}
          decide={decide}
        />
        {isOpen && (
          <>
            <Button
              variant="retro"
              type="button"
              disabled={deciding[rumble.id] ?? false}
              onClick={() => setAsking((value) => ({ ...value, [rumble.id]: !value[rumble.id] }))}
            >
              Ask for more
            </Button>
            {asking[rumble.id] && (
              <form className="grid gap-2" onSubmit={(event) => ask(event, rumble)}>
                <label htmlFor={`rumble-question-${rumble.id}`}>
                  What else do you need to know?
                </label>
                <Textarea
                  id={`rumble-question-${rumble.id}`}
                  value={questions[rumble.id] ?? ''}
                  onChange={(event) =>
                    setQuestions((value) => ({ ...value, [rumble.id]: event.target.value }))
                  }
                />
                <Button type="submit">Send</Button>
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
          </>
        )}
      </article>
    </Card>
  );

  return (
    <div className="mx-auto grid max-w-[760px] gap-5">
      <div>
        <h1>Rumble</h1>
        <p className="text-muted-foreground">Decisions only you can make.</p>
      </div>
      {open.length === 0 && <p>Controller's quiet.</p>}
      <div className="grid gap-5">{open.map((rumble) => card(rumble, true))}</div>
      {decided.length > 0 && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center py-2 font-display text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Already decided ({decided.length})
          </summary>
          <div className="grid gap-5 pt-3">{decided.map((rumble) => card(rumble, false))}</div>
        </details>
      )}
    </div>
  );
}
