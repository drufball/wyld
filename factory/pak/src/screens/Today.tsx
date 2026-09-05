import { NewEvent, type Chain, type NextAction } from '@wyld/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getPresence, listRumbles, postChain, postEvent } from '../api/client.js';
import { ChainList } from '../components/ChainList.js';
import { InFlight } from '../components/InFlight.js';
import { useLiveEvents } from '../live/LiveEvents.js';

export type TodaySignals = { rumbles: number; demos: number; memory: string | null };

function compactCount(count: number) {
  return count > 9 ? '9+' : String(count);
}

export function Signals({ rumbles, demos, memory }: TodaySignals) {
  if (rumbles <= 0 && demos <= 0 && memory === null) return null;
  return (
    <section className="today-signals" aria-label="Signals">
      {rumbles > 0 && <Link to="/rumble">{compactCount(rumbles)} Rumbles</Link>}
      {demos > 0 && <p>{compactCount(demos)} demos ready</p>}
      {memory !== null && <p>{memory}</p>}
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
    <div className="today">
      <form className="today-prompt" onSubmit={submit}>
        <label htmlFor="today-intent">What's on your mind?</label>
        <span className="today-input-line">
          <span aria-hidden="true">&gt;</span>
          <textarea
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
          />
        </span>
        <div className="today-response" aria-live="polite">
          {failedSubmission !== null ? (
            <span>
              That didn't go through.{' '}
              <button
                type="button"
                onClick={() =>
                  failedSubmission.action === 'chain'
                    ? sendChain(failedSubmission.text)
                    : sendIntent(failedSubmission.text)
                }
              >
                Retry
              </button>
            </span>
          ) : null}
        </div>
      </form>
      {nextAction !== null &&
        (nextAction.deepLink ? (
          <Link className="today-action" to={nextAction.deepLink}>
            {nextAction.text}
          </Link>
        ) : (
          <div className="today-action">{nextAction.text}</div>
        ))}
      <ChainList addedChain={addedChain} onConvert={sendIntent} />
      <InFlight />
      <Signals {...signals} rumbles={rumbleCount} />
    </div>
  );
}
