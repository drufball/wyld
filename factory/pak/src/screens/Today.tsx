import { NewEvent, type NextAction } from '@wyld/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getPresence, listQuests, postChain, postEvent } from '../api/client.js';
import { ChainList } from '../components/ChainList.js';
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
  const [mode, setMode] = useState<'intent' | 'question'>('intent');
  const [failedSubmission, setFailedSubmission] = useState<{
    text: string;
    mode: 'intent' | 'question';
  } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [nextAction, setNextAction] = useState<NextAction | null>(null);
  const [buildingCount, setBuildingCount] = useState(0);
  const intentField = useRef<HTMLTextAreaElement>(null);
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
  useEffect(() => () => clearTimeout(acknowledgementTimer.current), []);
  useLayoutEffect(() => {
    const field = intentField.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
  }, [text]);

  const send = (submission: string, submissionMode = mode) => {
    setFailedSubmission(null);
    if (submissionMode === 'question') setAcknowledged(false);
    const request =
      submissionMode === 'question'
        ? postChain(submission)
        : postEvent(
            NewEvent.parse({
              source: 'human',
              kind: 'human.intent',
              payload: { text: submission },
            }),
          );
    void request
      .then(() => {
        if (submissionMode === 'question') return;
        setAcknowledged(true);
        clearTimeout(acknowledgementTimer.current);
        acknowledgementTimer.current = setTimeout(() => setAcknowledged(false), 3000);
      })
      .catch(() => setFailedSubmission({ text: submission, mode: submissionMode }));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const intent = text.trim();
    if (!intent) return;
    setText('');
    send(intent, mode);
  };

  return (
    <div className="today">
      <form className="today-prompt" onSubmit={submit}>
        <label htmlFor="today-intent">
          {mode === 'intent' ? 'What do we make today?' : 'What do you want to know?'}
        </label>
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
        <button
          className="today-mode-toggle"
          type="button"
          aria-pressed={mode === 'question'}
          onClick={() => setMode((current) => (current === 'intent' ? 'question' : 'intent'))}
        >
          {mode === 'intent' ? 'Just asking?' : 'Make something instead'}
        </button>
        <div className="today-response" aria-live="polite">
          {failedSubmission !== null ? (
            <span>
              That didn't go through.{' '}
              <button
                type="button"
                onClick={() => send(failedSubmission.text, failedSubmission.mode)}
              >
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
      <ChainList
        onConvert={(question) => {
          setMode('intent');
          setText(question);
          requestAnimationFrame(() => intentField.current?.focus());
        }}
      />
      {buildingCount > 0 && (
        <p className="today-cranking">
          Cranking on {countInWords(buildingCount)} {buildingCount === 1 ? 'quest' : 'quests'}.
        </p>
      )}
      <Signals {...signals} />
    </div>
  );
}
