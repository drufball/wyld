import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Nav } from './components/Nav.js';
import { Debug } from './screens/Debug.js';
import { Demos } from './screens/Demos.js';
import { Memory } from './screens/Memory.js';
import { Rumble } from './screens/Rumble.js';
import { Today } from './screens/Today.js';
import { Vmu } from './screens/Vmu.js';
import { Worlds } from './screens/Worlds.js';

function Shell() {
  return (
    <div className="pak-shell">
      <Nav />
      <main className="pak-content">
        <Outlet />
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/vmu" element={<Vmu />} />
      <Route element={<Shell />}>
        <Route index element={<Today />} />
        <Route path="worlds" element={<Worlds />} />
        <Route path="demos" element={<Demos />} />
        <Route path="rumble" element={<Rumble />} />
        <Route path="debug" element={<Debug />} />
        <Route path="memory" element={<Memory />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}
