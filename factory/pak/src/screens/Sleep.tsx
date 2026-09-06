import type { SleepCurrent, SleepRun } from '@wyld/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSleepCurrent, listSleepRuns, postGoodnight } from '../api/client.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { useLiveEvents } from '../live/LiveEvents.js';
import { playSound } from '../lib/feedback.js';

const phases = ['drain', 'sweep', 'qa', 'retro', 'reset'] as const;
const outcomes = {
  clean: 'The night ran clean.',
  timed_out: 'The night ran out of time.',
  paused: 'The night stopped early.',
} as const;

function localTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

function Countdown({ until }: { until: string }) {
  const remaining = () => Math.max(0, new Date(until).getTime() - Date.now());
  const [milliseconds, setMilliseconds] = useState(remaining);
  useEffect(() => {
    const timer = window.setInterval(() => setMilliseconds(remaining()), 30_000);
    return () => window.clearInterval(timer);
  }, [until]);
  const minutes = Math.ceil(milliseconds / 60_000);
  return (
    <p className="m-0 font-display text-sm text-dracula-cyan" aria-live="polite">
      {Math.floor(minutes / 60)}h {minutes % 60}m to lights on
    </p>
  );
}

function Night({ run, lightsOnAt }: { run: SleepRun; lightsOnAt: string }) {
  const happened = run.phases.map(({ phase }) => phase);
  const current = happened.at(-1);
  const currentIndex =
    current === undefined ? 0 : phases.indexOf(current as (typeof phases)[number]);
  return (
    <Card variant="bevel" data-tone="accent" className="w-full max-w-full overflow-hidden p-0">
      <div className="relative h-40 overflow-hidden bg-gradient-to-b from-[#11152f] via-dracula-current to-dracula-purple/30">
        <div
          aria-hidden="true"
          className="absolute right-7 top-7 size-16 rounded-full bg-dracula-yellow shadow-[0_0_32px_rgb(241_250_140/0.55)]"
        />
        {[
          ['9%', '20%', 'size-1.5'],
          ['18%', '62%', 'size-1'],
          ['31%', '34%', 'size-2'],
          ['45%', '70%', 'size-1'],
          ['57%', '18%', 'size-1.5'],
          ['70%', '53%', 'size-1'],
          ['88%', '72%', 'size-1.5'],
        ].map(([left, top, size], index) => (
          <span
            key={left}
            aria-hidden="true"
            className={`absolute ${size} rounded-full bg-white shadow-[0_0_5px_rgb(255_255_255/0.8)] [animation:sleep-twinkle_2.2s_ease-in-out_infinite]`}
            style={{ left, top, animationDelay: `${index * 0.23}s` }}
          />
        ))}
      </div>
      <div className="grid gap-5 bg-dracula-bg p-5">
        <Countdown until={lightsOnAt} />
        <ol className="grid gap-2" aria-label="Night phases">
          {phases.map((phase, index) => {
            const state =
              index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'ahead';
            return (
              <li
                key={phase}
                aria-current={state === 'current' ? 'step' : undefined}
                className={`rounded border border-dracula-comment/50 px-3 py-2 uppercase ${state === 'current' ? 'bg-dracula-current text-dracula-pink shadow-[0_0_12px_rgb(255_121_198/0.12)]' : state === 'done' ? 'text-dracula-green' : 'text-muted-foreground'}`}
              >
                <span>{phase}</span>
                {state !== 'ahead' && <span className="sr-only"> ({state})</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}

export function Sleep() {
  const [current, setCurrent] = useState<SleepCurrent | null>(null);
  const [lastRun, setLastRun] = useState<SleepRun | null>(null);
  const [error, setError] = useState(false);
  const { subscribe } = useLiveEvents();
  const load = useCallback(() => {
    void getSleepCurrent()
      .then(async (value) => {
        setCurrent(value);
        setLastRun(value.run ?? (await listSleepRuns(1))[0] ?? null);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);
  useEffect(() => {
    load();
    const stops = [subscribe('sleep.alarm', load), subscribe('sleep.phase', load)];
    return () => stops.forEach((stop) => stop());
  }, [load, subscribe]);
  const goodnight = () => {
    playSound('power-off');
    setError(false);
    void postGoodnight()
      .then(load)
      .catch(() => setError(true));
  };
  if (current === null)
    return <p>{error ? "Sleep mode couldn't load. Try again." : 'Checking the clock…'}</p>;
  const finished = current.run === null && lastRun?.ended !== null ? lastRun : null;
  return (
    <div className="grid min-w-0 gap-6">
      <h1 className="m-0">SLEEP</h1>
      {current.run ? (
        <Night run={current.run} lightsOnAt={current.schedule.lightsOnAt} />
      ) : (
        <>
          {finished?.outcome && (
            <p className="m-0">
              {outcomes[finished.outcome]}{' '}
              <Link className="text-accent underline" to="/memory">
                Open Memory.
              </Link>
            </p>
          )}
          <Button variant="retro" className="min-h-20 w-full text-sm" onClick={goodnight}>
            GOODNIGHT
          </Button>
          {error && <p className="m-0">Goodnight didn't start. Try again.</p>}
          <p className="m-0 text-muted-foreground">
            The night starts by itself at {localTime(current.schedule.goodnightAt)}. Lights come on
            at {localTime(current.schedule.lightsOnAt)}.
          </p>
        </>
      )}
    </div>
  );
}
