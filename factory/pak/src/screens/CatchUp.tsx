import type { CatchupLine } from '@wyld/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCatchup, postSeen } from '../api/client.js';
import { Panel } from '../components/Panel.js';

function Lines({ lines }: { lines: CatchupLine[] }) {
  return (
    <ul>
      {lines.map((line, index) => (
        <li key={`${line.text}-${index}`}>
          {line.deepLink ? <Link to={line.deepLink}>{line.text}</Link> : line.text}
        </li>
      ))}
    </ul>
  );
}

export function CatchUp() {
  const [view, setView] = useState<Awaited<ReturnType<typeof getCatchup>> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    void getCatchup()
      .then(setView)
      .catch(() => undefined);
  }, []);

  if (view === null) return null;
  const { digest } = view.catchup;
  const quiet =
    digest.rumbles.length + digest.demos.length + digest.shipped.length + digest.fyi.length === 0;
  const acknowledge = () => {
    const leave = () => navigate('/', { replace: true });
    void postSeen().then(leave, leave);
  };

  return (
    <div className="catch-up">
      <Panel className="catch-up-card">
        <h1>Catch-Up</h1>
        {digest.rumbles.length > 0 && (
          <section>
            <h2>Needs you</h2>
            <Lines lines={digest.rumbles} />
          </section>
        )}
        {digest.demos.length > 0 && (
          <section>
            <h2>Ready to try</h2>
            <Lines lines={digest.demos} />
          </section>
        )}
        {digest.shipped.length > 0 && (
          <section>
            <h2>Shipped</h2>
            <Lines lines={digest.shipped} />
          </section>
        )}
        {digest.fyi.length > 0 && (
          <section>
            <h2>Worth knowing</h2>
            <ul>
              {digest.fyi.map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ul>
          </section>
        )}
        {quiet && <p>All quiet — nothing new to report.</p>}
        {view.nextAction !== null &&
          (view.nextAction.deepLink ? (
            <Link className="today-action" to={view.nextAction.deepLink}>
              {view.nextAction.text}
            </Link>
          ) : (
            <div className="today-action">{view.nextAction.text}</div>
          ))}
        <button className="catch-up-button" type="button" onClick={acknowledge}>
          Got it
        </button>
      </Panel>
    </div>
  );
}
