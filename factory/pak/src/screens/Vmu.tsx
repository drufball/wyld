import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getCatchup,
  getHealthSnapshot,
  listDemos,
  listQuests,
  listRumbles,
} from '../api/client.js';
import { Card } from '../components/ui/card.js';
import { countInWords } from '../words.js';

export function Vmu() {
  const [catchup, setCatchup] = useState<Awaited<ReturnType<typeof getCatchup>> | null>(null);
  const [buildingCount, setBuildingCount] = useState<number | null>(null);
  const [rumbleCount, setRumbleCount] = useState<number | null>(null);
  const [demoCount, setDemoCount] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    void getCatchup()
      .then(setCatchup)
      .catch(() => setCatchup(null));
    void getHealthSnapshot()
      .then((snapshot) => setPaused(snapshot.paused !== undefined))
      .catch(() => setPaused(false));
    void listQuests({ status: 'building' })
      .then((quests) => setBuildingCount(quests.length))
      .catch(() => setBuildingCount(0));
    void listRumbles({ status: 'open' })
      .then((rumbles) => setRumbleCount(rumbles.length))
      .catch(() => setRumbleCount(0));
    void listDemos()
      .then((demos) => setDemoCount(demos.filter(({ status }) => status === 'ready').length))
      .catch(() => setDemoCount(0));
  }, []);

  const nextAction = catchup?.nextAction ?? null;
  const quiet =
    catchup !== null &&
    buildingCount === 0 &&
    rumbleCount === 0 &&
    demoCount === 0 &&
    nextAction === null;
  return (
    <main className="grid min-h-dvh content-center items-stretch gap-5 bg-muted p-5">
      <h1 className="m-0 font-display text-[10px] text-muted-foreground">VMU</h1>
      {paused && (
        <Link
          className="flex min-h-11 items-center border-2 border-accent p-3 font-display text-xs text-accent no-underline"
          to="/rumble"
        >
          Paused?
        </Link>
      )}
      {catchup?.show && (
        <Link
          className="flex min-h-11 items-center justify-self-start py-2 font-display text-[10px] text-accent underline"
          to="/catch-up"
        >
          Catch-Up ready
        </Link>
      )}
      {rumbleCount !== null && rumbleCount > 0 && (
        <Link
          className="flex min-h-11 items-center border-2 border-accent p-3 font-display text-xs text-accent no-underline"
          to="/rumble"
        >
          {countInWords(rumbleCount)} {rumbleCount === 1 ? 'Rumble' : 'Rumbles'}
        </Link>
      )}
      {demoCount !== null && demoCount > 0 && (
        <Link
          className="flex min-h-11 items-center border-2 border-accent p-3 font-display text-xs text-accent no-underline"
          to="/demos"
        >
          {countInWords(demoCount)} {demoCount === 1 ? 'disc' : 'discs'} ready
        </Link>
      )}
      {nextAction !== null &&
        (nextAction.deepLink ? (
          <Card variant="bevel" className="p-0">
            <Link
              className="block min-h-11 p-5 font-mono text-[clamp(13px,4vw,20px)] leading-[1.8] text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <Card variant="bevel" className="p-5 text-[clamp(13px,4vw,20px)] leading-[1.8]">
            <span
              className="mb-1 block font-display text-[9px] leading-relaxed text-muted-foreground"
              aria-hidden="true"
            >
              NEXT
            </span>
            {nextAction.text}
          </Card>
        ))}
      {buildingCount !== null && buildingCount > 0 && (
        <Link className="flex min-h-11 items-center py-2 text-muted-foreground" to="/worlds">
          Cranking on {countInWords(buildingCount)} {buildingCount === 1 ? 'quest' : 'quests'}.
        </Link>
      )}
      {quiet && <p className="m-0 text-muted-foreground">Controller's quiet.</p>}
    </main>
  );
}
