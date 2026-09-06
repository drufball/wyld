import type { Chain } from '@wyld/shared';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  decideRumble,
  listChains,
  postChainMessage,
  snoozeChain,
  unsnoozeChain,
} from '../api/client.js';
import { DecisionButtons } from '../components/DecisionButtons.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Textarea } from '../components/ui/textarea.js';
import { useLiveEvents } from '../live/LiveEvents.js';

function snoozeDate(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function Rumble() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [deciding, setDeciding] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [asking, setAsking] = useState<Record<number, boolean>>({});
  const [questions, setQuestions] = useState<Record<number, string>>({});
  const [showSnooze, setShowSnooze] = useState<Record<number, boolean>>({});
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
      'human.decision',
      'planner.next_action',
      'planner.chain_updated',
      'human.question',
    ].map((kind) => subscribe(kind as 'human.decision', load));
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
      .then((updated) => {
        setChains((items) =>
          items.map((chain) => (chain.rumble?.id === id ? { ...chain, rumble: updated } : chain)),
        );
        if (typeof navigator.vibrate === 'function') {
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
  const ask = (event: FormEvent, chain: Chain) => {
    event.preventDefault();
    const question = questions[chain.id]?.trim();
    if (!question) return;
    void postChainMessage(chain.id, question)
      .then((updated) => {
        setChains((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        setQuestions((value) => ({ ...value, [chain.id]: '' }));
      })
      .catch(() => undefined);
  };
  const preset = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(8, 0, 0, 0);
    return date;
  };
  const open = chains.filter(({ rumble }) => rumble?.chosen === null);
  const decided = chains.filter(({ rumble }) => rumble?.chosen !== null);
  const card = (chain: Chain, isOpen: boolean) => {
    const rumble = chain.rumble!;
    const snoozed = chain.snoozedUntil !== null && new Date(chain.snoozedUntil) > new Date();
    const update = (updated: Chain) =>
      setChains((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    const snooze = (date: Date) =>
      void snoozeChain(chain.id, date.toISOString())
        .then(update)
        .catch(() => undefined);
    return (
      <Card
        asChild
        variant="bevel"
        data-tone={rumble.kind === 'outage' ? 'bad' : 'accent'}
        key={chain.id}
      >
        <article className="rumble-card grid min-w-0 gap-3 p-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="tone" data-tone={rumble.kind === 'outage' ? 'bad' : 'accent'}>
              rumble
            </Badge>
            {chain.questId && (
              <Badge variant="tone" data-tone="accent">
                {chain.questId}
              </Badge>
            )}
          </div>
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
            id={rumble.id}
            options={
              isOpen ? rumble.options : rumble.options.filter((option) => option !== rumble.chosen)
            }
            deciding={deciding[rumble.id] ?? false}
            failed={failed[rumble.id] ?? null}
            decide={decide}
          />
          {chain.messages.map((message) => (
            <p className="m-0 wrap-anywhere whitespace-pre-wrap bg-muted p-2" key={message.id}>
              <strong>{message.author === 'planner' ? 'Fable' : 'You'}</strong>
              <br />
              {message.text}
            </p>
          ))}
          {isOpen && (
            <>
              <Button
                variant="retro"
                type="button"
                onClick={() => setAsking((value) => ({ ...value, [chain.id]: !value[chain.id] }))}
              >
                Ask for more
              </Button>
              {asking[chain.id] && (
                <form className="grid gap-2" onSubmit={(event) => ask(event, chain)}>
                  <label htmlFor={`rumble-question-${chain.id}`}>
                    What else do you need to know?
                  </label>
                  <Textarea
                    id={`rumble-question-${chain.id}`}
                    value={questions[chain.id] ?? ''}
                    onChange={(event) =>
                      setQuestions((value) => ({ ...value, [chain.id]: event.target.value }))
                    }
                  />
                  <Button type="submit">Send</Button>
                </form>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {snoozed ? (
              <>
                <span className="self-center text-muted-foreground">
                  Snoozed until {snoozeDate(chain.snoozedUntil!)}
                </span>
                <Button
                  variant="retro"
                  type="button"
                  onClick={() => void unsnoozeChain(chain.id).then(update)}
                >
                  Unsnooze
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="retro"
                  type="button"
                  aria-expanded={showSnooze[chain.id] ?? false}
                  onClick={() =>
                    setShowSnooze((value) => ({ ...value, [chain.id]: !value[chain.id] }))
                  }
                >
                  Snooze
                </Button>
                {showSnooze[chain.id] && (
                  <>
                    <Button
                      variant="retro"
                      type="button"
                      onClick={() => snooze(new Date(Date.now() + 14_400_000))}
                    >
                      Later today
                    </Button>
                    <Button variant="retro" type="button" onClick={() => snooze(preset(1))}>
                      Tomorrow morning
                    </Button>
                    <Button variant="retro" type="button" onClick={() => snooze(preset(7))}>
                      Next week
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </article>
      </Card>
    );
  };
  return (
    <div className="mx-auto grid max-w-[760px] gap-5">
      <div>
        <h1>Rumble</h1>
        <p className="text-muted-foreground">Decisions only you can make.</p>
      </div>
      {open.length === 0 && <p>Controller's quiet.</p>}
      <div className="grid gap-5">{open.map((chain) => card(chain, true))}</div>
      {decided.length > 0 && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center py-2 font-display text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Already decided ({decided.length})
          </summary>
          <div className="grid gap-5 pt-3">{decided.map((chain) => card(chain, false))}</div>
        </details>
      )}
    </div>
  );
}
