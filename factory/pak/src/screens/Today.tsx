import { NewEvent, type Chain, type NextAction } from '@wyld/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getPresence, listDemos, listRumbles, postChain, postEvent } from '../api/client.js';
import { ChainList } from '../components/ChainList.js';
import { InFlight } from '../components/InFlight.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Textarea } from '../components/ui/textarea.js';
import { useLiveEvents } from '../live/LiveEvents.js';

export type TodaySignals = { rumbles: number; demos: number; memory: string | null };

function compactCount(count: number) {
  return count > 9 ? '9+' : String(count);
}

export function Signals({ rumbles, demos, memory }: TodaySignals) {
  if (rumbles <= 0 && demos <= 0 && memory === null) return null;
  return (
    <section className="grid gap-2 text-muted-foreground" aria-label="Signals">
      {rumbles > 0 && (
        <Link className="min-h-11 py-2 text-accent underline" to="/rumble">
          {compactCount(rumbles)} Rumbles
        </Link>
      )}
      {demos > 0 && (
        <Link className="min-h-11 py-2 text-accent underline" to="/demos">
          {compactCount(demos)} demos ready
        </Link>
      )}
      {memory !== null && <p className="m-0">{memory}</p>}
    </section>
  );
}

export function Today({
  signals = { rumbles: 0, demos: 0, memory: null },
}: {
  signals?: TodaySignals;
}) {
  const [text, setText] = useState('');
  const [failedSubmission, setFailedSubmission] = useState<{
    text: string;
    action: 'chain' | 'intent';
  } | null>(null);
  const [addedChain, setAddedChain] = useState<Chain | null>(null);
  const [nextAction, setNextAction] = useState<NextAction | null>(null);
  const [rumbleCount, setRumbleCount] = useState(signals.rumbles);
  const [demoCount, setDemoCount] = useState(signals.demos);
  const intentField = useRef<HTMLTextAreaElement>(null);
  const { subscribe } = useLiveEvents();

  const loadPresence = useCallback(
    () =>
      void getPresence()
        .then((value) => setNextAction(value.nextAction))
        .catch(() => undefined),
    [],
  );
  useEffect(() => {
    loadPresence();
    return subscribe('planner.next_action', loadPresence);
  }, [loadPresence, subscribe]);
  const loadRumbles = useCallback(
    () =>
      void listRumbles({ status: 'open' })
        .then((items) => setRumbleCount(items.length))
        .catch(() => undefined),
    [],
  );
  useEffect(() => {
    loadRumbles();
    const stops = [
      subscribe('human.decision', loadRumbles),
      subscribe('planner.next_action', loadRumbles),
    ];
    return () => stops.forEach((stop) => stop());
  }, [loadRumbles, subscribe]);
  const loadDemos = useCallback(
    () =>
      void listDemos()
        .then((items) => setDemoCount(items.filter(({ status }) => status === 'ready').length))
        .catch(() => undefined),
    [],
  );
  useEffect(() => {
    loadDemos();
    const stops = [
      subscribe('planner.quest_updated', loadDemos),
      subscribe('human.feedback', loadDemos),
    ];
    return () => stops.forEach((stop) => stop());
  }, [loadDemos, subscribe]);
  useLayoutEffect(() => {
    const field = intentField.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
  }, [text]);

  const sendChain = (submission: string) => {
    setFailedSubmission(null);
    void postChain(submission)
      .then(setAddedChain)
      .catch(() => setFailedSubmission({ text: submission, action: 'chain' }));
  };
  const sendIntent = (submission: string) => {
    setFailedSubmission(null);
    void postEvent(
      NewEvent.parse({
        source: 'human',
        kind: 'human.intent',
        payload: { text: submission },
      }),
    ).catch(() => setFailedSubmission({ text: submission, action: 'intent' }));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const intent = text.trim();
    if (!intent) return;
    setText('');
    sendChain(intent);
  };

  return (
    <div className="grid gap-8 pt-[clamp(48px,12vh,120px)]">
      <form className="grid gap-3" onSubmit={submit}>
        <label className="font-display text-[11px] leading-loose" htmlFor="today-intent">
          What's on your mind?
        </label>
        <span className="grid grid-cols-[auto_1fr] items-center gap-2 font-display text-[11px] leading-loose">
          <span className="text-accent" aria-hidden="true">
            &gt;
          </span>
          <Textarea
            ref={intentField}
            id="today-intent"
            rows={1}
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            autoComplete="off"
            className="resize-none overflow-hidden border-x-0 border-t-0 bg-transparent px-1 font-mono text-[15px] motion-safe:animate-[terminal-caret_1s_steps(2,jump-none)_infinite]"
          />
        </span>
        <div className="min-h-8 text-sm text-muted-foreground" aria-live="polite">
          {failedSubmission !== null ? (
            <span>
              That didn't go through.{' '}
              <Button
                variant="ghost"
                type="button"
                onClick={() =>
                  failedSubmission.action === 'chain'
                    ? sendChain(failedSubmission.text)
                    : sendIntent(failedSubmission.text)
                }
              >
                Retry
              </Button>
            </span>
          ) : null}
        </div>
      </form>
      {nextAction !== null &&
        (nextAction.deepLink ? (
          <Card variant="bevel" className="p-0">
            <Link
              aria-label={nextAction.text}
              className="block min-h-11 p-3 font-mono text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
              to={nextAction.deepLink}
            >
              <span
                className="mb-1 block font-display text-[9px] leading-relaxed text-muted-foreground"
                aria-hidden="true"
              >
                NEXT
              </span>
              {nextAction.text}
            </Link>
          </Card>
        ) : (
          <Card variant="flat" className="p-5">
            {nextAction.text}
          </Card>
        ))}
      <ChainList addedChain={addedChain} onConvert={sendIntent} />
      <InFlight />
      <Signals {...signals} rumbles={rumbleCount} demos={demoCount} />
    </div>
  );
}
