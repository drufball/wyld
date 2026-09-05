import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Nav } from './components/Nav.js';
import { CatchUpGate } from './CatchUpGate.js';
import { CatchUp } from './screens/CatchUp.js';
import { Debug } from './screens/Debug.js';
import { Demos } from './screens/Demos.js';
import { Memory } from './screens/Memory.js';
import { Rumble } from './screens/Rumble.js';
import { Today } from './screens/Today.js';
import { Vmu } from './screens/Vmu.js';
import { Worlds } from './screens/Worlds.js';
import { WorldQuests } from './screens/WorldQuests.js';
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

export function App({ eventSourceFactory }: { eventSourceFactory?: EventSourceFactory }) {
  return (
    <LiveEventsProvider eventSourceFactory={eventSourceFactory}>
      <Routes>
        <Route path="/vmu" element={<Vmu />} />
        <Route element={<Shell />}>
          <Route index element={<Today />} />
          <Route path="catch-up" element={<CatchUp />} />
          <Route path="worlds" element={<Worlds />} />
          <Route path="worlds/:id" element={<WorldQuests />} />
          <Route path="demos" element={<Demos />} />
          <Route path="rumble" element={<Rumble />} />
          <Route path="debug" element={<Debug />} />
          <Route path="memory" element={<Memory />} />
        </Route>
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </LiveEventsProvider>
  );
}
