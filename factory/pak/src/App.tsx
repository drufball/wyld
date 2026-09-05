import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { Nav } from './components/Nav.js';
import { CatchUpGate } from './CatchUpGate.js';
import { CatchUp } from './screens/CatchUp.js';
import { Debug } from './screens/Debug.js';
import { Demos } from './screens/Demos.js';
import { Memory } from './screens/Memory.js';
import { Rumble } from './screens/Rumble.js';
import { Today } from './screens/Today.js';
import { Vmu } from './screens/Vmu.js';
import { Quests } from './screens/Quests.js';
import { LiveEventsProvider, type EventSourceFactory } from './live/LiveEvents.js';

function Shell() {
  return (
    <div className="pak-shell">
      <Nav />
      <main className="pak-content">
        <CatchUpGate>
          <Outlet />
        </CatchUpGate>
      </main>
    </div>
  );
}

function LegacyWorldRedirect() {
  const { id } = useParams();
  return <Navigate replace to={id ? `/quests?world=${encodeURIComponent(id)}` : '/quests'} />;
}

export function App({ eventSourceFactory }: { eventSourceFactory?: EventSourceFactory }) {
  return (
    <LiveEventsProvider eventSourceFactory={eventSourceFactory}>
      <Routes>
        <Route path="/vmu" element={<Vmu />} />
        <Route element={<Shell />}>
          <Route index element={<Today />} />
          <Route path="catch-up" element={<CatchUp />} />
          <Route path="quests" element={<Quests />} />
          <Route path="worlds" element={<LegacyWorldRedirect />} />
          <Route path="worlds/:id" element={<LegacyWorldRedirect />} />
          <Route path="demos" element={<Demos />} />
          <Route path="demos/:id" element={<Demos />} />
          <Route path="rumble" element={<Rumble />} />
          <Route path="debug" element={<Debug />} />
          <Route path="memory" element={<Memory />} />
        </Route>
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </LiveEventsProvider>
  );
}
