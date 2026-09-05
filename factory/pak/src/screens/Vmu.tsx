import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCatchup, listDemos, listQuests, listRumbles } from '../api/client.js';
import { countInWords } from '../words.js';

export function Vmu() {
  const [catchup, setCatchup] = useState<Awaited<ReturnType<typeof getCatchup>> | null>(null);
  const [buildingCount, setBuildingCount] = useState<number | null>(null);
  const [rumbleCount, setRumbleCount] = useState<number | null>(null);
  const [demoCount, setDemoCount] = useState<number | null>(null);

  useEffect(() => {
    void getCatchup()
      .then(setCatchup)
      .catch(() => setCatchup(null));
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
    <main className="vmu">
      <h1>VMU</h1>
      {catchup?.show && (
        <Link className="vmu-catchup" to="/catch-up">
          Catch-Up ready
        </Link>
      )}
      {rumbleCount !== null && rumbleCount > 0 && (
        <Link className="vmu-rumbles" to="/rumble">
          {countInWords(rumbleCount)} {rumbleCount === 1 ? 'Rumble' : 'Rumbles'}
        </Link>
      )}
      {demoCount !== null && demoCount > 0 && (
        <Link className="vmu-demos" to="/demos">
          {countInWords(demoCount)} {demoCount === 1 ? 'disc' : 'discs'} ready
        </Link>
      )}
      {nextAction !== null &&
        (nextAction.deepLink ? (
          <Link className="vmu-action" to={nextAction.deepLink}>
            {nextAction.text}
          </Link>
        ) : (
          <p className="vmu-action">{nextAction.text}</p>
        ))}
      {buildingCount !== null && buildingCount > 0 && (
        <Link className="vmu-cranking" to="/worlds">
          Cranking on {countInWords(buildingCount)} {buildingCount === 1 ? 'quest' : 'quests'}.
        </Link>
      )}
      {quiet && <p className="vmu-quiet">Controller's quiet.</p>}
    </main>
  );
}
