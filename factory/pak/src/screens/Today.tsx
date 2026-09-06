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
  const [composerOpen, setComposerOpen] = useState(false);
  const intentField = useRef<HTMLTextAreaElement>(null);
  const composerButton = useRef<HTMLButtonElement>(null);
  const composerWasOpened = useRef(false);
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
  useEffect(() => {
    if (composerOpen) {
      composerWasOpened.current = true;
      intentField.current?.focus();
    } else if (composerWasOpened.current) {
      composerButton.current?.focus();
    }
  }, [composerOpen]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && composerOpen) {
        setComposerOpen(false);
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [composerOpen]);

  const sendChain = (submission: string) => {
    setFailedSubmission(null);
    void postChain(submission)
      .then((chain) => {
        setAddedChain(chain);
        setComposerOpen(false);
      })
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
    <div className="grid gap-8">
      {composerOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 min-h-11 bg-black/60 backdrop-blur-sm"
          aria-label="Close new message"
          onClick={() => setComposerOpen(false)}
        />
      )}
      <Card
        variant="bevel"
        role="dialog"
        aria-modal="true"
        aria-label="New message"
        id="today-composer"
        className={
          composerOpen
            ? 'fixed bottom-[calc(53px+env(safe-area-inset-bottom))] left-0 right-0 z-40 grid gap-3 p-5 md:bottom-24 md:left-auto md:right-6 md:w-[min(32rem,calc(100vw-3rem))]'
            : 'sr-only'
        }
      >
        <form className="grid gap-3" onSubmit={submit}>
          <label className="font-display text-[11px] leading-loose" htmlFor="today-intent">
            What's on your mind?
          </label>
          <span className="grid gap-2">
            <Textarea
              ref={intentField}
              id="today-intent"
              rows={1}
              value={text}
              onFocus={() => setComposerOpen(true)}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              autoComplete="off"
              className="resize-none overflow-hidden"
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
          <Button variant="retro" type="button" onClick={() => setComposerOpen(false)}>
            Close
          </Button>
        </form>
      </Card>
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
      <ChainList kind="all" addedChain={addedChain} onConvert={sendIntent} />
      <InFlight />
      <Signals {...signals} rumbles={rumbleCount} demos={demoCount} />
      <Button
        ref={composerButton}
        id="today-composer-button"
        variant="retro"
        type="button"
        aria-label="New message"
        aria-expanded={composerOpen}
        aria-controls="today-composer"
        onClick={() => setComposerOpen((value) => !value)}
        className={`fixed bottom-[calc(96px+env(safe-area-inset-bottom))] right-4 z-40 size-14 rounded-full p-0 text-xl md:bottom-6 md:right-6 ${
          composerOpen ? 'invisible pointer-events-none md:visible md:pointer-events-auto' : ''
        }`}
      >
        +
      </Button>
    </div>
  );
}
