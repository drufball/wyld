import type { HealthSnapshot } from '@wyld/shared';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { getHealthSnapshot } from '../api/client.js';
import { Card } from '../components/ui/card.js';
import { SfxToggle } from '../components/SfxToggle.js';
import { relativeTime } from '../words.js';

type Tone = 'ok' | 'warn' | 'bad';

function uptime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `up ${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
}

export function compactCount(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  })
    .format(value)
    .replace('K', 'k');
}

const groupedNumber = new Intl.NumberFormat('en-US');

function Tile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  tone?: Tone;
}) {
  return (
    <Card variant="bevel" className="min-w-0 border-t-muted-foreground p-5" data-tone={tone}>
      <h2 className="m-0 text-[13px] font-medium text-muted-foreground">{label}</h2>
      <strong className="my-2 block wrap-anywhere font-display text-lg">{value}</strong>
      <p className="m-0 wrap-anywhere text-sm text-muted-foreground">{detail}</p>
    </Card>
  );
}

function Tiles({ snapshot }: { snapshot: HealthSnapshot }) {
  const now = new Date();
  const plannerTone: Tone =
    snapshot.planner.state === 'down' ? 'bad' : snapshot.planner.state === 'paused' ? 'warn' : 'ok';
  const plannerReport = snapshot.planner.lastReportAt
    ? `last heard ${relativeTime(snapshot.planner.lastReportAt, now)}`
    : 'never heard from';
  const queue = snapshot.wake.queueDepth ?? 0;
  const wakeDetail = `${queue === 0 ? 'Nothing waiting' : `${queue} waiting`}${snapshot.wake.oldestPendingTs ? ` · oldest ${relativeTime(snapshot.wake.oldestPendingTs, now)}` : ''}`;
  const oldestPendingAt = snapshot.wake.oldestPendingTs
    ? new Date(snapshot.wake.oldestPendingTs)
    : null;
  const lastDeliveryAt = snapshot.wake.lastDeliveryAt
    ? new Date(snapshot.wake.lastDeliveryAt)
    : null;
  const channelStuck =
    snapshot.wake.reachable &&
    queue > 0 &&
    oldestPendingAt !== null &&
    lastDeliveryAt !== null &&
    lastDeliveryAt < oldestPendingAt &&
    now.getTime() - oldestPendingAt.getTime() > 2 * 60 * 1000;
  const channelValue = !snapshot.wake.reachable ? 'No' : channelStuck ? 'Stuck' : 'Yes';
  const stuckAge = snapshot.wake.oldestPendingTs
    ? relativeTime(snapshot.wake.oldestPendingTs, now)
    : '';
  const channelDetail = !snapshot.wake.reachable
    ? 'the message channel is down'
    : channelStuck && oldestPendingAt
      ? `${queue} waiting, nothing delivered since ${stuckAge} — the channel is jammed`
      : wakeDetail;
  const githubAge = snapshot.wake.lastGithubEventAt
    ? relativeTime(snapshot.wake.lastGithubEventAt, now)
    : null;
  const githubValue =
    !snapshot.wake.reachable || !snapshot.wake.lastGithubEventAt
      ? 'No signal'
      : now.getTime() - new Date(snapshot.wake.lastGithubEventAt).getTime() > 60 * 60 * 1000
        ? 'Quiet'
        : 'Yes';
  const githubTone: Tone = githubValue === 'Yes' ? 'ok' : githubValue === 'Quiet' ? 'warn' : 'bad';
  const serverUp = snapshot.server.ok && snapshot.server.db === 'ok';
  const testsValue =
    snapshot.github.ciState === 'pass'
      ? 'Yes'
      : snapshot.github.ciState === 'fail'
        ? 'No'
        : snapshot.github.ciState === 'pending'
          ? 'Still running'
          : "Don't know";
  const testsTone: Tone | undefined =
    snapshot.github.ciState === 'pass'
      ? 'ok'
      : snapshot.github.ciState === 'pending'
        ? 'warn'
        : snapshot.github.ciState === 'fail'
          ? 'bad'
          : undefined;
  const rateDetail =
    snapshot.github.rateRemaining === undefined
      ? 'not measured yet'
      : snapshot.github.rateLimit === undefined
        ? 'requests left this hour'
        : `of ${groupedNumber.format(snapshot.github.rateLimit)} requests this hour`;

  return (
    <div className="debug-grid grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 max-[480px]:grid-cols-1">
      <Tile
        label="Am I awake?"
        value={
          snapshot.planner.state === 'down'
            ? 'Asleep'
            : `${snapshot.planner.state.charAt(0).toUpperCase()}${snapshot.planner.state.slice(1)}`
        }
        detail={`${snapshot.planner.currentTask ?? 'Nothing in flight'} · ${plannerReport}`}
        tone={plannerTone}
      />
      <Tile
        label="Are my messages getting through?"
        value={channelValue}
        detail={channelDetail}
        tone={channelValue === 'Yes' ? 'ok' : 'bad'}
      />
      <Tile
        label="Is GitHub talking to me?"
        value={githubValue}
        detail={githubAge ? `last heard ${githubAge}` : 'nothing yet'}
        tone={githubTone}
      />
      <Tile
        label="Is the factory running?"
        value={serverUp ? 'Yes' : 'No'}
        detail={`${uptime(snapshot.server.uptimeSeconds)} · ${snapshot.server.version}`}
        tone={serverUp ? 'ok' : 'bad'}
      />
      <Tile
        label="Things that happened today"
        value={groupedNumber.format(snapshot.server.eventsToday)}
        detail="since midnight"
      />
      <Tile
        label="Are the tests passing?"
        value={testsValue}
        detail={snapshot.github.ciDetail ?? 'nothing measured yet'}
        tone={testsTone}
      />
      <Tile
        label="Waiting on the robot"
        value={snapshot.github.codexPrsOpen ?? '—'}
        detail={snapshot.github.codexPrsOpen === 0 ? 'no jobs open' : 'jobs the robot has open'}
      />
      <Tile
        label="Room left with GitHub"
        value={
          snapshot.github.rateRemaining === undefined
            ? '—'
            : groupedNumber.format(snapshot.github.rateRemaining)
        }
        detail={rateDetail}
      />
      <Tile
        label="Thinking done today"
        value={
          snapshot.tokensToday === undefined ? 'Not measured' : compactCount(snapshot.tokensToday)
        }
        detail={
          snapshot.tokensToday === undefined
            ? 'no session logs to read'
            : "tokens used across today's sessions"
        }
      />
      <Tile
        label="Spent today"
        value={
          snapshot.costToday === undefined
            ? 'Not measured'
            : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                snapshot.costToday,
              )
        }
        detail={
          snapshot.costToday === undefined
            ? 'no honest dollar figure to read yet — nothing is capped'
            : 'informational — nothing is capped'
        }
      />
    </div>
  );
}

export function Debug() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    void getHealthSnapshot()
      .then((next) => {
        setSnapshot(next);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="min-w-0">
      <h1>Debug Menu</h1>
      <SfxToggle className="mb-3" />
      {!snapshot && !failed && <p>Reading the factory…</p>}
      {failed && (
        <p className="wrap-anywhere text-sm text-muted-foreground">
          Can't reach the factory right now
        </p>
      )}
      {snapshot?.pausedReason && (
        <Card variant="bevel" data-tone="warn" className="mb-3 p-5">
          Paused — {snapshot.pausedReason}
        </Card>
      )}
      {snapshot && <Tiles snapshot={snapshot} />}
    </div>
  );
}
