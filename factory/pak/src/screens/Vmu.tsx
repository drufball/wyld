import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getHealthSnapshot, getPresence, listChains, listQuests } from '../api/client.js';
import { Card } from '../components/ui/card.js';
import { SfxToggle } from '../components/SfxToggle.js';
import { countInWords } from '../words.js';

export function Vmu() {
  const [nextAction, setNextAction] =
    useState<Awaited<ReturnType<typeof getPresence>>['nextAction']>(null);
  const [briefingReady, setBriefingReady] = useState(false);
  const [buildingCount, setBuildingCount] = useState<number | null>(null);
  const [rumbleCount, setRumbleCount] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [needsYou, setNeedsYou] = useState(0);

  useEffect(() => {
    void getHealthSnapshot()
      .then((snapshot) => setPaused(snapshot.paused !== undefined))
      .catch(() => setPaused(false));
    void listQuests({ status: 'building' })
      .then((quests) => setBuildingCount(quests.length))
      .catch(() => setBuildingCount(0));
    void getPresence()
      .then((presence) => {
        setNeedsYou(presence.needsYou);
        setNextAction(presence.nextAction);
      })
      .catch(() => setNeedsYou(0));
    void listChains({ kind: 'briefing' })
      .then((chains) => setBriefingReady(chains.length > 0))
      .catch(() => setBriefingReady(false));
    void listChains({ kind: 'rumble' })
      .then((rumbles) => setRumbleCount(rumbles.length))
      .catch(() => setRumbleCount(0));
  }, []);

  const quiet = needsYou === 0 && buildingCount === 0 && nextAction === null;
  return (
    <main className="grid min-h-dvh content-center items-stretch gap-5 bg-muted p-5">
      <h1 className="m-0 font-display text-[10px] text-muted-foreground">VMU</h1>
      {needsYou > 0 && (
        <Link
          className="flex min-h-11 items-center border-2 border-accent p-3 font-display text-xs text-accent no-underline"
          to="/"
        >
          {countInWords(needsYou)} {needsYou === 1 ? 'thing needs' : 'things need'} you
        </Link>
      )}
      {paused && (
        <Link
          className="flex min-h-11 items-center border-2 border-accent p-3 font-display text-xs text-accent no-underline"
          to="/rumble"
        >
          Paused?
        </Link>
      )}
      {briefingReady && (
        <Link
          className="flex min-h-11 items-center justify-self-start py-2 font-display text-[10px] text-accent underline"
          to="/"
        >
          Briefing ready
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
      <SfxToggle className="max-w-full justify-self-start text-[9px] text-muted-foreground" />
    </main>
  );
}
