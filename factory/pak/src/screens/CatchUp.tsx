import type { CatchupLine } from '@wyld/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCatchup, postSeen } from '../api/client.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';

function Lines({ lines }: { lines: CatchupLine[] }) {
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {lines.map((line, index) => (
        <li className="m-0 wrap-anywhere" key={`${line.text}-${index}`}>
          {line.deepLink ? (
            <Link
              className="flex min-h-11 items-center rounded-[var(--radius)] px-3 text-foreground underline outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              to={line.deepLink}
            >
              {line.text}
            </Link>
          ) : (
            <span className="block px-3 py-2">{line.text}</span>
          )}
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
  const heading = 'mb-2 mt-0 font-display text-[10px] leading-loose text-accent';

  return (
    <div className="mx-auto max-w-[760px]">
      <Card variant="bevel" className="grid gap-5 p-5">
        <h1 className="m-0">Catch-Up</h1>
        {digest.rumbles.length > 0 && (
          <section>
            <h2 className={heading}>Needs you</h2>
            <Lines lines={digest.rumbles} />
          </section>
        )}
        {digest.demos.length > 0 && (
          <section>
            <h2 className={heading}>Ready to try</h2>
            <Lines lines={digest.demos} />
          </section>
        )}
        {digest.shipped.length > 0 && (
          <section>
            <h2 className={heading}>Shipped</h2>
            <Lines lines={digest.shipped} />
          </section>
        )}
        {digest.fyi.length > 0 && (
          <section>
            <h2 className={heading}>Worth knowing</h2>
            <ul className="m-0 grid gap-2 pl-5">
              {digest.fyi.map((line, index) => (
                <li className="wrap-anywhere" key={`${line}-${index}`}>
                  {line}
                </li>
              ))}
            </ul>
          </section>
        )}
        {quiet && <p className="m-0">All quiet — nothing new to report.</p>}
        {view.nextAction !== null &&
          (view.nextAction.deepLink ? (
            <Card variant="bevel" className="p-0">
              <Link
                aria-label={view.nextAction.text}
                className="block min-h-11 p-3 text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
                to={view.nextAction.deepLink}
              >
                <span
                  className="mb-1 block font-display text-[9px] leading-relaxed text-muted-foreground"
                  aria-hidden="true"
                >
                  NEXT
                </span>
                <span className="wrap-anywhere">{view.nextAction.text}</span>
              </Link>
            </Card>
          ) : (
            <Card variant="flat" className="p-5">
              {view.nextAction.text}
            </Card>
          ))}
        <Button className="justify-self-end" variant="retro" type="button" onClick={acknowledge}>
          Got it
        </Button>
      </Card>
    </div>
  );
}
