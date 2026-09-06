import { NewEvent, type Chain, type NextAction, type Retro } from '@wyld/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  getPresence,
  listChains,
  listDemos,
  listQuests,
  listRetros,
  postChain,
  postEvent,
} from '../api/client.js';
import { ChainList } from '../components/ChainList.js';
import { InFlight } from '../components/InFlight.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Textarea } from '../components/ui/textarea.js';
import { useLiveEvents } from '../live/LiveEvents.js';
import { countInWords } from '../words.js';
import { playSound } from '../lib/feedback.js';

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

export function GoOutside({ action, building }: { action: NextAction; building: number }) {
  const actionText = action.deepLink ? (
    <Link
      aria-label={action.text}
      to={action.deepLink}
      className="min-h-11 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {action.text}
    </Link>
  ) : (
    <p className="m-0">{action.text}</p>
  );
  return (
    <Card variant="bevel" className="today-go-outside overflow-hidden p-0">
      <div aria-hidden="true" className="relative h-40 overflow-hidden">
        <svg
          viewBox="0 0 320 160"
          className="absolute inset-0 size-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="sunset-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#282a36" />
              <stop offset="0.28" stopColor="#6272a4" />
              <stop offset="0.52" stopColor="#bd93f9" />
              <stop offset="0.75" stopColor="#ff79c6" />
              <stop offset="1" stopColor="#ffb86c" />
            </linearGradient>
          </defs>
          <rect width="320" height="160" fill="url(#sunset-sky)" />
          <polygon points="0,113 73,100 145,116 230,101 320,114 320,160 0,160" fill="#6272a4" />
          <polygon points="0,129 82,111 157,132 235,110 320,126 320,160 0,160" fill="#44475a" />
          <polygon points="0,143 66,126 145,141 220,123 320,139 320,160 0,160" fill="#282a36" />
        </svg>
        <div className="absolute right-[18%] top-7 size-12 rounded-full bg-dracula-yellow shadow-[0_0_36px_rgb(241_250_140/0.55)] [animation:sunset-shimmer_6s_ease-in-out_infinite]" />
        <svg
          viewBox="0 0 48 40"
          preserveAspectRatio="xMidYMid meet"
          className="absolute bottom-5 right-[29%] h-9 w-10"
        >
          <g fill="#21222c">
            <polygon points="10,35 12,23 19,16 30,18 34,25 33,35" />
            <polygon points="18,17 21,8 30,7 36,13 34,21 25,22" />
            <polygon points="21,9 25,1 29,8" />
            <polygon points="34,12 43,15 35,18" />
            <polygon points="10,24 5,17 3,8 7,6 10,15 16,20" />
            <polygon points="8,35 13,32 18,34 17,38 8,38" />
            <polygon points="28,33 35,32 37,38 28,38" />
          </g>
        </svg>
      </div>
      <div className="grid gap-2 p-5">
        {actionText}
        <p className="m-0 text-muted-foreground">
          {building === 0
            ? 'Nothing cooking right now.'
            : `Cranking on ${countInWords(building)} ${building === 1 ? 'quest' : 'quests'}.`}
        </p>
        {action.backAt && (
          <p className="m-0 text-muted-foreground">
            Back around{' '}
            {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
              new Date(action.backAt),
            )}
            .
          </p>
        )}
      </div>
    </Card>
  );
}

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function LastMemoryCard() {
  const [retro, setRetro] = useState<Retro | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const eligible = new Set([localIsoDate(today), localIsoDate(yesterday)]);
    void listRetros(2)
      .then((items) => {
        const latest = items.find(({ date }) => eligible.has(date)) ?? null;
        setRetro(latest);
        setDismissed(
          latest === null ||
            localStorage.getItem(`pak.memory-card.dismissed.${latest.date}`) !== null,
        );
      })
      .catch(() => undefined);
  }, []);
  if (retro === null || dismissed) return null;
  return (
    <Card variant="bevel" data-tone="accent" className="relative min-w-0 p-4 pr-14">
      <Link className="block min-h-11 min-w-0 text-foreground no-underline" to="/memory">
        <span className="block font-display text-[10px] text-dracula-pink">
          Last night's Memory Card
        </span>
        <span className="mt-2 block truncate text-sm text-muted-foreground">{retro.summary}</span>
      </Link>
      <button
        type="button"
        className="absolute right-1 top-1 size-11 text-xl text-muted-foreground"
        aria-label="Dismiss Memory Card"
        onClick={() => {
          localStorage.setItem(`pak.memory-card.dismissed.${retro.date}`, '1');
          setDismissed(true);
        }}
      >
        ×
      </button>
    </Card>
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
  const [chainCount, setChainCount] = useState(0);
  const [buildingCount, setBuildingCount] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [achievementName, setAchievementName] = useState<string | null>(null);
  const achievementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentField = useRef<HTMLTextAreaElement>(null);
  const composerButton = useRef<HTMLButtonElement>(null);
  const composerWasOpened = useRef(false);
  const { subscribe } = useLiveEvents();

  useEffect(() => {
    try {
      if (sessionStorage.getItem('wyld.sfx.startup') !== null) return;
    } catch {
      // Continue with gesture-gated playback when session storage is unavailable.
    }
    const start = () => {
      playSound('startup');
      try {
        sessionStorage.setItem('wyld.sfx.startup', '1');
      } catch {
        // Playback is still safe without session persistence.
      }
      document.removeEventListener('pointerdown', start);
      document.removeEventListener('keydown', start);
    };
    document.addEventListener('pointerdown', start, { once: true });
    document.addEventListener('keydown', start, { once: true });
    return () => {
      document.removeEventListener('pointerdown', start);
      document.removeEventListener('keydown', start);
    };
  }, []);

  const dismissAchievement = useCallback(() => {
    if (achievementTimer.current !== null) clearTimeout(achievementTimer.current);
    achievementTimer.current = null;
    setAchievementName(null);
  }, []);
  useEffect(() => {
    const stop = subscribe('pak.achievement_unlocked', (event) => {
      const name = event.payload['name'];
      if (typeof name !== 'string' || name.trim().length === 0) return;
      if (achievementTimer.current !== null) clearTimeout(achievementTimer.current);
      setAchievementName(name);
      playSound('save');
      achievementTimer.current = setTimeout(() => {
        achievementTimer.current = null;
        setAchievementName(null);
      }, 8_000);
    });
    return () => {
      stop();
      if (achievementTimer.current !== null) clearTimeout(achievementTimer.current);
    };
  }, [subscribe]);

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
      void listChains({ kind: 'rumble' })
        .then((items) => setRumbleCount(items.length))
        .catch(() => undefined),
    [],
  );
  useEffect(() => {
    loadRumbles();
    const stops = [
      subscribe('human.decision', loadRumbles),
      subscribe('planner.next_action', loadRumbles),
      subscribe('planner.chain_updated', loadRumbles),
      subscribe('human.chain_closed', loadRumbles),
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
  const loadBuilding = useCallback(
    () =>
      void listQuests({ status: 'building' })
        .then((items) => setBuildingCount(items.length))
        .catch(() => undefined),
    [],
  );
  useEffect(() => {
    loadBuilding();
    return subscribe('planner.quest_updated', loadBuilding);
  }, [loadBuilding, subscribe]);
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

  // /api/chains excludes snoozed items and includes Rumbles, so zero means nothing open and
  // unsnoozed is waiting on him.
  const goOutside =
    nextAction !== null &&
    /^nothing needs you/i.test(nextAction.text.trimStart()) &&
    chainCount === 0;

  return (
    <div className="grid gap-8">
      <div className="flex justify-end">
        <Button asChild variant="retro" size="icon">
          <Link to="/sleep" aria-label="Goodnight" className="font-sans text-2xl" title="Goodnight">
            🌙
          </Link>
        </Button>
      </div>
      <LastMemoryCard />
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
      {achievementName !== null && (
        <Card variant="bevel" data-tone="ok" className="today-achievement relative p-4 pr-14">
          Achievement unlocked — {achievementName}
          <button
            type="button"
            aria-label="Dismiss achievement"
            className="absolute right-1 top-1 size-11 text-xl text-muted-foreground"
            onClick={dismissAchievement}
          >
            ×
          </button>
        </Card>
      )}
      {goOutside && nextAction !== null ? (
        <GoOutside action={nextAction} building={buildingCount} />
      ) : nextAction !== null ? (
        nextAction.deepLink ? (
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
        )
      ) : null}
      <ChainList
        kind="all"
        addedChain={addedChain}
        onConvert={sendIntent}
        onCountChange={setChainCount}
      />
      <InFlight heading={!goOutside} />
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
