import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { Nav } from './components/Nav.js';
import { PausedBanner } from './components/PausedBanner.js';
import { postSeen } from './api/client.js';
import { Debug } from './screens/Debug.js';
import { Demos } from './screens/Demos.js';
import { Explain, Roadmap } from './screens/Explain.js';
import { Memory } from './screens/Memory.js';
import { Sleep } from './screens/Sleep.js';
import { Rumble } from './screens/Rumble.js';
import { Today } from './screens/Today.js';
import { Vmu } from './screens/Vmu.js';
import { Quests } from './screens/Quests.js';
import { Workshop } from './screens/Workshop.js';
import { LiveEventsProvider, type EventSourceFactory } from './live/LiveEvents.js';

function Shell() {
  useEffect(() => {
    const seen = () => void postSeen().catch(() => undefined);
    const visible = () => document.visibilityState === 'visible' && seen();
    seen();
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, []);
  return (
    <div className="min-h-dvh">
      <Nav />
      <main className="mx-auto w-full max-w-[760px] px-3 py-5 pb-[calc(88px+env(safe-area-inset-bottom))] md:px-5 md:pb-8">
        <PausedBanner />
        <Outlet />
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
          <Route path="catch-up" element={<Navigate replace to="/" />} />
          <Route path="quests" element={<Quests />} />
          <Route path="explain/:slug" element={<Explain />} />
          <Route path="roadmap" element={<Roadmap />} />
          <Route path="worlds" element={<LegacyWorldRedirect />} />
          <Route path="worlds/:id" element={<LegacyWorldRedirect />} />
          <Route path="demos" element={<Demos />} />
          <Route path="demos/:id" element={<Demos />} />
          <Route path="workshop" element={<Workshop />} />
          <Route path="rumble" element={<Rumble />} />
          <Route path="debug" element={<Debug />} />
          <Route path="memory" element={<Memory />} />
          <Route path="sleep" element={<Sleep />} />
        </Route>
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </LiveEventsProvider>
  );
}
