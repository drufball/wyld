import '@fontsource/press-start-2p/400.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App.js';
import { reloadWhenSafe } from './pwa/refresh.js';
import './theme.css';

registerSW({
  immediate: true,
  onNeedReload: reloadWhenSafe,
  onRegisteredSW(_url, registration) {
    if (!registration) return;

    window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void registration.update();
      }
    }, 60_000);
  },
});

const root = document.querySelector('#root');

if (!root) {
  throw new Error('Missing #root mount point');
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
