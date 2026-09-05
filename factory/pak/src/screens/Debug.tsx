import type { HealthSnapshot } from '@wyld/shared';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { getHealthSnapshot } from '../api/client.js';
import { Panel } from '../components/Panel.js';
import { relativeTime } from '../words.js';

type Tone = 'ok' | 'warn' | 'bad';

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function uptime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `up ${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
}

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
    <Panel className="debug-tile" data-tone={tone}>
      <h2>{label}</h2>
      <strong className="debug-tile__value">{value}</strong>
      <p>{detail}</p>
    </Panel>
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
  const githubAge = snapshot.wake.lastGithubEventAt
    ? relativeTime(snapshot.wake.lastGithubEventAt, now)
    : null;
  const webhookLive =
    snapshot.wake.reachable && snapshot.wake.lastGithubEventAt
      ? now.getTime() - new Date(snapshot.wake.lastGithubEventAt).getTime() <= 60 * 60 * 1000
      : false;
  const webhookValue =
    !snapshot.wake.reachable || !snapshot.wake.lastGithubEventAt
      ? 'No signal'
      : webhookLive
        ? 'Live'
        : 'Quiet';
  const webhookTone: Tone =
    webhookValue === 'Live' ? 'ok' : webhookValue === 'Quiet' ? 'warn' : 'bad';
  const serverUp = snapshot.server.ok && snapshot.server.db === 'ok';
  const checksTone: Tone =
    snapshot.github.ciState === 'pass'
      ? 'ok'
      : snapshot.github.ciState === 'pending'
        ? 'warn'
        : 'bad';

  return (
    <div className="debug-grid">
      <Tile
        label="Planner"
        value={titleCase(snapshot.planner.state)}
        detail={`${snapshot.planner.currentTask ?? 'Nothing in flight'} · ${plannerReport}`}
        tone={plannerTone}
      />
      <Tile
        label="Wake"
        value={snapshot.wake.reachable ? 'Up' : 'Down'}
        detail={wakeDetail}
        tone={snapshot.wake.reachable ? 'ok' : 'bad'}
      />
      <Tile
        label="Webhook feed"
        value={webhookValue}
        detail={githubAge ? `last heard ${githubAge}` : 'nothing yet'}
        tone={webhookTone}
      />
      <Tile
        label="Server"
        value={serverUp ? 'Up' : 'Down'}
        detail={`${uptime(snapshot.server.uptimeSeconds)} · ${snapshot.server.version}`}
        tone={serverUp ? 'ok' : 'bad'}
      />
      <Tile label="Events today" value={snapshot.server.eventsToday} detail="since midnight UTC" />
      <Tile
        label="Checks"
        value={titleCase(snapshot.github.ciState)}
        detail="last reported by the Planner"
        tone={checksTone}
      />
      <Tile
        label="Work in flight"
        value={snapshot.github.codexPrsOpen ?? '—'}
        detail="jobs the builder has open"
      />
      {snapshot.costToday !== undefined && (
        <Tile
          label="Spend today"
          value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
            snapshot.costToday,
          )}
          detail="informational — nothing is capped"
        />
      )}
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
    <div className="debug-menu">
      <h1>Debug Menu</h1>
      {!snapshot && !failed && <p>Reading the factory…</p>}
      {failed && <p className="debug-error">Can't reach the factory right now</p>}
      {snapshot?.pausedReason && (
        <Panel className="debug-pause">Paused — {snapshot.pausedReason}</Panel>
      )}
      {snapshot && <Tiles snapshot={snapshot} />}
    </div>
  );
}
