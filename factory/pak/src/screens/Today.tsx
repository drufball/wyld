import { NewEvent, type NextAction } from '@wyld/shared';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getPresence, listQuests, postEvent, postSeen } from '../api/client.js';
import { useLiveEvents } from '../live/LiveEvents.js';
import { countInWords } from '../words.js';

export type TodaySignals = { rumbles: number; demos: number; memory: string | null };

function compactCount(count: number) {
  return count > 9 ? '9+' : String(count);
}

export function Signals({ rumbles, demos, memory }: TodaySignals) {
  if (rumbles <= 0 && demos <= 0 && memory === null) return null;
  return (
    <section className="today-signals" aria-label="Signals">
      {rumbles > 0 && <p>{compactCount(rumbles)} Rumbles</p>}
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
  const [failedText, setFailedText] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [nextAction, setNextAction] = useState<NextAction | null>(null);
  const [buildingCount, setBuildingCount] = useState(0);
  const seen = useRef(false);
  const acknowledgementTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { subscribe } = useLiveEvents();

  const loadBuildingCount = useCallback(
    () =>
      void listQuests({ status: 'building' })
        .then((quests) => setBuildingCount(quests.length))
        .catch(() => undefined),
    [],
  );

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
  useEffect(() => {
    loadBuildingCount();
    return subscribe('planner.quest_updated', loadBuildingCount);
  }, [loadBuildingCount, subscribe]);
  useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    void postSeen().catch(() => undefined);
  }, []);
  useEffect(() => () => clearTimeout(acknowledgementTimer.current), []);

  const send = (intent: string) => {
    setFailedText(null);
    void postEvent(
      NewEvent.parse({ source: 'human', kind: 'human.intent', payload: { text: intent } }),
    )
      .then(() => {
        setAcknowledged(true);
        clearTimeout(acknowledgementTimer.current);
        acknowledgementTimer.current = setTimeout(() => setAcknowledged(false), 3000);
      })
      .catch(() => setFailedText(intent));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const intent = text.trim();
    if (!intent) return;
    setText('');
    send(intent);
  };

  return (
    <div className="today">
      <form className="today-prompt" onSubmit={submit}>
        <label htmlFor="today-intent">What do we make today?</label>
        <span className="today-input-line">
          <span aria-hidden="true">&gt;</span>
          <input
            id="today-intent"
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoComplete="off"
          />
        </span>
        <div className="today-response" aria-live="polite">
          {failedText !== null ? (
            <span>
              That didn't go through.{' '}
              <button type="button" onClick={() => send(failedText)}>
                Retry
              </button>
            </span>
          ) : acknowledged ? (
            <span className="today-ack">Got it.</span>
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
      {buildingCount > 0 && (
        <p className="today-cranking">
          Cranking on {countInWords(buildingCount)} {buildingCount === 1 ? 'quest' : 'quests'}.
        </p>
      )}
      <Signals {...signals} />
    </div>
  );
}
