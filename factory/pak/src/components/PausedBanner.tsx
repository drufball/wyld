import type { HealthSnapshot } from '@wyld/shared';
import { useCallback, useEffect, useState } from 'react';
import { getHealthSnapshot, postResume } from '../api/client.js';
import { useLiveEvents } from '../live/LiveEvents.js';
import { countInWords } from '../words.js';
import { Button } from './ui/button.js';
import { Card } from './ui/card.js';

function pausedSentence(snapshot: HealthSnapshot, failure: string | null) {
  const paused = snapshot.paused;
  if (paused === undefined) return '';
  const time = new Date(paused.since).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const queueDepth = snapshot.wake.queueDepth;
  const queued =
    queueDepth === undefined || queueDepth === 0
      ? ''
      : ` Nothing lost; ${countInWords(queueDepth)} ${queueDepth === 1 ? 'event' : 'events'} queued.`;
  const fix = paused.fix === undefined ? '' : ` ${paused.fix}.`;
  const failed = failure === null ? '' : ` ${failure}.`;
  return `Paused — ${paused.reason} at ${time}.${queued}${fix}${failed}`;
}

export function PausedBanner() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [resuming, setResuming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const { subscribe } = useLiveEvents();
  const refresh = useCallback(() => {
    void getHealthSnapshot()
      .then((next) => {
        setSnapshot(next);
        setFailure(null);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const stops = [subscribe('system.paused', refresh), subscribe('system.resumed', refresh)];
    return () => stops.forEach((stop) => stop());
  }, [refresh, subscribe]);

  if (snapshot?.paused === undefined) return null;

  const resume = () => {
    setResuming(true);
    setFailure(null);
    void postResume()
      .then(() => getHealthSnapshot())
      .then(setSnapshot)
      .catch((error: unknown) =>
        setFailure(error instanceof Error ? error.message : 'Resuming factory failed'),
      )
      .finally(() => setResuming(false));
  };

  return (
    <Card
      variant="bevel"
      data-tone="bad"
      className="paused-banner mb-5 grid min-w-0 gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
    >
      <div className="min-w-0">
        <p className="m-0 mb-2 font-display text-[10px]">Paused</p>
        <p className="m-0 wrap-anywhere text-sm text-muted-foreground">
          {pausedSentence(snapshot, failure)}
        </p>
      </div>
      <Button
        className="paused-resume w-full sm:w-auto"
        variant="retro"
        type="button"
        disabled={resuming}
        onClick={resume}
      >
        Resume
      </Button>
    </Card>
  );
}
